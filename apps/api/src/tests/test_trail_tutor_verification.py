import asyncio
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep, TrailStepVerificationEnum
from src.db.trails import Trail
from src.db.users import User
from src.services.trail.trail import verify_trail_step_by_tutor


def _build_request() -> Request:
    return Request(
        {
            'type': 'http',
            'method': 'POST',
            'path': '/api/v1/trail/verify_step',
            'headers': [],
        }
    )


def _create_course_trail_step(
    session: Session,
    student: User,
    *,
    complete: bool,
) -> tuple[Course, TrailStep]:
    org = session.exec(
        select(Organization).where(Organization.slug == 'wayne')
    ).first()
    assert org is not None

    now = datetime.now().isoformat()
    course = Course(
        name=f'Tutor Verification {uuid4()}',
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

    trail = Trail(
        org_id=org.id,
        user_id=student.id,
        trail_uuid=f'trail_{uuid4()}',
        creation_date=now,
        update_date=now,
    )
    session.add(trail)
    session.commit()
    session.refresh(trail)

    trailrun = TrailRun(
        trail_id=trail.id,
        course_id=course.id,
        org_id=org.id,
        user_id=student.id,
        creation_date=now,
        update_date=now,
    )
    session.add(trailrun)
    session.commit()
    session.refresh(trailrun)

    trailstep = TrailStep(
        complete=complete,
        tutor_verified=TrailStepVerificationEnum.NONE,
        ai_verified=TrailStepVerificationEnum.NONE,
        grade='',
        trailrun_id=trailrun.id,
        trail_id=trail.id,
        activity_uuid=f'activity_{uuid4()}',
        course_id=course.id,
        org_id=org.id,
        user_id=student.id,
        creation_date=now,
        update_date=now,
    )
    session.add(trailstep)
    session.commit()
    session.refresh(trailstep)

    return course, trailstep


def test_verify_trail_step_requires_complete_true(session: Session):
    tutor = session.exec(select(User).where(User.username == 'batman')).first()
    student = session.exec(select(User).where(User.username == 'robin')).first()

    assert tutor is not None
    assert student is not None

    _, trailstep = _create_course_trail_step(session, student, complete=False)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            verify_trail_step_by_tutor(
                _build_request(),
                trailstep.activity_uuid,
                student.user_uuid,
                TrailStepVerificationEnum.CORRECT,
                tutor,
                session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == 'Only completed trail steps can be verified'

    session.refresh(trailstep)
    assert trailstep.tutor_verified == TrailStepVerificationEnum.NONE


def test_verify_trail_step_updates_completed_steps(session: Session):
    tutor = session.exec(select(User).where(User.username == 'batman')).first()
    student = session.exec(select(User).where(User.username == 'robin')).first()

    assert tutor is not None
    assert student is not None

    _, trailstep = _create_course_trail_step(session, student, complete=True)

    response = asyncio.run(
        verify_trail_step_by_tutor(
            _build_request(),
            trailstep.activity_uuid,
            student.user_uuid,
            TrailStepVerificationEnum.CORRECT,
            tutor,
            session,
        )
    )

    session.refresh(trailstep)

    assert response['tutor_verified'] == TrailStepVerificationEnum.CORRECT
    assert trailstep.tutor_verified == TrailStepVerificationEnum.CORRECT
