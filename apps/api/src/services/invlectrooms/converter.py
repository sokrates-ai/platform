from __future__ import annotations

import re
import json
import math
from copy import deepcopy
import logging
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup
from PIL import Image
from sqlmodel import Session
from starlette.requests import Request

from src.db.courses.activities import (
    ActivityCreate,
    ActivityRead,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.chapters import ChapterCreate, ChapterRead
from src.db.courses.courses import Course, default_map_state
from src.db.users import AnonymousUser, PublicUser
from src.services.courses.activities.activities import create_activity
from src.services.courses.chapters import create_chapter

from .constants import (
    CHECKPOINT_IMAGE_PATTERNS,
    CHECKPOINT_LEVEL_KEYWORDS,
    CHECKPOINT_MARKER_ASSETS,
    CHECKPOINT_MARKER_SCALES,
    CONTENT_MAP_SPRITE_SCALE_FACTOR,
)
from .schemas import (
    InvlectRoomsApplyRequest,
    InvlectRoomsApplyResponse,
    InvlectRoomsProblemPayload,
)
from .scraper import (
    DEFAULT_USER_AGENT,
    InvlectRoomsScrapeError,
    _ensure_image_cached,
    _get_content_directory,
)

logger = logging.getLogger(__name__)

def _filename_from_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        path = unquote(urlsplit(value).path or "")
    except Exception:
        path = value
    return path.rsplit("/", 1)[-1] or None

COOL_STONE_ASSET = "Stein_Moos.webp"
COOL_STONE_LABEL = "cool"
PLACEHOLDER_FILE = "Placeholder.webp"
PLACEHOLDER_HIDE_FILE = "placeholder.png"
# Placeholder.webp is rendered as a top-left-anchored sprite in the template map.
# Keep its dimensions in sync with the asset to preserve visual positions.
PLACEHOLDER_WIDTH = 738
PLACEHOLDER_HEIGHT = 475
TEMPLATE_MAP_FILENAME = "template_map.json"
DEFAULT_IMAGE_SCALE = 0.18
IMAGE_REFERENCE_MAX_DIM = 800
CACHE_POPULATE_TIMEOUT = 5.0

CHECKPOINT_DISPLAY_NAMES = {
    "bronze": "Bronze",
    "silver": "Silber",
    "gold": "Gold",
}

_CHAPTER_NUMBER_PATTERN = r"(?:\d+|[IVXLCDM]+)"
_CHAPTER_SEPARATOR_PATTERN = r"(?:-+|–+|—+|::|:|/|\||·|•)"
_CHAPTER_PUNCT_PATTERN = r"(?:[.)])"

_CHAPTER_TITLE_SPLIT_PATTERNS = [
    re.compile(
        rf"^(?P<prefix>.+?)\s*{_CHAPTER_SEPARATOR_PATTERN}\s*(?P<number>{_CHAPTER_NUMBER_PATTERN})\s*{_CHAPTER_PUNCT_PATTERN}\s*(?P<rest>.+)$",
        re.IGNORECASE,
    ),
    re.compile(
        rf"^(?P<prefix>.+?)\s*{_CHAPTER_SEPARATOR_PATTERN}\s*(?P<number>{_CHAPTER_NUMBER_PATTERN})\s*{_CHAPTER_SEPARATOR_PATTERN}\s*(?P<rest>.+)$",
        re.IGNORECASE,
    ),
    re.compile(
        rf"^(?P<prefix>.+?)\s*{_CHAPTER_SEPARATOR_PATTERN}\s*(?P<number>{_CHAPTER_NUMBER_PATTERN})\s+(?P<rest>.+)$",
        re.IGNORECASE,
    ),
    re.compile(
        rf"^(?P<prefix>.+?)\s+(?P<number>{_CHAPTER_NUMBER_PATTERN})\s*{_CHAPTER_PUNCT_PATTERN}\s*(?P<rest>.+)$",
        re.IGNORECASE,
    ),
    re.compile(
        rf"^(?P<prefix>.+?)\s+(?P<number>{_CHAPTER_NUMBER_PATTERN})\s*{_CHAPTER_SEPARATOR_PATTERN}\s*(?P<rest>.+)$",
        re.IGNORECASE,
    ),
]

ChapterContext = Tuple[
    ChapterRead,
    Optional[InvlectRoomsProblemPayload],
    Optional[str],
]
MapSequenceItem = Tuple[str, Any]

def _normalize_checkpoint_level(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().casefold()
    for level in CHECKPOINT_DISPLAY_NAMES:
        if normalized == level:
            return level
    return None


def _resolve_checkpoint_asset(level: str) -> str:
    return CHECKPOINT_MARKER_ASSETS.get(level, COOL_STONE_ASSET)


def _checkpoint_marker_scale(level: str, fallback: float) -> float:
    sprite_scale = CHECKPOINT_MARKER_SCALES.get(level)
    if isinstance(sprite_scale, (int, float)):
        return sprite_scale * CONTENT_MAP_SPRITE_SCALE_FACTOR
    return fallback


def _hydrate_chapter_slot(
    slot: Dict[str, Any],
    chapter: ChapterRead,
    checkpoint_level: Optional[str],
    problem: Optional[InvlectRoomsProblemPayload],
    *,
    preserve_placeholder_position: bool = False,
) -> None:
    chapter_id = chapter.id
    if chapter_id is None:
        return

    if preserve_placeholder_position:
        scale = slot.get("scale", 1)
        x = slot.get("x")
        y = slot.get("y")
        if isinstance(scale, (int, float)) and isinstance(x, (int, float)) and isinstance(y, (int, float)):
            slot["x"] = x + (PLACEHOLDER_WIDTH * scale) / 2
            slot["y"] = y + (PLACEHOLDER_HEIGHT * scale) / 2

    slot["id"] = -int(chapter_id)
    slot["type"] = {
        "kind": "chapter",
        "associatedChapterID": chapter_id,
        "label": chapter.name,
    }

    metadata = slot.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    else:
        metadata = dict(metadata)
    metadata.pop("checkpointLevel", None)

    if checkpoint_level:
        slot["file"] = _resolve_checkpoint_asset(checkpoint_level)
        slot["label"] = chapter.name
        slot["scale"] = slot.get("scale", 0.26)
        metadata["checkpointLevel"] = checkpoint_level
    else:
        slot["file"] = COOL_STONE_ASSET
        slot["label"] = COOL_STONE_LABEL
        slot["scale"] = slot.get("scale", 0.22)

    if metadata:
        slot["metadata"] = metadata
    else:
        slot.pop("metadata", None)


def _apply_checkpoint_marker(
    slot: Dict[str, Any],
    level: str,
    *,
    preserve_placeholder_position: bool = False,
) -> None:
    if preserve_placeholder_position:
        scale = slot.get("scale", 1)
        x = slot.get("x")
        y = slot.get("y")
        if isinstance(scale, (int, float)) and isinstance(x, (int, float)) and isinstance(y, (int, float)):
            slot["x"] = x + (PLACEHOLDER_WIDTH * scale) / 2
            slot["y"] = y + (PLACEHOLDER_HEIGHT * scale) / 2

    slot["file"] = _resolve_checkpoint_asset(level)
    slot["label"] = CHECKPOINT_DISPLAY_NAMES.get(level, level.capitalize())
    slot["scale"] = _checkpoint_marker_scale(level, slot.get("scale", 0.2))

    slot_type = slot.get("type")
    if isinstance(slot_type, dict):
        slot_type = dict(slot_type)
        slot_type["kind"] = "default"
        slot_type["label"] = slot["label"]
        slot_type["customChapterId"] = 0
        slot_type["associatedChapterID"] = None
        slot["type"] = slot_type
    else:
        slot["type"] = {
            "kind": "default",
            "label": slot["label"],
            "customChapterId": 0,
            "associatedChapterID": None,
        }

    metadata = slot.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    else:
        metadata = dict(metadata)
    metadata["checkpointLevel"] = level
    slot["metadata"] = metadata

_SIMPLE_MACROS: Dict[str, str] = {
    "\\CalF": "\\mathcal{F}",
    "\\bigO": "\\mathcal{O}",
    "\\Bij": "\\mathcal{B}",
    "\\natnum": "\\mathbb{N}",
    "\\integers": "\\mathbb{Z}",
    "\\rationals": "\\mathbb{Q}",
    "\\realnum": "\\mathbb{R}",
    "\\less": "\\lt",
    "\\modulo": "\\; \\mathrm{mod} \\;",
    "\\isom": "\\cong",
    "\\qed": "\\Box",
}

_PARAMETERIZED_MACROS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\\set\{([^}]*)\}\{([^}]*)\}"), r"\\{\1 \\mid \2\\}"),
    (re.compile(r"\\vec\{([^}]*)\}"), r"\1"),
    (re.compile(r"\\eqnComment\{([^}]*)\}\{([^}]*)\}"), r"\\underset{{\\scriptstyle \\text{\1}}}{\2}"),
    (re.compile(r"\\Pr\{([^}]*)\}"), r"\\mathrm{Pr}\\left[\1\\right]"),
    (re.compile(r"\\Ew\{([^}]*)\}"), r"\\mathrm{E}\\left[\1\\right]"),
    (re.compile(r"\\Var\{([^}]*)\}"), r"\\mathrm{Var}\\left[\1\\right]"),
]


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = re.sub(r"\s+", " ", value).strip()
    for macro, replacement in _SIMPLE_MACROS.items():
        normalized = normalized.replace(macro, replacement)
    for pattern, replacement in _PARAMETERIZED_MACROS:
        normalized = pattern.sub(replacement, normalized)
    return normalized


