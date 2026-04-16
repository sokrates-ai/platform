import asyncio
from datetime import datetime
from uuid import uuid4

from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.activities import (
    Activity,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.trail_steps import TrailStep
from src.db.users import User
from src.services.trail.trail import add_activity_to_trail


def _build_request() -> Request:
    return Request(
        {
            'type': 'http',
            'method': 'POST',
            'path': '/api/v1/trail/start_activity',
            'headers': [],
        }
    )


def _create_course_activity(session: Session) -> Activity:
    org = session.exec(
        select(Organization).where(Organization.slug == 'wayne')
    ).first()
    assert org is not None

    now = datetime.now().isoformat()
    course = Course(
        name=f'Trail Start {uuid4()}',
        description='',
        about='',
        learnings='',
        tags='',
        thumbnail_image='',
        public=False,
        org_id=org.id,
        course_uuid=f'course_{uuid4()}',
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)

    activity = Activity(
        name='Dynamic Page',
        activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
        content={},
        published=True,
        org_id=org.id,
        course_id=course.id,
        activity_uuid=f'activity_{uuid4()}',
        creation_date=now,
        update_date=now,
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    return activity


def test_start_activity_creates_incomplete_trail_step(session: Session):
    student = session.exec(select(User).where(User.username == 'robin')).first()
    assert student is not None

    activity = _create_course_activity(session)

    was_initial = asyncio.run(
        add_activity_to_trail(
            _build_request(),
            student,
            activity.activity_uuid,
            session,
            complete=False,
        )
    )

    trail_step = session.exec(
        select(TrailStep).where(
            TrailStep.activity_uuid == activity.activity_uuid,
            TrailStep.user_id == student.id,
        )
    ).first()

    assert was_initial is True
    assert trail_step is not None
    assert trail_step.complete is False


def test_start_activity_is_idempotent_for_existing_trail_step(session: Session):
    student = session.exec(select(User).where(User.username == 'robin')).first()
    assert student is not None

    activity = _create_course_activity(session)

    first_start = asyncio.run(
        add_activity_to_trail(
            _build_request(),
            student,
            activity.activity_uuid,
            session,
            complete=False,
        )
    )
    second_start = asyncio.run(
        add_activity_to_trail(
            _build_request(),
            student,
            activity.activity_uuid,
            session,
            complete=False,
        )
    )

    trail_steps = session.exec(
        select(TrailStep).where(
            TrailStep.activity_uuid == activity.activity_uuid,
            TrailStep.user_id == student.id,
        )
    ).all()

    assert first_start is True
    assert second_start is False
    assert len(trail_steps) == 1
    assert trail_steps[0].complete is False
