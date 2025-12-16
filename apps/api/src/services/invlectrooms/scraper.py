from __future__ import annotations

import re
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag


DEFAULT_TIMEOUT = 15.0
DEFAULT_USER_AGENT = "invlect-parser/0.1 (+https://invlectrooms)"
HPI_BASE_URL = "https://hpi.de"

BLOCK_LEVEL_TAGS = {
    "article",
    "aside",
    "blockquote",
    "div",
    "figure",
    "figcaption",
    "footer",
    "header",
    "li",
    "main",
    "nav",
    "p",
    "pre",
    "section",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
}

SKIP_TAGS = {"script", "style", "noscript", "template", "head"}
INLINE_BREAK_TAGS = {"br", "hr"}
REFRESH_PATH_PATTERN = re.compile(
    r'["\'](?P<path>/friedrich/docs/InvLectRooms/[^"\']+/riddlegroups/room/\d+/refresh)["\']'
)
FRIEDRICH_PATH_PREFIX = "/friedrich/docs/InvLectRooms/"
FRIEDRICH_GENERIC_PATH_PATTERN = re.compile(
    r'(/friedrich/docs/InvLectRooms/[^\s"\'<>]+)'
)

IMAGE_EXTENSIONS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
)


@dataclass(eq=False)
class InvlectRoomsScrapeError(Exception):
    """Raised when the InvlectRooms scraper fails."""

    message: str
    status_code: Optional[int] = None

    def __str__(self) -> str:  # pragma: no cover - human readable formatting
        return self.message


def _clean_attributes(attrs: Dict[str, Any]) -> Dict[str, Any]:
    serializable: Dict[str, Any] = {}
    for key, value in attrs.items():
        if value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            serializable[key] = value
        elif isinstance(value, list):
            serializable[key] = [
                item for item in value if isinstance(item, (str, int, float, bool))
            ]
        else:
            serializable[key] = str(value)
    return serializable


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _build_problem_item(text: str, *, tag: Optional[str]) -> Dict[str, Any]:
    item: Dict[str, Any] = {"type": "problem", "text": text}
    if tag:
        item["tag"] = tag
    return item


def _add_hpi_prefix(value: str) -> str:
    parsed = urlparse(value)
    path = parsed.path or ""
    if parsed.params:
        path = f"{path};{parsed.params}"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    if parsed.fragment:
        path = f"{path}#{parsed.fragment}"
    return urljoin(HPI_BASE_URL, path)


def _resolve_url(value: str, base_url: str) -> str:
    absolute = urljoin(base_url, value)
    return _add_hpi_prefix(absolute)


def _resolve_srcset(value: str, base_url: str) -> str:
    entries: List[str] = []
    for candidate in value.split(","):
        candidate = candidate.strip()
        if not candidate:
            continue
        parts = candidate.split()
        if not parts:
            continue
        resolved_url = _resolve_url(parts[0], base_url)
        if len(parts) > 1:
            entries.append(" ".join([resolved_url, " ".join(parts[1:])]))
        else:
            entries.append(resolved_url)
    return ", ".join(entries)


def _replace_relative_prefix(value: str) -> str:
    if value.startswith(FRIEDRICH_PATH_PREFIX):
        return _add_hpi_prefix(value)
    return FRIEDRICH_GENERIC_PATH_PATTERN.sub(
        lambda match: _add_hpi_prefix(match.group(1)),
        value,
    )


def _normalize_refresh_payload(data: Any) -> Any:
    if isinstance(data, dict):
        return {key: _normalize_refresh_payload(value) for key, value in data.items()}
    if isinstance(data, list):
        return [_normalize_refresh_payload(item) for item in data]
    if isinstance(data, str):
        return _replace_relative_prefix(data)
    return data


def _collect_image_urls_from_refresh(data: Any) -> Set[str]:
    urls: Set[str] = set()
    if isinstance(data, dict):
        for value in data.values():
            urls.update(_collect_image_urls_from_refresh(value))
    elif isinstance(data, list):
        for value in data:
            urls.update(_collect_image_urls_from_refresh(value))
    elif isinstance(data, str):
        urls.update(_extract_image_urls_from_string(data))
    return urls


def _extract_image_urls_from_string(value: str) -> Set[str]:
    urls: Set[str] = set()
    if "<img" in value.lower():
        soup = BeautifulSoup(value, "html.parser")
        for img in soup.find_all("img"):
            src = img.get("src")
            if isinstance(src, str):
                urls.add(src)
            srcset = img.get("srcset")
            if isinstance(srcset, str):
                for entry in srcset.split(","):
                    entry = entry.strip()
                    if not entry:
                        continue
                    url = entry.split()[0]
                    if url:
                        urls.add(url)
    for match in re.findall(r"https?://[^\s\"']+", value):
        if _is_image_url(match):
            urls.add(match)
    stripped = value.strip()
    if _is_image_url(stripped):
        urls.add(stripped)
    return urls


