from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from bs4 import BeautifulSoup, NavigableString, Tag


DEFAULT_TIMEOUT = 15.0
DEFAULT_USER_AGENT = "invlect-parser/0.1 (+https://invlectrooms)"
MAX_DEPTH = 3
MAX_CHILDREN = 15


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


def _node_to_dict(
    node: Any,
    *,
    depth: int,
    max_depth: int,
    max_children: int,
) -> Optional[Dict[str, Any]]:
    if isinstance(node, NavigableString):
        text = str(node).strip()
        if not text:
            return None
        return {"text": text}

    if not isinstance(node, Tag):
        return None

    node_repr: Dict[str, Any] = {"tag": node.name}

    attrs = _clean_attributes(node.attrs)
    if attrs:
        node_repr["attributes"] = attrs

    if depth >= max_depth:
        text = node.get_text(separator=" ", strip=True)
        if text:
            node_repr["text"] = text
        return node_repr

    children = []
    for child in node.children:
        if len(children) >= max_children:
            node_repr["truncated_children"] = True
            break
        child_repr = _node_to_dict(
            child,
            depth=depth + 1,
            max_depth=max_depth,
            max_children=max_children,
        )
        if child_repr is not None:
            children.append(child_repr)

    if children:
        node_repr["children"] = children
    else:
        text = node.get_text(separator=" ", strip=True)
        if text:
            node_repr["text"] = text

    return node_repr


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


def extract_structure(
    html: str,
    *,
    max_depth: int = MAX_DEPTH,
    max_children: int = MAX_CHILDREN,
) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    root: Tag | BeautifulSoup | None = soup.body or soup.html or soup

    root_repr = _node_to_dict(
        root,
        depth=0,
        max_depth=max_depth,
        max_children=max_children,
    )

    return root_repr or {}


def scrape_invlectrooms(
    url: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    user_agent: str = DEFAULT_USER_AGENT,
    max_depth: int = MAX_DEPTH,
    max_children: int = MAX_CHILDREN,
) -> Dict[str, Any]:
    html = fetch_html(url, timeout=timeout, user_agent=user_agent)
    structure = extract_structure(
        html,
        max_depth=max_depth,
        max_children=max_children,
    )

    return {
        "url": url,
        "structure": structure,
    }