def _split_chapter_title(title: str) -> Tuple[str, Optional[str]]:
    normalized = _normalize_text(title)
    if not normalized:
        return "", None

    for pattern in _CHAPTER_TITLE_SPLIT_PATTERNS:
        match = pattern.match(normalized)
        if not match:
            continue
        prefix = _normalize_text(match.group("prefix") or "")
        number = _normalize_text(match.group("number") or "")
        rest = _normalize_text(match.group("rest") or "").lstrip(" -–—:;,.")
        if not prefix or not number or not rest:
            continue
        return f"{prefix} - {number}", rest

    return normalized, None


_IMAGE_ONLY_TEXT_PATTERN = re.compile(
    r"^(?:image:\s*)?(?:/content/|https?://).+\.(?:png|jpe?g|gif|webp|svg)(?:\?.*)?$",
    re.IGNORECASE,
)


def _is_image_only_text(value: str) -> bool:
    normalized = _normalize_text(value)
    if not normalized:
        return True
    return bool(_IMAGE_ONLY_TEXT_PATTERN.match(normalized))


def _is_image_only_problem(problem: InvlectRoomsProblemPayload) -> bool:
    html = problem.html or ""
    plain_text = problem.plain_text or ""

    image_payload = problem.image if isinstance(problem.image, dict) else {}
    has_image = any(
        isinstance(image_payload.get(key), str) and image_payload.get(key)
        for key in ("local", "original", "url", "src")
    )

    has_text = False
    has_html_image = False
    if html:
        soup = BeautifulSoup(html, "html.parser")
        has_html_image = soup.find("img") is not None
        text_content = _normalize_text(soup.get_text(" "))
        has_text = bool(text_content)

    if plain_text and not _is_image_only_text(plain_text):
        has_text = True

    if not has_image and has_html_image:
        has_image = True

    return has_image and not has_text


