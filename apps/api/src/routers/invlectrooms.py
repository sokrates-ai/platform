from typing import Any, Dict, List, Optional, Union

import re
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import AnyUrl, BaseModel
from starlette.concurrency import run_in_threadpool
from sqlmodel import Session, select
from bs4 import BeautifulSoup
from urllib.parse import urlsplit, unquote

from src.services.invlectrooms import (
    InvlectRoomsScrapeError,
    scrape_invlectrooms,
)
from src.core.events.database import get_db_session
from src.security.auth import get_current_user
from src.db.users import AnonymousUser, PublicUser
from src.db.courses.courses import Course
from src.db.courses.chapters import ChapterCreate, ChapterRead
from src.db.courses.activities import (
    ActivityCreate,
    ActivityRead,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.services.courses.chapters import create_chapter
from src.services.courses.activities.activities import create_activity


router = APIRouter()


class InvlectRoomsScrapeRequest(BaseModel):
    url: AnyUrl


class InvlectRoomsScrapeResponse(BaseModel):
    url: AnyUrl
    refresh_url: Optional[AnyUrl] = None
    refresh: Optional[Dict[str, Any]] = None


class InvlectRoomsProblemPayload(BaseModel):
    id: Optional[Union[int, str]] = None
    title: Optional[str] = None
    status: Optional[str] = None
    html: Optional[str] = None
    plain_text: Optional[str] = None
    image: Optional[Dict[str, Optional[str]]] = None


class InvlectRoomsApplyRequest(BaseModel):
    url: AnyUrl
    course_uuid: str
    tab_uuid: Optional[str] = None
    chapter_name: Optional[str] = None
    problems: List[InvlectRoomsProblemPayload]


class InvlectRoomsApplyResponse(BaseModel):
    chapter: Optional[ChapterRead] = None
    chapters: List[ChapterRead]
    activities: List[ActivityRead]


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _extract_paragraphs(html: Optional[str], plain_text: Optional[str]) -> List[str]:
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


def _guess_chapter_name(value: str) -> str:
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


def _build_activity_content(
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


@router.post("", response_model=InvlectRoomsScrapeResponse)
async def scrape(payload: InvlectRoomsScrapeRequest) -> Dict[str, Any]:
    try:
        return await run_in_threadpool(scrape_invlectrooms, str(payload.url))
    except InvlectRoomsScrapeError as error:
        status_code = error.status_code or 502
        raise HTTPException(status_code=status_code, detail=error.message) from error


@router.post("/apply", response_model=InvlectRoomsApplyResponse)
async def apply_import(
    payload: InvlectRoomsApplyRequest,
    request: Request,
    current_user: PublicUser | AnonymousUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> InvlectRoomsApplyResponse:
    if not payload.problems:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No problems were provided.",
        )

    course_statement = select(Course).where(Course.course_uuid == payload.course_uuid)
    course = db_session.exec(course_statement).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )

    base_name = payload.chapter_name or _guess_chapter_name(str(payload.url))
    chapters: List[ChapterRead] = []
    activities: List[ActivityRead] = []
    source_url = str(payload.url)
    for index, problem in enumerate(payload.problems):
        problem_title = _normalize_text(problem.title or "") or f"Problem {index + 1}"
        chapter_title = (
            f"{base_name} — {problem_title}" if base_name else problem_title
        )

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

        content = _build_activity_content(problem, source_url)

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
