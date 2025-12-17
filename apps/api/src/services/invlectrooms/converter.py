from __future__ import annotations

import re
import json
import math
from copy import deepcopy
from functools import lru_cache
from importlib import resources
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup
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

from .schemas import (
    InvlectRoomsApplyRequest,
    InvlectRoomsApplyResponse,
    InvlectRoomsProblemPayload,
)

COOL_STONE_ASSET = "Stein_Moos.webp"
COOL_STONE_LABEL = "cool"
PLACEHOLDER_FILE = "Placeholder.webp"
TEMPLATE_MAP_FILENAME = "template_map.json"


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


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
            text = _normalize_text(node.get_text(" "))
            if text:
                paragraphs.append(f"• {text}" if node.name == "li" else text)
        if not paragraphs:
            fallback = _normalize_text(soup.get_text(" "))
            if fallback:
                paragraphs.append(fallback)
    if not paragraphs and plain_text:
        normalized = _normalize_text(plain_text)
        if normalized:
            paragraphs.append(normalized)
    return paragraphs


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
    title_text = _normalize_text(problem.title or "")
    if title_text:
        nodes.append(
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": title_text}],
            }
        )

    status_text = _normalize_text(problem.status or "")
    if status_text:
        nodes.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Status: {status_text}"}],
            }
        )

    for paragraph in _extract_paragraphs(problem.html, problem.plain_text):
        nodes.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": paragraph}],
            }
        )

    if problem.image:
        image_path = problem.image.get("local") or problem.image.get("original")
        if image_path:
            nodes.append(
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": f"Image: {image_path}"}],
                }
            )

    nodes.append(
        {
            "type": "paragraph",
            "content": [{"type": "text", "text": f"Source: {source_url}"}],
        }
    )

    if not nodes:
        nodes.append(
            {"type": "paragraph", "content": [{"type": "text", "text": "Imported task"}]}
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


def _build_content_map(
    chapters: List[ChapterRead],
    problems: List[InvlectRoomsProblemPayload],
) -> Dict[str, Any]:
    template = deepcopy(_load_template_map())
    objects = template.get("objects", [])
    placeholder_indices = [
        index
        for index, obj in enumerate(objects)
        if isinstance(obj, dict) and obj.get("file") == PLACEHOLDER_FILE
    ]

    chapter_slots = _select_placeholder_positions(len(placeholder_indices), len(chapters))
    mapped_indices = [
        placeholder_indices[position] for position in chapter_slots
    ]

    used_placeholder_indices = set(mapped_indices)
    chapter_positions: Dict[int, Dict[str, Any]] = {}

    for chapter, object_index in zip(chapters, mapped_indices):
        chapter_id = chapter.id
        if chapter_id is None:
            continue
        slot = objects[object_index]
        slot["id"] = -int(chapter_id)
        slot["file"] = COOL_STONE_ASSET
        slot["label"] = COOL_STONE_LABEL
        slot["scale"] = slot.get("scale", 0.22)
        slot["type"] = {
            "kind": "chapter",
            "associatedChapterID": chapter_id,
            "label": chapter.name,
        }
        chapter_positions[int(chapter_id)] = slot

    extra_chapters = chapters[len(mapped_indices) :]
    if extra_chapters:
        last_position = (
            objects[mapped_indices[-1]] if mapped_indices else {"x": 0, "y": 0}
        )
        base_x = last_position.get("x", 0)
        base_y = last_position.get("y", 0)
        offset = 180
        for offset_index, chapter in enumerate(extra_chapters, start=1):
            chapter_id = chapter.id
            if chapter_id is None:
                continue
            objects.append(
                {
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
            )
            chapter_positions[int(chapter_id)] = objects[-1]

    template["objects"] = [
        obj
        for index, obj in enumerate(objects)
        if not (
            isinstance(obj, dict)
            and obj.get("file") == PLACEHOLDER_FILE
            and index not in used_placeholder_indices
        )
    ]

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
    for index, (chapter, problem) in enumerate(zip(chapters, problems)):
        chapter_id = chapter.id
        if chapter_id is None:
            continue
        chapter_obj = chapter_positions.get(int(chapter_id))
        if not chapter_obj:
            continue
        image_payload = getattr(problem, "image", None) or {}
        original_url = (
            image_payload.get("original")
            if isinstance(image_payload, dict)
            else None
        )
        local_url = (
            image_payload.get("local")
            if isinstance(image_payload, dict)
            else None
        )
        image_url = original_url or local_url
        if not image_url:
            continue

        offset_x = 140 if index % 2 == 0 else -140
        offset_y = -140
        target_x = (chapter_obj.get("x") or 0) + offset_x
        target_y = (chapter_obj.get("y") or 0) + offset_y
        target_x = max(left_boundary + boundary_margin, min(right_boundary - boundary_margin, target_x))
        target_y = max(top_boundary + boundary_margin, min(bottom_boundary - boundary_margin, target_y))

        image_assets.append(
            {
                "id": next_id,
                "x": target_x,
                "y": target_y,
                "scale": 0.18,
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

    for index, problem in enumerate(payload.problems):
        problem_title = _normalize_text(problem.title or "") or f"Problem {index + 1}"
        requested_chapter_title = _normalize_text(problem.chapter_name or "")
        if requested_chapter_title:
            chapter_title = requested_chapter_title
        elif base_name:
            chapter_title = f"{base_name} — {problem_title}"
        else:
            chapter_title = problem_title

        chapter_request = ChapterCreate(
            name=chapter_title,
            description=f"Imported from {payload.url}",
            thumbnail_image="",
            org_id=course.org_id,
            course_id=course.id,
            xp_reward=0,
            coin_reward=0,
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

    if chapters:
        tab_store = dict(course.tab_store or {})
        tab_uuid = payload.tab_uuid or next(iter(tab_store), "tab-1")

        map_state = _build_content_map(chapters, list(payload.problems))
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
