from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool
from sqlmodel import Session, select

from src.services.invlectrooms import (
    InvlectRoomsApplyRequest,
    InvlectRoomsApplyResponse,
    InvlectRoomsScrapeError,
    InvlectRoomsScrapeRequest,
    InvlectRoomsScrapeResponse,
    convert_invlectrooms_payload_to_course,
    scrape_invlectrooms,
)
from src.core.events.database import get_db_session
from src.security.auth import get_current_user
from src.db.users import AnonymousUser, PublicUser
from src.db.courses.courses import Course

router = APIRouter()


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

    return await convert_invlectrooms_payload_to_course(
        payload=payload,
        course=course,
        request=request,
        current_user=current_user,
        db_session=db_session,
    )
