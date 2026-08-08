from __future__ import annotations

from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from .constants import CHECKPOINT_IMAGE_PATTERNS, CHECKPOINT_LEVEL_KEYWORDS


def _text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    if "<" in value and ">" in value:
        value = BeautifulSoup(value, "html.parser").get_text(" ")
    return " ".join(value.split())


def _image_candidates(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [
            candidate
            for key in ("original", "local", "src")
            if isinstance(candidate := value.get(key), str)
        ]
    return []


def detect_checkpoint_level(problem: Dict[str, Any]) -> Optional[str]:
    fragments = [
        _text(problem.get(key))
        for key in (
            "title",
            "status",
            "body",
            "html",
            "plain_text",
            "plainText",
            "description",
            "text",
        )
    ]
    combined = " ".join(fragment for fragment in fragments if fragment).casefold()

    if combined and any(
        marker in combined for marker in ("schnabeltier", "checkpoint", "platypus")
    ):
        for level, keywords in CHECKPOINT_LEVEL_KEYWORDS.items():
            if any(keyword in combined for keyword in keywords):
                return level

    for candidate in _image_candidates(problem.get("img") or problem.get("image")):
        lowered = candidate.casefold()
        for level, patterns in CHECKPOINT_IMAGE_PATTERNS.items():
            if any(pattern in lowered for pattern in patterns):
                return level

    return None
