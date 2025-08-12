from sqlmodel import Session
from src.db.users import PublicUser, AnonymousUser
from fastapi import Request

async def check_activity_paid_access(
    request: Request,
    activity_id: int,
    user: PublicUser | AnonymousUser,
    db_session: Session,
) -> bool:
    return True

async def check_course_paid_access(
    course_id: int,
    user: PublicUser | AnonymousUser,
    db_session: Session,
) -> bool:
    return True
