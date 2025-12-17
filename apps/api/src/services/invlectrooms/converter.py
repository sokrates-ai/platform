from __future__ import annotations

import re
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
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.services.courses.activities.activities import create_activity
from src.services.courses.chapters import create_chapter

from .schemas import (
    InvlectRoomsApplyRequest,
    InvlectRoomsApplyResponse,
    InvlectRoomsProblemPayload,
)


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

    return InvlectRoomsApplyResponse(
        chapter=chapters[0] if chapters else None,
        chapters=chapters,
        activities=activities,
    )
