import asyncio
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from src.db.courses.course_tabs import CourseTab
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep, TrailStepVerificationEnum
from src.db.trails import Trail
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.courses.analytics import get_course_analytics


def _build_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/courses/analytics",
            "headers": [],
        }
    )


def _now() -> str:
    return datetime.utcnow().isoformat()


def _create_student(session: Session, org_id: int, username: str) -> User:
    now = _now()
    user = User(
        username=username,
        first_name=username.capitalize(),
        last_name="Student",
        email=f"{username}@wayne.com",
        password="secret",
        user_uuid=f"user_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(
        UserOrganization(
            user_id=user.id or 0,
            org_id=org_id,
            role_id=3,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()
    return user


def _enroll(session: Session, course: Course, student: User) -> TrailRun:
    now = _now()
    trail = Trail(
        org_id=course.org_id,
        user_id=student.id,
        trail_uuid=f"trail_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(trail)
    session.commit()
    session.refresh(trail)
    run = TrailRun(
        trail_id=trail.id or 0,
        course_id=course.id or 0,
        org_id=course.org_id,
        user_id=student.id or 0,
        creation_date=now,
        update_date=now,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def _add_step(
    session: Session,
    course: Course,
    run: TrailRun,
    activity_uuid: str,
    *,
    complete: bool,
    verified: TrailStepVerificationEnum = TrailStepVerificationEnum.NONE,
    created_offset_days: int = 0,
    completed_offset_days: int | None = None,
    verified_offset_days: int | None = None,
) -> TrailStep:
    base = datetime.utcnow() + timedelta(days=created_offset_days)
    created = base.isoformat()
    completed = (
        (base + timedelta(days=completed_offset_days)).isoformat()
        if completed_offset_days is not None
        else None
    )
    verified_at = (
        (base + timedelta(days=verified_offset_days)).isoformat()
        if verified_offset_days is not None
        else None
    )
    step = TrailStep(
        complete=complete,
        tutor_verified=verified,
        ai_verified=TrailStepVerificationEnum.NONE,
        grade="",
        trailrun_id=run.id or 0,
        trail_id=run.trail_id,
        activity_uuid=activity_uuid,
        course_id=course.id or 0,
        org_id=course.org_id,
        user_id=run.user_id,
        creation_date=created,
        update_date=verified_at or completed or created,
        completed_date=completed,
        verified_date=verified_at,
    )
    session.add(step)
    session.commit()
    session.refresh(step)
    return step


def _create_course_fixture(session: Session) -> tuple[Course, User, User, User]:
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    batman = session.exec(select(User).where(User.username == "batman")).first()
    assert batman is not None
    now = _now()
    course_uuid = f"course_{uuid4()}"
    tab_one = f"tab-1{course_uuid}"
    tab_two = f"tab-2{course_uuid}"
    activity_one = f"activity_{uuid4()}"
    activity_two = f"activity_{uuid4()}"
    course = Course(
        name=f"Analytics {uuid4()}",
        description="",
        about="",
        learnings="",
        tags="",
        thumbnail_image="",
        public=False,
        org_id=org.id or 0,
        course_uuid=course_uuid,
        creation_date=now,
        update_date=now,
        tab_store={
            tab_one: {
                "content": {
                    "chapters": [
                        {
                            "name": "Intro",
                            "activities": [
                                {"activity_uuid": activity_one, "name": "Read basics"}
                            ],
                        }
                    ]
                }
            },
            tab_two: {
                "content": {
                    "chapters": [
                        {
                            "name": "Practice",
                            "activities": [
                                {"activity_uuid": activity_two, "name": "Solve task"}
                            ],
                        }
                    ]
                }
            },
        },
    )
    session.add(course)
    session.commit()
    session.refresh(course)
    session.add(
        CourseTab(
            tab_uuid=tab_one,
            course_id=course.id or 0,
            course_uuid=course.course_uuid,
            name="Week 1",
            position=0,
            visible=True,
            creation_date=now,
            update_date=now,
        )
    )
    session.add(
        CourseTab(
            tab_uuid=tab_two,
            course_id=course.id or 0,
            course_uuid=course.course_uuid,
            name="Week 2",
            position=1,
            visible=True,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()

    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    alfred = _create_student(session, org.id or 0, "analytics_alfred")
    robin_run = _enroll(session, course, robin)
    alfred_run = _enroll(session, course, alfred)

    _add_step(
        session,
        course,
        robin_run,
        activity_one,
        complete=True,
        verified=TrailStepVerificationEnum.CORRECT,
        completed_offset_days=1,
        verified_offset_days=2,
    )
    _add_step(
        session,
        course,
        alfred_run,
        activity_one,
        complete=True,
        completed_offset_days=9,
    )
    _add_step(
        session,
        course,
        robin_run,
        activity_two,
        complete=True,
        verified=TrailStepVerificationEnum.INCORRECT,
        completed_offset_days=1,
        verified_offset_days=4,
    )

    room_one = CourseRoom(
        name="Room One",
        course_id=course.id or 0,
        creation_date=now,
        update_date=now,
    )
    room_two = CourseRoom(
        name="Room Two",
        course_id=course.id or 0,
        creation_date=now,
        update_date=now,
    )
    session.add(room_one)
    session.add(room_two)
    session.commit()
    session.refresh(room_one)
    session.refresh(room_two)
    session.add(
        CourseRoomMember(
            room_id=room_one.id or 0,
            user_id=robin.id or 0,
            role=RoomRoleEnum.student,
            creation_date=now,
            update_date=now,
        )
    )
    session.add(
        CourseRoomMember(
            room_id=room_two.id or 0,
            user_id=alfred.id or 0,
            role=RoomRoleEnum.student,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()
    return course, batman, robin, alfred


def test_course_analytics_aggregates_whole_course_and_attention(session: Session):
    course, batman, _robin, _alfred = _create_course_fixture(session)

    result = asyncio.run(
        get_course_analytics(_build_request(), course.course_uuid, batman, session)
    )

    assert result["summary"]["student_count"] == 2
    assert result["summary"]["activity_count"] == 2
    assert result["summary"]["completed_count"] == 3
    assert result["summary"]["completion_rate"] == 75
    assert result["summary"]["pending_verification_count"] == 1
    assert result["summary"]["incorrect_count"] == 1
    assert [tab["name"] for tab in result["tabs"]] == ["Week 1", "Week 2"]
    assert result["tabs"][0]["completion_rate"] == 100
    assert result["tabs"][1]["completion_rate"] == 50
    assert {room["name"]: room["student_count"] for room in result["rooms"]} == {
        "Room One": 1,
        "Room Two": 1,
    }
    assert any(item["kind"] == "pending_verification" for item in result["attention"])
    assert any(item["kind"] == "incorrect" for item in result["attention"])


def test_course_analytics_requires_admin_or_maintainer(session: Session):
    course, _batman, robin, _alfred = _create_course_fixture(session)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_course_analytics(_build_request(), course.course_uuid, robin, session))

    assert exc.value.status_code == 403