def _extract_image_urls(
    problem: Optional[InvlectRoomsProblemPayload],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if problem is None:
        logger.debug("InvlectRooms: _extract_image_urls called with None problem")
        return None, None, None
    image_payload = problem.image
    if isinstance(image_payload, dict):
        original_url = image_payload.get("original")
        local_url = image_payload.get("local")
    elif isinstance(image_payload, str):
        original_url = image_payload
        local_url = None
    else:
        original_url = None
        local_url = None
    resolved_url = original_url or local_url
    if not local_url and isinstance(resolved_url, str) and resolved_url.startswith("/content/"):
        local_url = resolved_url
    # logger.debug(
    #     "InvlectRooms: extracted image urls (problem_id=%s, original=%s, local=%s, original_file=%s, local_file=%s)",
    #     getattr(problem, "id", None),
    #     original_url,
    #     local_url,
    #     _filename_from_url(original_url),
    #     _filename_from_url(local_url),
    # )
    return resolved_url, original_url, local_url


def _host_matches(a: Optional[str], b: Optional[str]) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    if a.endswith(f".{b}") or b.endswith(f".{a}"):
        return True
    return False


def _should_cache_image_url(original_url: Optional[str], source_host: Optional[str]) -> bool:
    if not original_url:
        return False
    parsed = urlsplit(original_url)
    if parsed.scheme not in {"http", "https"}:
        return False
    host = parsed.hostname
    if not host:
        return False
    if host in {"localhost", "127.0.0.1"}:
        return True
    return _host_matches(host, source_host)


@lru_cache(maxsize=256)
def _cache_remote_image(
    original_url: str,
    source_host: Optional[str],
) -> Optional[str]:
    if not _should_cache_image_url(original_url, source_host):
        logger.debug(
            "InvlectRooms: skipping image cache for %s (host mismatch or unsupported)",
            original_url,
        )
        return None
    try:
        cached = _ensure_image_cached(
            original_url,
            timeout=CACHE_POPULATE_TIMEOUT,
            user_agent=DEFAULT_USER_AGENT,
        )
        logger.info(
            "InvlectRooms: cached image %s -> %s",
            original_url,
            cached,
        )
        return cached
    except InvlectRoomsScrapeError:
        logger.warning("InvlectRooms: failed to cache image %s", original_url)
        return None


def _resolve_local_image_path(local_url: Optional[str]) -> Optional[Path]:
    if not local_url or not isinstance(local_url, str):
        return None
    if local_url.startswith(("http://", "https://")):
        return None
    normalized = local_url.lstrip("/")
    if not normalized.startswith("content/"):
        return None
    relative = normalized[len("content/") :]
    try:
        content_dir = _get_content_directory()
    except Exception:
        return None
    return content_dir / relative


@lru_cache(maxsize=256)
def _get_image_dimensions(local_url: Optional[str]) -> Optional[Tuple[int, int]]:
    path = _resolve_local_image_path(local_url)
    if not path or not path.exists():
        logger.debug(
            "InvlectRooms: image path not found for %s (resolved=%s)",
            local_url,
            path,
        )
        return None
    try:
        with Image.open(path) as img:
            size = img.size
            logger.debug(
                "InvlectRooms: image dimensions for %s: %sx%s",
                local_url,
                size[0],
                size[1],
            )
            return size
    except Exception:
        logger.debug("InvlectRooms: failed to read image size for %s", local_url)
        return None


def _normalized_image_scale(local_url: Optional[str]) -> float:
    dimensions = _get_image_dimensions(local_url)
    if not dimensions:
        logger.debug(
            "InvlectRooms: using default image scale %.3f for %s",
            DEFAULT_IMAGE_SCALE,
            local_url,
        )
        return DEFAULT_IMAGE_SCALE
    width, height = dimensions
    max_dim = max(width or 0, height or 0)
    if max_dim <= 0 or max_dim <= IMAGE_REFERENCE_MAX_DIM:
        logger.debug(
            "InvlectRooms: image scale unchanged %.3f for %s (max_dim=%s)",
            DEFAULT_IMAGE_SCALE,
            local_url,
            max_dim,
        )
        return DEFAULT_IMAGE_SCALE
    normalized = DEFAULT_IMAGE_SCALE * (IMAGE_REFERENCE_MAX_DIM / max_dim)
    logger.debug(
        "InvlectRooms: normalized image scale %.3f for %s (max_dim=%s ref=%s)",
        normalized,
        local_url,
        max_dim,
        IMAGE_REFERENCE_MAX_DIM,
    )
    return normalized


def _populate_problem_image_cache(
    problem: InvlectRoomsProblemPayload,
    source_host: Optional[str],
) -> None:
    problem_id = getattr(problem, "id", None)
    image_payload = problem.image
    if not image_payload:
        logger.debug("InvlectRooms: problem %s has no image payload", problem_id)
        return
    if isinstance(image_payload, str):
        original_url = image_payload
        local_url = None
        payload_dict: Dict[str, Optional[str]] = {"original": original_url}
        problem.image = payload_dict
    elif isinstance(image_payload, dict):
        payload_dict = image_payload
        original_url = payload_dict.get("original") or payload_dict.get("local")
        local_url = payload_dict.get("local")
    else:
        return

    if local_url:
        local_path = _resolve_local_image_path(local_url)
        if local_path and local_path.exists():
            logger.debug(
                "InvlectRooms: image cache hit for problem %s (%s)",
                problem_id,
                local_url,
            )
            return

    if not original_url:
        logger.debug("InvlectRooms: problem %s missing original image url", problem_id)
        return

    logger.info(
        "InvlectRooms: caching image for problem %s (%s)",
        problem_id,
        original_url,
    )
    cached_local = _cache_remote_image(original_url, source_host)
    if cached_local:
        payload_dict["local"] = cached_local
        if "original" not in payload_dict:
            payload_dict["original"] = original_url


def _extract_paragraphs(
    html: Optional[str],
    plain_text: Optional[str],
) -> List[str]:
    paragraphs: List[str] = []
    if html:
        soup = BeautifulSoup(html, "html.parser")
        for element in soup.select("script,style,noscript"):
            element.decompose()
        for node in soup.find_all(["p", "li"]):
            lines = node.get_text("\n").splitlines()
            for raw_line in lines:
                text = _normalize_text(raw_line)
                if not text:
                    continue
                paragraphs.append(f"• {text}" if node.name == "li" else text)
        if not paragraphs:
            lines = soup.get_text("\n").splitlines()
            for raw_line in lines:
                text = _normalize_text(raw_line)
                if text:
                    paragraphs.append(text)
    if not paragraphs and plain_text:
        lines = plain_text.splitlines()
        for raw_line in lines:
            text = _normalize_text(raw_line)
            if text:
                paragraphs.append(text)
    return paragraphs


def _inline_math_content(text: str) -> List[Dict[str, Any]]:
    if not text:
        return [{"type": "text", "text": ""}]

    nodes: List[Dict[str, Any]] = []
    buffer: List[str] = []
    length = len(text)
    index = 0

    def flush() -> None:
        if buffer:
            nodes.append({"type": "text", "text": "".join(buffer)})
            buffer.clear()

    while index < length:
        char = text[index]

        if char == "\\" and index + 1 < length and text[index + 1] == "$":
            buffer.append("$")
            index += 2
            continue

        if char != "$":
            buffer.append(char)
            index += 1
            continue

        if index + 1 < length and text[index + 1] == "$":
            buffer.append("$$")
            index += 2
            continue

        cursor = index + 1
        closing = None
        while cursor < length:
            if text[cursor] == "\\" and cursor + 1 < length and text[cursor + 1] == "$":
                cursor += 2
                continue

            if text[cursor] == "$":
                if (cursor > 0 and text[cursor - 1] == "$") or (
                    cursor + 1 < length and text[cursor + 1] == "$"
                ):
                    cursor += 1
                    continue
                closing = cursor
                break
            cursor += 1

        if closing is None:
            buffer.append("$")
            index += 1
            continue

        math = text[index + 1 : closing]
        if not math or "\n" in math or "$" in math:
            buffer.append("$")
            index += 1
            continue

        flush()
        nodes.append({"type": "inlineMathEquation", "attrs": {"math_equation": math}})
        index = closing + 1

    flush()
    return nodes or [{"type": "text", "text": ""}]


def guess_chapter_name(value: str) -> str:
    try:
        parsed = urlsplit(value)
        segment = parsed.path.strip("/").split("/")[-1] or parsed.netloc or value
        decoded = unquote(segment)
        cleaned = re.sub(r"[-_]+", " ", decoded)
        normalized = _normalize_text(cleaned)
        if not normalized:
            return "Imported content"
        return " ".join(word.capitalize() for word in normalized.split(" "))
    except Exception:
        return "Imported content"


def build_activity_content(
    problem: InvlectRoomsProblemPayload,
    source_url: str,
) -> Dict[str, Any]:
    nodes: List[Dict[str, Any]] = []
    status_text = _normalize_text(problem.status or "")
    if status_text:
        nodes.append(
            {
                "type": "paragraph",
                "content": _inline_math_content(f"Status: {status_text}"),
            }
        )

    for paragraph in _extract_paragraphs(problem.html, problem.plain_text):
        nodes.append(
            {
                "type": "paragraph",
                "content": _inline_math_content(paragraph),
            }
        )

    if problem.image:
        image_path = problem.image.get("local") or problem.image.get("original")
        if image_path:
            nodes.append(
                {
                    "type": "paragraph",
                    "content": _inline_math_content(f"Image: {image_path}"),
                }
            )

    if not nodes:
        nodes.append(
            {
                "type": "paragraph",
                "content": _inline_math_content("Imported task"),
            }
        )

    metadata: Dict[str, Any] = {
        "provider": "invlectrooms",
        "url": source_url,
        "problem_id": problem.id,
        "status": problem.status,
    }
    if problem.image:
        metadata["image"] = problem.image
    if problem.plain_text:
        metadata["plain_text"] = problem.plain_text

    return {
        "type": "doc",
        "content": nodes,
        "meta": {"source": metadata},
    }


@lru_cache(maxsize=1)
def _load_template_map() -> Dict[str, Any]:
    resource_root = resources.files("src.services.invlectrooms")
    try:
        data = resource_root.joinpath(TEMPLATE_MAP_FILENAME).read_text(encoding="utf-8")
    except FileNotFoundError:
        base = default_map_state()
        return {
            "objects": [],
            "boundaries": deepcopy(base.get("boundaries", {})),
        }
    return json.loads(data)


def _select_placeholder_positions(total_slots: int, required: int) -> List[int]:
    if required <= 0 or total_slots <= 0:
        return []
    if required >= total_slots:
        return list(range(total_slots))
    if required == 1:
        return [0]

    indices: List[int] = []
    for position in range(required):
        approx = math.floor(position * total_slots / required)
        indices.append(approx)

    indices[-1] = total_slots - 1

    # Ensure strictly non-decreasing sequence
    for idx in range(1, len(indices)):
        if indices[idx] <= indices[idx - 1]:
            indices[idx] = min(
                total_slots - (len(indices) - idx),
                max(indices[idx - 1] + 1, indices[idx]),
            )

    return indices


def _parse_placeholder_order(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if math.isfinite(value):
            return int(value)
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            return int(stripped)
    return None


def _order_placeholder_indices(
    placeholder_entries: List[Tuple[int, Dict[str, Any]]],
) -> Optional[List[int]]:
    ordered: List[Tuple[Optional[int], int]] = []
    has_order = False
    for index, obj in placeholder_entries:
        order = _parse_placeholder_order(obj.get("order"))
        if order is not None:
            has_order = True
        ordered.append((order, index))
    if not has_order:
        return None
    ordered.sort(
        key=lambda item: (
            item[0] is None,
            item[0] if item[0] is not None else 0,
            item[1],
        )
    )
    return [index for _, index in ordered]


def _build_content_map(
    chapter_contexts: List[ChapterContext],
    image_only_problems: List[InvlectRoomsProblemPayload],
    map_sequence: Optional[List[MapSequenceItem]] = None,
) -> Dict[str, Any]:
    logger.info(
        "InvlectRooms: building content map",
        extra={
            "chapter_count": len(chapter_contexts),
            "image_only_count": len(image_only_problems),
            "sequence_count": len(map_sequence) if map_sequence else 0,
        },
    )
    template = deepcopy(_load_template_map())
    objects = template.get("objects", [])
    placeholder_entries: List[Tuple[int, Dict[str, Any]]] = [
        (index, obj)
        for index, obj in enumerate(objects)
        if isinstance(obj, dict) and obj.get("file") == PLACEHOLDER_FILE
    ]
    placeholder_indices = [index for index, _ in placeholder_entries]
    ordered_placeholder_indices = _order_placeholder_indices(placeholder_entries)

    used_placeholder_indices: set[int] = set()
    chapter_positions: Dict[int, Dict[str, Any]] = {}
    chapter_placeholder_indices: List[int] = []
    image_slot_indices: List[int] = []
    image_slot_problems: List[InvlectRoomsProblemPayload] = []
    checkpoint_slot_indices: List[int] = []
    remaining_image_only: List[InvlectRoomsProblemPayload] = []
    remaining_checkpoints: List[Tuple[InvlectRoomsProblemPayload, str]] = []
    extra_contexts: List[ChapterContext] = []

    if map_sequence:
        placement_indices = (
            ordered_placeholder_indices
            if ordered_placeholder_indices is not None
            else placeholder_indices
        )
        total_placeholders = len(placement_indices)
        total_items = len(map_sequence)
        mapped_indices: List[int] = []
        if total_placeholders and total_items:
            required = min(total_items, total_placeholders)
            slot_positions = _select_placeholder_positions(
                total_placeholders,
                required,
            )
            mapped_indices = [
                placement_indices[position]
                for position in slot_positions
            ]
            if ordered_placeholder_indices is not None:
                mapped_order_keys = []
                for mapped_index in mapped_indices:
                    order_value = _parse_placeholder_order(
                        objects[mapped_index].get("order")
                    )
                    mapped_order_keys.append(
                        (
                            order_value is None,
                            order_value if order_value is not None else 0,
                        )
                    )
                assert mapped_order_keys == sorted(mapped_order_keys), (
                    "InvlectRooms placeholder order mapping wrapped: "
                    f"{mapped_order_keys}"
                )

        for sequence_index, (kind, payload) in enumerate(map_sequence):
            if sequence_index < len(mapped_indices):
                object_index = mapped_indices[sequence_index]
                if kind == "chapter":
                    chapter, problem, checkpoint_level = payload
                    chapter_id = chapter.id
                    if chapter_id is None:
                        continue
                    slot = objects[object_index]
                    _hydrate_chapter_slot(
                        slot,
                        chapter,
                        checkpoint_level,
                        problem,
                        preserve_placeholder_position=True,
                    )
                    used_placeholder_indices.add(object_index)
                    chapter_placeholder_indices.append(object_index)
                    chapter_positions[int(chapter_id)] = slot
                elif kind == "image_only":
                    if isinstance(payload, InvlectRoomsProblemPayload):
                        logger.debug(
                            "InvlectRooms: assigning image-only to placeholder",
                            extra={
                                "sequence_index": sequence_index,
                                "placeholder_index": object_index,
                                "problem_id": payload.id,
                                "order": objects[object_index].get("order"),
                            },
                        )
                        image_slot_indices.append(object_index)
                        image_slot_problems.append(payload)
                elif kind == "checkpoint":
                    if isinstance(payload, tuple) and len(payload) == 2:
                        problem, checkpoint_level = payload
                        if isinstance(problem, InvlectRoomsProblemPayload):
                            slot = objects[object_index]
                            _apply_checkpoint_marker(
                                slot,
                                checkpoint_level,
                                preserve_placeholder_position=False,
                            )
                            used_placeholder_indices.add(object_index)
                            checkpoint_slot_indices.append(object_index)
                            logger.debug(
                                "InvlectRooms: assigned checkpoint marker to placeholder",
                                extra={
                                    "problem_id": getattr(problem, "id", None),
                                    "placeholder_index": object_index,
                                    "order": slot.get("order"),
                                    "level": checkpoint_level,
                                },
                            )
            else:
                if kind == "chapter":
                    extra_contexts.append(payload)
                elif kind == "image_only" and isinstance(
                    payload, InvlectRoomsProblemPayload
                ):
                    remaining_image_only.append(payload)
                elif kind == "checkpoint":
                    if isinstance(payload, tuple) and len(payload) == 2:
                        problem, checkpoint_level = payload
                        if isinstance(problem, InvlectRoomsProblemPayload):
                            remaining_checkpoints.append((problem, checkpoint_level))
    else:
        chapter_slots = _select_placeholder_positions(
            len(placeholder_indices),
            len(chapter_contexts),
        )
        mapped_indices = [placeholder_indices[position] for position in chapter_slots]
        used_placeholder_indices = set(mapped_indices)

        for (chapter, problem, checkpoint_level), object_index in zip(
            chapter_contexts,
            mapped_indices,
        ):
            chapter_id = chapter.id
            if chapter_id is None:
                continue
            slot = objects[object_index]
            _hydrate_chapter_slot(
                slot,
                chapter,
                checkpoint_level,
                problem,
                preserve_placeholder_position=True,
            )
            logger.debug(
                "InvlectRooms: assigned chapter to placeholder",
                extra={
                    "chapter_id": chapter_id,
                    "problem_id": getattr(problem, "id", None),
                    "placeholder_index": object_index,
                    "order": slot.get("order"),
                },
            )
            chapter_placeholder_indices.append(object_index)
            chapter_positions[int(chapter_id)] = slot

        extra_contexts = chapter_contexts[len(mapped_indices) :]

        if image_only_problems:
            available_placeholders = [
                index
                for index in placeholder_indices
                if index not in used_placeholder_indices
            ]
            if available_placeholders:
                image_slots = _select_placeholder_positions(
                    len(available_placeholders),
                    len(image_only_problems),
                )
                image_slot_indices = [
                    available_placeholders[position] for position in image_slots
                ]
            else:
                image_slot_indices = []

            image_slot_problems = image_only_problems[: len(image_slot_indices)]
            remaining_image_only = image_only_problems[len(image_slot_indices) :]

    if extra_contexts:
        if chapter_placeholder_indices:
            last_position = objects[chapter_placeholder_indices[-1]]
        else:
            last_position = {"x": 0, "y": 0}
        base_x = last_position.get("x", 0)
        base_y = last_position.get("y", 0)
        offset = 180
        for offset_index, (chapter, problem, checkpoint_level) in enumerate(
            extra_contexts,
            start=1,
        ):
            chapter_id = chapter.id
            if chapter_id is None:
                continue
            slot = {
                "id": -int(chapter_id),
                "x": base_x + offset * offset_index,
                "y": base_y,
                "scale": 0.22,
                "file": COOL_STONE_ASSET,
                "label": COOL_STONE_LABEL,
                "type": {
                    "kind": "chapter",
                    "associatedChapterID": chapter_id,
                    "label": chapter.name,
                },
            }
            _hydrate_chapter_slot(slot, chapter, checkpoint_level, problem)
            objects.append(slot)
            chapter_positions[int(chapter_id)] = slot

    if image_slot_indices:
        used_placeholder_indices.update(image_slot_indices)
    if checkpoint_slot_indices:
        used_placeholder_indices.update(checkpoint_slot_indices)

    for index in placeholder_indices:
        if index in used_placeholder_indices:
            continue
        slot = objects[index]
        if not isinstance(slot, dict):
            continue
        slot["file"] = PLACEHOLDER_HIDE_FILE
        slot["scale"] = 0
        slot["label"] = ""
        slot_type = slot.get("type")
        if isinstance(slot_type, dict):
            slot_type = dict(slot_type)
            slot_type["kind"] = "default"
            slot_type.pop("associatedChapterID", None)
            slot_type.pop("customChapterId", None)
            slot_type.pop("label", None)
            slot["type"] = slot_type
        else:
            slot["type"] = {"kind": "default", "label": "", "customChapterId": 0}

    template["objects"] = objects

    if "boundaries" not in template or not isinstance(template["boundaries"], dict):
        template["boundaries"] = deepcopy(default_map_state().get("boundaries", {}))

    boundaries = template["boundaries"]
    left_boundary = boundaries.get("left", -1000)
    right_boundary = boundaries.get("right", 1000)
    top_boundary = boundaries.get("top", -1000)
    bottom_boundary = boundaries.get("bottom", 1000)
    boundary_margin = 40

    used_ids = {
        obj.get("id")
        for obj in template["objects"]
        if isinstance(obj, dict) and isinstance(obj.get("id"), int)
    }
    next_id = max(used_ids) + 1 if used_ids else 1

    image_assets: List[Dict[str, Any]] = []
    for index, (chapter, problem, checkpoint_level) in enumerate(chapter_contexts):
        if checkpoint_level or problem is None:
            continue
        chapter_id = chapter.id
        if chapter_id is None:
            continue
        chapter_obj = chapter_positions.get(int(chapter_id))
        if not chapter_obj:
            continue
        image_url, original_url, local_url = _extract_image_urls(problem)
        if not image_url:
            continue
        image_scale = _normalized_image_scale(local_url)

        offset_x = 140 if index % 2 == 0 else -140
        offset_y = -140
        target_x = (chapter_obj.get("x") or 0) + offset_x
        target_y = (chapter_obj.get("y") or 0) + offset_y
        target_x = max(
            left_boundary + boundary_margin,
            min(right_boundary - boundary_margin, target_x),
        )
        target_y = max(
            top_boundary + boundary_margin,
            min(bottom_boundary - boundary_margin, target_y),
        )

        image_assets.append(
            {
                "id": next_id,
                "x": target_x,
                "y": target_y,
                "scale": image_scale,
                "file": image_url,
                "label": (problem.title or "").strip() or f"Image {chapter_id}",
                "sourceUrl": original_url or image_url,
                "type": {
                    "kind": "default",
                    "label": (problem.title or "").strip(),
                    "customChapterId": 0,
                    "associatedChapterID": None,
                },
            }
        )
        used_ids.add(next_id)
        next_id += 1

    if image_only_problems:
        fallback_x = 0
        fallback_y = 0
        if chapter_positions:
            last_slot = next(reversed(chapter_positions.values()))
            fallback_x = last_slot.get("x", 0)
            fallback_y = last_slot.get("y", 0)

        for slot_index, problem in zip(image_slot_indices, image_slot_problems):
            slot = objects[slot_index]
            image_url, original_url, local_url = _extract_image_urls(problem)
            if not image_url:
                logger.warning(
                    "InvlectRooms: image-only problem missing image url",
                    extra={
                        "problem_id": problem.id,
                        "placeholder_index": slot_index,
                    },
                )
                slot["file"] = PLACEHOLDER_HIDE_FILE
                slot["scale"] = 0
                slot["label"] = ""
                slot_type = slot.get("type")
                if isinstance(slot_type, dict):
                    slot_type = dict(slot_type)
                    slot_type["kind"] = "default"
                    slot_type.pop("associatedChapterID", None)
                    slot_type.pop("customChapterId", None)
                    slot_type.pop("label", None)
                    slot["type"] = slot_type
                else:
                    slot["type"] = {"kind": "default", "label": "", "customChapterId": 0}
                continue
            target_x = slot.get("x", 0)
            target_y = slot.get("y", 0)
            target_x = max(
                left_boundary + boundary_margin,
                min(right_boundary - boundary_margin, target_x),
            )
            target_y = max(
                top_boundary + boundary_margin, min(bottom_boundary - boundary_margin, target_y)
            )

            slot["x"] = target_x
            slot["y"] = target_y
            slot["scale"] = _normalized_image_scale(local_url)
            slot["file"] = image_url
            slot["label"] = (problem.title or "").strip() or f"Image {slot.get('id')}"
            slot["sourceUrl"] = original_url or image_url
            slot["type"] = {
                "kind": "default",
                "label": (problem.title or "").strip(),
                "customChapterId": 0,
                "associatedChapterID": None,
            }
            logger.debug(
                "InvlectRooms: placed image-only asset (problem_id=%s, placeholder_index=%s, image_url=%s, image_file=%s, source_url=%s, source_file=%s, order=%s)",
                problem.id,
                slot_index,
                image_url,
                _filename_from_url(image_url),
                original_url,
                _filename_from_url(original_url),
                slot.get("order"),
            )

        for offset_index, problem in enumerate(remaining_image_only):
            image_url, original_url, local_url = _extract_image_urls(problem)
            if not image_url:
                logger.warning(
                    "InvlectRooms: remaining image-only problem missing image url",
                    extra={"problem_id": problem.id},
                )
                continue
            image_scale = _normalized_image_scale(local_url)
            target_x = fallback_x + 160 * (offset_index + 1)
            target_y = fallback_y
            target_x = max(
                left_boundary + boundary_margin,
                min(right_boundary - boundary_margin, target_x),
            )
            target_y = max(
                top_boundary + boundary_margin, min(bottom_boundary - boundary_margin, target_y)
            )

            image_assets.append(
                {
                    "id": next_id,
                    "x": target_x,
                    "y": target_y,
                    "scale": image_scale,
                    "file": image_url,
                    "label": (problem.title or "").strip() or f"Image {next_id}",
                    "sourceUrl": original_url or image_url,
                    "type": {
                        "kind": "default",
                        "label": (problem.title or "").strip(),
                        "customChapterId": 0,
                        "associatedChapterID": None,
                    },
                }
            )
            logger.debug(
                "InvlectRooms: placed image-only asset (overflow) (problem_id=%s, image_url=%s, image_file=%s, source_url=%s, source_file=%s)",
                problem.id,
                image_url,
                _filename_from_url(image_url),
                original_url,
                _filename_from_url(original_url),
            )
            used_ids.add(next_id)
            next_id += 1

    if remaining_checkpoints:
        fallback_x = 0
        fallback_y = 0
        if chapter_positions:
            last_slot = next(reversed(chapter_positions.values()))
            fallback_x = last_slot.get("x", 0)
            fallback_y = last_slot.get("y", 0)

        for offset_index, (problem, checkpoint_level) in enumerate(remaining_checkpoints):
            target_x = fallback_x + 160 * (offset_index + 1)
            target_y = fallback_y
            target_x = max(
                left_boundary + boundary_margin,
                min(right_boundary - boundary_margin, target_x),
            )
            target_y = max(
                top_boundary + boundary_margin,
                min(bottom_boundary - boundary_margin, target_y),
            )

            image_assets.append(
                {
                    "id": next_id,
                    "x": target_x,
                    "y": target_y,
                    "scale": _checkpoint_marker_scale(checkpoint_level, 0.2),
                    "file": _resolve_checkpoint_asset(checkpoint_level),
                    "label": CHECKPOINT_DISPLAY_NAMES.get(
                        checkpoint_level, checkpoint_level.capitalize()
                    ),
                    "metadata": {"checkpointLevel": checkpoint_level},
                    "type": {
                        "kind": "default",
                        "label": CHECKPOINT_DISPLAY_NAMES.get(
                            checkpoint_level, checkpoint_level.capitalize()
                        ),
                        "customChapterId": 0,
                        "associatedChapterID": None,
                    },
                }
            )
            logger.debug(
                "InvlectRooms: placed checkpoint marker (overflow) (problem_id=%s, level=%s)",
                getattr(problem, "id", None),
                checkpoint_level,
            )
            used_ids.add(next_id)
            next_id += 1

    if image_assets:
        template["objects"].extend(image_assets)

    return template


async def convert_invlectrooms_payload_to_course(
    *,
    payload: InvlectRoomsApplyRequest,
    course: Course,
    request: Request,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> InvlectRoomsApplyResponse:
    base_name = payload.chapter_name or guess_chapter_name(str(payload.url))
    chapters: List[ChapterRead] = []
    activities: List[ActivityRead] = []
    source_url = str(payload.url)
    source_host = urlsplit(source_url).hostname
    chapter_contexts: List[ChapterContext] = []
    image_only_problems: List[InvlectRoomsProblemPayload] = []
    map_sequence: List[MapSequenceItem] = []
    xp_reward = payload.xp_reward or 0
    coin_reward = payload.coin_reward or 0

    for problem in payload.problems:
        _populate_problem_image_cache(problem, source_host)

    for index, problem in enumerate(payload.problems):
        checkpoint_level = _normalize_checkpoint_level(problem.checkpoint_level)
        if not checkpoint_level:
            checkpoint_level = _detect_checkpoint(problem)

        if checkpoint_level:
            chapter, activity = await _create_checkpoint_chapter(
                level=checkpoint_level,
                base_name=base_name,
                problem=problem,
                source_url=source_url,
                payload=payload,
                course=course,
                xp_reward=xp_reward,
                coin_reward=coin_reward,
                request=request,
                current_user=current_user,
                db_session=db_session,
            )
            activities.append(activity)
            chapter.activities = [activity]
            chapters.append(chapter)
            chapter_contexts.append((chapter, problem, checkpoint_level))
            map_sequence.append(("chapter", (chapter, problem, checkpoint_level)))
            continue

        if _is_image_only_problem(problem):
            image_only_problems.append(problem)
            map_sequence.append(("image_only", problem))
            continue

        problem_title = _normalize_text(problem.title or "") or f"Problem {index + 1}"
        requested_chapter_title = _normalize_text(problem.chapter_name or "")
        if requested_chapter_title:
            chapter_title = requested_chapter_title
        elif base_name:
            chapter_title = f"{base_name} — {problem_title}"
        else:
            chapter_title = problem_title

        chapter_name, chapter_description = _split_chapter_title(chapter_title)
        chapter_request = ChapterCreate(
            name=chapter_name,
            description=chapter_description or "",
            thumbnail_image="",
            org_id=course.org_id,
            course_id=course.id,
            xp_reward=xp_reward,
            coin_reward=coin_reward,
            tab_uuid=payload.tab_uuid,
        )

        chapter = await create_chapter(
            request, chapter_request, current_user, db_session
        )

        content = build_activity_content(problem, source_url)

        activity_request = ActivityCreate(
            chapter_id=chapter.id,
            name=problem_title,
            activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            content=content,
            published=True,
        )

        activity = await create_activity(
            request, activity_request, current_user, db_session
        )
        activities.append(activity)
        chapter.activities = [activity]
        chapters.append(chapter)
        chapter_contexts.append((chapter, problem, None))
        map_sequence.append(("chapter", (chapter, problem, None)))

    if chapters or image_only_problems:
        tab_store = dict(course.tab_store or {})
        tab_uuid = payload.tab_uuid or next(iter(tab_store), "tab-1")

        map_state = _build_content_map(
            chapter_contexts,
            image_only_problems,
            map_sequence,
        )
        course.map_state = deepcopy(map_state)
        tab_store[tab_uuid] = deepcopy(map_state)
        course.tab_store = tab_store
        db_session.add(course)
        db_session.commit()
        db_session.refresh(course)

    return InvlectRoomsApplyResponse(
        chapter=chapters[0] if chapters else None,
        chapters=chapters,
        activities=activities,
    )


def _detect_checkpoint(problem: InvlectRoomsProblemPayload) -> Optional[str]:
    text_fragments: List[str] = []
    if isinstance(problem.title, str):
        text_fragments.append(problem.title)
    if isinstance(problem.plain_text, str):
        text_fragments.append(problem.plain_text)
    if isinstance(problem.html, str):
        text_fragments.append(problem.html)

    combined_text = " ".join(text_fragments).casefold()
    if "schnabeltierchen" in combined_text:
        for level, keywords in CHECKPOINT_LEVEL_KEYWORDS.items():
            if any(keyword in combined_text for keyword in keywords):
                return level

    image_payload = problem.image if isinstance(problem.image, dict) else {}
    if isinstance(image_payload, dict):
        for key in ("original", "local"):
            value = image_payload.get(key)
            if not isinstance(value, str):
                continue
            lowered = value.casefold()
            for level, patterns in CHECKPOINT_IMAGE_PATTERNS.items():
                if any(pattern in lowered for pattern in patterns):
                    return level

    return None


async def _create_checkpoint_chapter(
    *,
    level: str,
    base_name: Optional[str],
    problem: InvlectRoomsProblemPayload,
    source_url: str,
    payload: InvlectRoomsApplyRequest,
    course: Course,
    xp_reward: int,
    coin_reward: int,
    request: Request,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> Tuple[ChapterRead, ActivityRead]:
    display_name = CHECKPOINT_DISPLAY_NAMES.get(level, level.capitalize())
    requested_title = _normalize_text(problem.chapter_name or "")
    if requested_title:
        chapter_title = requested_title
    elif base_name:
        chapter_title = f"{base_name} — Checkpoint {display_name}"
    else:
        chapter_title = f"Checkpoint {display_name}"

    chapter_name, chapter_description = _split_chapter_title(chapter_title)
    chapter_request = ChapterCreate(
        name=chapter_name,
        description=chapter_description or "",
        thumbnail_image="",
        org_id=course.org_id,
        course_id=course.id,
        xp_reward=xp_reward,
        coin_reward=coin_reward,
        tab_uuid=payload.tab_uuid,
    )

    chapter = await create_chapter(request, chapter_request, current_user, db_session)

    checkpoint_content = _build_checkpoint_content(
        level=level,
        display_name=display_name,
        source_url=source_url,
        problem=problem,
    )

    activity_request = ActivityCreate(
        chapter_id=chapter.id,
        name=f"Checkpoint {display_name}",
        activity_type=ActivityTypeEnum.TYPE_CUSTOM,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_CUSTOM,
        content=checkpoint_content,
        published=True,
    )

    activity = await create_activity(request, activity_request, current_user, db_session)
    return chapter, activity


def _build_checkpoint_content(
    *,
    level: str,
    display_name: str,
    source_url: str,
    problem: InvlectRoomsProblemPayload,
) -> Dict[str, Any]:
    nodes: List[Dict[str, Any]] = [
        {
            "type": "heading",
            "attrs": {"level": 2},
            "content": [{"type": "text", "text": f"{display_name} Checkpoint"}],
        },
        {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": "This checkpoint placeholder was imported from InvLectRooms.",
                }
            ],
        },
    ]

    original_title = _normalize_text(problem.title or "")
    if original_title:
        nodes.insert(
            1,
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": f"Original label: {original_title}",
                    }
                ],
            },
        )

    metadata: Dict[str, Any] = {
        "provider": "invlectrooms",
        "url": source_url,
        "checkpoint": level,
        "kind": "checkpoint_dummy",
    }

    if problem.id is not None:
        metadata["problem_id"] = problem.id
    if problem.title:
        metadata["original_title"] = problem.title
    if problem.status:
        metadata["original_status"] = problem.status

    return {
        "type": "doc",
        "content": nodes,
        "meta": {"source": metadata},
    }
