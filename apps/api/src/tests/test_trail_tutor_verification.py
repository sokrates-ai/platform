import asyncio
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.course_member_groups import (
    CourseMemberGroup,
    CourseMemberGroupMember,
)
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
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


def _create_student(session: Session, org_id: int, username: str) -> User:
    now = datetime.now().isoformat()
    student = User(
        username=username,
        first_name=username.capitalize(),
        last_name='Student',
        email=f'{username}@wayne.com',
        password='secret',
        user_uuid=f'user_{uuid4()}',
        creation_date=now,
        update_date=now,
    )
    session.add(student)
    session.commit()
    session.refresh(student)

    session.add(
        UserOrganization(
            user_id=student.id or 0,
            org_id=org_id,
            role_id=3,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()
    return student


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


def test_verify_trail_step_applies_to_group_members(session: Session, monkeypatch):
    tutor = session.exec(select(User).where(User.username == 'batman')).first()
    student = session.exec(select(User).where(User.username == 'robin')).first()

    assert tutor is not None
    assert student is not None

    course, trailstep = _create_course_trail_step(session, student, complete=True)
    org = session.exec(
        select(Organization).where(Organization.slug == 'wayne')
    ).first()
    assert org is not None

    teammate = _create_student(session, org.id, f'alfred_{uuid4().hex[:8]}')
    now = datetime.now().isoformat()

    teammate_trail = Trail(
        org_id=org.id,
        user_id=teammate.id,
        trail_uuid=f'trail_{uuid4()}',
        creation_date=now,
        update_date=now,
    )
    session.add(teammate_trail)
    session.commit()
    session.refresh(teammate_trail)

    teammate_trailrun = TrailRun(
        trail_id=teammate_trail.id,
        course_id=course.id,
        org_id=org.id,
        user_id=teammate.id,
        creation_date=now,
        update_date=now,
    )
    session.add(teammate_trailrun)
    session.commit()
    session.refresh(teammate_trailrun)

    teammate_step = TrailStep(
        complete=True,
        tutor_verified=TrailStepVerificationEnum.NONE,
        ai_verified=TrailStepVerificationEnum.NONE,
        grade='',
        trailrun_id=teammate_trailrun.id,
        trail_id=teammate_trail.id,
        activity_uuid=trailstep.activity_uuid,
        course_id=course.id,
        org_id=org.id,
        user_id=teammate.id,
        creation_date=now,
        update_date=now,
    )
    session.add(teammate_step)

    activity = Activity(
        name='Grouped Activity',
        activity_uuid=trailstep.activity_uuid,
        course_id=course.id,
        org_id=org.id,
        activity_type=ActivityTypeEnum.TYPE_DOCUMENT,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DOCUMENT_DOC,
        content={},
        published=True,
        creation_date=now,
        update_date=now,
    )
    session.add(activity)

    group = CourseMemberGroup(
        course_id=course.id,
        creation_date=now,
        update_date=now,
    )
    session.add(group)
    session.commit()
    session.refresh(group)

    session.add(
        CourseMemberGroupMember(
            group_id=group.id or 0,
            course_id=course.id,
            user_id=student.id,
            creation_date=now,
            update_date=now,
        )
    )
    session.add(
        CourseMemberGroupMember(
            group_id=group.id or 0,
            course_id=course.id,
            user_id=teammate.id,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()

    notifications: list[int] = []

    async def _fake_notify_student_activity_verified(**kwargs):
        notifications.append(kwargs['student'].id)

    monkeypatch.setattr(
        'src.services.trail.trail.notify_student_activity_verified',
        _fake_notify_student_activity_verified,
    )

    response = asyncio.run(
        verify_trail_step_by_tutor(
            _build_request(),
            trailstep.activity_uuid,
            student.user_uuid,
            TrailStepVerificationEnum.INCORRECT,
            tutor,
            session,
        )
    )

    session.refresh(trailstep)
    session.refresh(teammate_step)

    assert response['tutor_verified'] == TrailStepVerificationEnum.INCORRECT
    assert sorted(response['affected_user_ids']) == sorted([student.id, teammate.id])
    assert trailstep.tutor_verified == TrailStepVerificationEnum.INCORRECT
    assert teammate_step.tutor_verified == TrailStepVerificationEnum.INCORRECT
    assert sorted(notifications) == sorted([student.id, teammate.id])
