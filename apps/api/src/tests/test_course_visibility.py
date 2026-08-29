import asyncio
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser, User
from src.services.courses.courses import get_course, get_courses_orgslug


def _request() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/"})


def _public_user(session: Session, username: str) -> PublicUser:
    user = session.exec(select(User).where(User.username == username)).one()
    return PublicUser.model_validate(user)


def _hidden_course(session: Session) -> Course:
    org = session.exec(
        select(Organization).where(Organization.slug == "wayne")
    ).one()
    now = datetime.now().isoformat()
    course = Course(
        name=f"Hidden course {uuid4()}",
        description="",
        about="",
        learnings="",
        tags="",
        thumbnail_image="",
        public=True,
        visible=False,
        org_id=org.id or 0,
        course_uuid=f"course_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)
    return course


def test_hidden_course_is_only_listed_for_course_managers(session: Session):
    course = _hidden_course(session)

    anonymous_courses = asyncio.run(
        get_courses_orgslug(
            _request(), AnonymousUser(), "wayne", session, limit=1000
        )
    )
    student_courses = asyncio.run(
        get_courses_orgslug(
            _request(), _public_user(session, "robin"), "wayne", session, limit=1000
        )
    )
    manager_courses = asyncio.run(
        get_courses_orgslug(
            _request(), _public_user(session, "batman"), "wayne", session, limit=1000
        )
    )

    assert course.course_uuid not in {item.course_uuid for item in anonymous_courses}
    assert course.course_uuid not in {item.course_uuid for item in student_courses}
    assert course.course_uuid in {item.course_uuid for item in manager_courses}


def test_hidden_course_direct_access_is_denied_to_students(session: Session):
    course = _hidden_course(session)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            get_course(
                _request(),
                course.course_uuid,
                _public_user(session, "robin"),
                session,
            )
        )

    assert exc_info.value.status_code == 404

    manager_course = asyncio.run(
        get_course(
            _request(), course.course_uuid, _public_user(session, "batman"), session
        )
    )
    assert manager_course.course_uuid == course.course_uuid