def _is_image_url(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path or ""
    return any(path.lower().endswith(ext) for ext in IMAGE_EXTENSIONS)


def _get_content_directory() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "content"
        if candidate.exists() and candidate.is_dir():
            return candidate
    raise InvlectRoomsScrapeError("Content directory not found")


def _ensure_image_cached(
    url: str,
    *,
    timeout: float,
    user_agent: str,
) -> str:
    content_dir = _get_content_directory()
    target_dir = content_dir / "invlectrooms"
    target_dir.mkdir(parents=True, exist_ok=True)

    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix if parsed.path else ""
    if not suffix or len(suffix) > 10:
        suffix = ".bin"
    filename = f"{sha256(url.encode('utf-8')).hexdigest()}{suffix.lower()}"
    file_path = target_dir / filename

    if not file_path.exists():
        headers = {"User-Agent": user_agent}
        try:
            response = requests.get(url, timeout=timeout, headers=headers)
            response.raise_for_status()
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response else None
            raise InvlectRoomsScrapeError(
                f"Request to {url} failed with status code {status_code}",
                status_code=status_code,
            ) from exc
        except requests.RequestException as exc:
            raise InvlectRoomsScrapeError(f"Request to {url} failed: {exc}") from exc

        file_path.write_bytes(response.content)

    return f"/content/invlectrooms/{filename}"


def _cache_images(
    image_urls: Set[str],
    *,
    timeout: float,
    user_agent: str,
) -> Dict[str, str]:
    cache: Dict[str, str] = {}
    for url in sorted(image_urls):
        try:
            cache[url] = _ensure_image_cached(url, timeout=timeout, user_agent=user_agent)
        except InvlectRoomsScrapeError:
            raise
    return cache


def _transform_refresh_data(data: Any, image_map: Dict[str, str]) -> Any:
    if isinstance(data, dict):
        return {key: _transform_refresh_data(value, image_map) for key, value in data.items()}
    if isinstance(data, list):
        return [_transform_refresh_data(value, image_map) for value in data]
    if isinstance(data, str):
        transformed = _transform_string_value(data, image_map)
        return transformed
    return data


def _transform_string_value(value: str, image_map: Dict[str, str]) -> Any:
    if value in image_map:
        return {"original": value, "local": image_map[value]}
    if "<img" in value.lower():
        updated = _transform_html_fragment(value, image_map)
        if updated is not None:
            return updated
    return value


def _transform_html_fragment(html: str, image_map: Dict[str, str]) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    modified = False

    for img in soup.find_all("img"):
        src = img.get("src")
        if isinstance(src, str) and src in image_map:
            img["data-original-src"] = src
            img["src"] = image_map[src]
            modified = True
        srcset = img.get("srcset")
        if isinstance(srcset, str):
            changed, new_srcset = _replace_srcset(srcset, image_map)
            if changed:
                img["data-original-srcset"] = srcset
                img["srcset"] = new_srcset
                modified = True

    if not modified:
        return None

    return "".join(str(child) for child in soup.contents)


def _replace_srcset(srcset: str, image_map: Dict[str, str]) -> Tuple[bool, str]:
    entries: List[str] = []
    changed = False
    for candidate in srcset.split(","):
        candidate = candidate.strip()
        if not candidate:
            continue
        parts = candidate.split()
        url = parts[0]
        descriptor = " ".join(parts[1:]) if len(parts) > 1 else ""
        if url in image_map:
            url = image_map[url]
            changed = True
        entry = f"{url} {descriptor}".strip()
        entries.append(entry)
    return changed, ", ".join(entries)


def _build_infix_item(image: Tag, *, base_url: str) -> Dict[str, Any]:
    attributes = _clean_attributes(image.attrs)
    item: Dict[str, Any] = {"type": "infix"}

    src = attributes.pop("src", None)
    if isinstance(src, str):
        item["src"] = _resolve_url(src, base_url)
    srcset = attributes.pop("srcset", None)
    if isinstance(srcset, str):
        item["srcset"] = _resolve_srcset(srcset, base_url)

    for key in ("alt", "title"):
        if key in attributes:
            item[key] = attributes.pop(key)

    for key, value in list(attributes.items()):
        if isinstance(value, str):
            attributes[key] = _replace_relative_prefix(value)
        elif isinstance(value, list):
            attributes[key] = [
                _replace_relative_prefix(element) if isinstance(element, str) else element
                for element in value
            ]

    if attributes:
        item["attributes"] = attributes

    return item


def _extract_items(
    node: Tag | BeautifulSoup,
    items: List[Dict[str, Any]],
    *,
    current_block_tag: Optional[str],
    base_url: str,
    image_urls: Set[str],
) -> None:
    text_buffer: List[str] = []

    def flush() -> None:
        if not text_buffer:
            return
        text = _normalize_whitespace(" ".join(text_buffer))
        text_buffer.clear()
        if not text:
            return
        items.append(_build_problem_item(text, tag=current_block_tag))

    for child in node.children:
        if isinstance(child, NavigableString):
            text = _normalize_whitespace(str(child))
            if text:
                text_buffer.append(text)
            continue

        if not isinstance(child, Tag):
            continue

        if child.name in SKIP_TAGS:
            continue

        if child.name in INLINE_BREAK_TAGS:
            text_buffer.append(" ")
            continue

        if child.name == "img":
            flush()
            infix = _build_infix_item(child, base_url=base_url)
            items.append(infix)
            src = infix.get("src")
            if isinstance(src, str):
                image_urls.add(src)
            srcset = infix.get("srcset")
            if isinstance(srcset, str):
                for candidate in srcset.split(","):
                    candidate = candidate.strip()
                    if not candidate:
                        continue
                    url = candidate.split()[0]
                    if url:
                        image_urls.add(url)
            continue

        is_block = child.name in BLOCK_LEVEL_TAGS
        if is_block:
            flush()
            _extract_items(
                child,
                items,
                current_block_tag=child.name,
                base_url=base_url,
                image_urls=image_urls,
            )
            flush()
        else:
            _extract_items(
                child,
                items,
                current_block_tag=current_block_tag,
                base_url=base_url,
                image_urls=image_urls,
            )

    flush()


def _extract_refresh_path(html: str) -> Optional[str]:
    match = REFRESH_PATH_PATTERN.search(html)
    if not match:
        return None
    return match.group("path")


def _fetch_refresh_data(
    refresh_url: str,
    *,
    timeout: float,
    user_agent: str,
) -> Dict[str, Any]:
    headers = {"User-Agent": user_agent}
    try:
        response = requests.get(refresh_url, timeout=timeout, headers=headers)
        response.raise_for_status()
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response else None
        raise InvlectRoomsScrapeError(
            f"Request to {refresh_url} failed with status code {status_code}",
            status_code=status_code,
        ) from exc
    except requests.RequestException as exc:
        raise InvlectRoomsScrapeError(f"Request to {refresh_url} failed: {exc}") from exc

    try:
        return response.json()
    except ValueError as exc:
        raise InvlectRoomsScrapeError(
            f"Response from {refresh_url} is not valid JSON"
        ) from exc


def fetch_html(url: str, *, timeout: float, user_agent: str) -> str:
    try:
        response = requests.get(url, timeout=timeout, headers={"User-Agent": user_agent})
        response.raise_for_status()
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response else None
        raise InvlectRoomsScrapeError(
            f"Request to {url} failed with status code {status_code}",
            status_code=status_code,
        ) from exc
    except requests.RequestException as exc:
        raise InvlectRoomsScrapeError(f"Request to {url} failed: {exc}") from exc

    return response.text


def extract_semantic_blocks(html: str, *, base_url: str) -> Tuple[List[Dict[str, Any]], Set[str]]:
    soup = BeautifulSoup(html, "lxml")
    root: Tag | BeautifulSoup | None = soup.body or soup.html or soup

    if root is None:
        return [], set()

    items: List[Dict[str, Any]] = []
    image_urls: Set[str] = set()
    _extract_items(
        root,
        items,
        current_block_tag=None,
        base_url=base_url,
        image_urls=image_urls,
    )
    return items, image_urls


def scrape_invlectrooms(
    url: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    user_agent: str = DEFAULT_USER_AGENT,
    max_depth: int = 3,
    max_children: int = 15,
) -> Dict[str, Any]:
    html = fetch_html(url, timeout=timeout, user_agent=user_agent)
    # max_depth and max_children are accepted for backwards compatibility but no longer used.
    _ = (max_depth, max_children)
    _, html_image_urls = extract_semantic_blocks(html, base_url=url)
    refresh_data: Optional[Dict[str, Any]] = None
    refresh_path = _extract_refresh_path(html)
    refresh_url: Optional[str] = None
    if refresh_path:
        refresh_url = _add_hpi_prefix(urljoin(url, refresh_path))
        refresh_data = _fetch_refresh_data(
            refresh_url, timeout=timeout, user_agent=user_agent
        )
        refresh_data = _normalize_refresh_payload(refresh_data)
    else:
        refresh_data = None

    image_urls: Set[str] = set(html_image_urls)
    if refresh_data is not None:
        image_urls.update(_collect_image_urls_from_refresh(refresh_data))

    image_map: Dict[str, str] = {}
    if image_urls:
        image_map = _cache_images(image_urls, timeout=timeout, user_agent=user_agent)

    if refresh_data is not None:
        refresh_data = _transform_refresh_data(refresh_data, image_map)

    if image_map:
        image_mappings = [
            {"original": original, "local": local}
            for original, local in sorted(image_map.items())
        ]
        if isinstance(refresh_data, dict):
            refresh_data["_images"] = image_mappings
        elif refresh_data is None:
            refresh_data = {"_images": image_mappings}

    return {
        "url": url,
        "refresh_url": refresh_url,
        "refresh": refresh_data,
    }
