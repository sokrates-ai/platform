from sqlmodel import Session, select
from src.security.rbac.rbac import authorization_verify_if_user_is_author
from src.db.users import PublicUser, AnonymousUser
from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from fastapi import HTTPException, Request

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
