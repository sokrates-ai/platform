import asyncio
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.task_log import TaskLog
from src.db.tasks import Course_Task, Task
from src.db.trail_runs import TrailRun
from src.db.trail_steps import Assignment_Task_Complete, TrailStep, TrailStepVerificationEnum
from src.db.trails import Trail
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.services.courses.progress_reset import reset_course_progress


def _build_request() -> Request:
    return Request(
        {
            'type': 'http',
            'method': 'POST',
            'path': '/api/v1/courses/progress/reset',
            'headers': [],
        }
    )


def _get_org(session: Session) -> Organization:
    org = session.exec(
        select(Organization).where(Organization.slug == 'wayne')
    ).first()
    assert org is not None
    return org


def _create_user(session: Session, org_id: int, username: str, role_id: int) -> User:
    now = datetime.now().isoformat()
    user = User(
        username=username,
        first_name=username.capitalize(),
        last_name='Tester',
        email=f'{username}@wayne.com',
        password='secret',
        user_uuid=f'user_{uuid4()}',
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
            role_id=role_id,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()
    return user


def _create_course(session: Session, org_id: int) -> Course:
    now = datetime.now().isoformat()
    course = Course(
        name=f'Progress Reset {uuid4()}',
        description='',
        about='',
        learnings='',
        tags='',
        thumbnail_image='',
        public=False,
        org_id=org_id,
        course_uuid=f'course_{uuid4()}',
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)
    return course


def _seed_progress(session: Session, course: Course, user: User) -> None:
    """Give `user` one trail run, one trail step, one task marker and one task log."""
    now = datetime.now().isoformat()

    trail = session.exec(
        select(Trail).where(Trail.org_id == course.org_id, Trail.user_id == user.id)
    ).first()
    if trail is None:
        trail = Trail(
            org_id=course.org_id,
            user_id=user.id,
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
        org_id=course.org_id,
        user_id=user.id,
        creation_date=now,
        update_date=now,
    )
    session.add(trailrun)
    session.commit()
    session.refresh(trailrun)

    task = Task(title='Reset me')
    session.add(task)
    session.commit()
    session.refresh(task)

    session.add(Course_Task(course_id=course.id, task_id=task.id))
    session.commit()

    activity_uuid = f'activity_{uuid4()}'

    session.add(
        TrailStep(
            complete=True,
            tutor_verified=TrailStepVerificationEnum.NONE,
            ai_verified=TrailStepVerificationEnum.NONE,
            grade='',
            trailrun_id=trailrun.id,
            trail_id=trail.id,
            activity_uuid=activity_uuid,
            course_id=course.id,
            org_id=course.org_id,
            user_id=user.id,
            creation_date=now,
            update_date=now,
        )
    )
    session.add(
        Assignment_Task_Complete(
            complete=True,
            task_id=task.id,
            activity_uuid=activity_uuid,
            course_id=course.id,
            org_id=course.org_id,
            user_id=user.id,
        )
    )
    session.add(
        TaskLog(task_id=task.id, user_uuid=user.user_uuid, date=now, correct=True)
    )
    session.commit()


def _progress_counts(session: Session, course: Course, user: User) -> dict:
    course_task_ids = session.exec(
        select(Course_Task.task_id).where(Course_Task.course_id == course.id)
    ).all()
    task_logs = []
    if course_task_ids:
        task_logs = session.exec(
            select(TaskLog).where(
                TaskLog.user_uuid == user.user_uuid,
                TaskLog.task_id.in_(course_task_ids),  # type: ignore[union-attr]
            )
        ).all()

    return {
        'trail_steps': len(
            session.exec(
                select(TrailStep).where(
                    TrailStep.course_id == course.id, TrailStep.user_id == user.id
                )
            ).all()
        ),
        'task_markers': len(
            session.exec(
                select(Assignment_Task_Complete).where(
                    Assignment_Task_Complete.course_id == course.id,
                    Assignment_Task_Complete.user_id == user.id,
                )
            ).all()
        ),
        'trail_runs': len(
            session.exec(
                select(TrailRun).where(
                    TrailRun.course_id == course.id, TrailRun.user_id == user.id
                )
            ).all()
        ),
        'task_logs': len(task_logs),
    }


def test_reset_course_progress_deletes_only_targeted_user(session: Session):
    org = _get_org(session)
    admin = session.exec(select(User).where(User.username == 'batman')).first()
    assert admin is not None

    course = _create_course(session, org.id or 0)
    target = _create_user(session, org.id or 0, f'reset_target_{uuid4().hex[:6]}', 3)
    control = _create_user(session, org.id or 0, f'reset_control_{uuid4().hex[:6]}', 3)

    _seed_progress(session, course, target)
    _seed_progress(session, course, control)

    result = asyncio.run(
        reset_course_progress(
            _build_request(), course.course_uuid, [target.id or 0], admin, session
        )
    )

    assert len(result.reset_users) == 1
    summary = result.reset_users[0]
    assert summary.user_id == target.id
    assert summary.trail_steps == 1
    assert summary.task_markers == 1
    assert summary.trail_runs == 1
    assert summary.task_logs == 1

    assert _progress_counts(session, course, target) == {
        'trail_steps': 0,
        'task_markers': 0,
        'trail_runs': 0,
        'task_logs': 0,
    }
    assert _progress_counts(session, course, control) == {
        'trail_steps': 1,
        'task_markers': 1,
        'trail_runs': 1,
        'task_logs': 1,
    }


def test_reset_course_progress_leaves_other_courses_untouched(session: Session):
    org = _get_org(session)
    admin = session.exec(select(User).where(User.username == 'batman')).first()
    assert admin is not None

    course = _create_course(session, org.id or 0)
    other_course = _create_course(session, org.id or 0)
    target = _create_user(session, org.id or 0, f'reset_multi_{uuid4().hex[:6]}', 3)

    _seed_progress(session, course, target)
    _seed_progress(session, other_course, target)

    asyncio.run(
        reset_course_progress(
            _build_request(), course.course_uuid, [target.id or 0], admin, session
        )
    )

    assert _progress_counts(session, other_course, target) == {
        'trail_steps': 1,
        'task_markers': 1,
        'trail_runs': 1,
        'task_logs': 1,
    }


def test_reset_course_progress_rejects_students_and_tutors(session: Session):
    org = _get_org(session)
    course = _create_course(session, org.id or 0)
    target = _create_user(session, org.id or 0, f'reset_victim_{uuid4().hex[:6]}', 3)
    _seed_progress(session, course, target)

    student = session.exec(select(User).where(User.username == 'robin')).first()
    assert student is not None

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            reset_course_progress(
                _build_request(), course.course_uuid, [target.id or 0], student, session
            )
        )
    assert exc.value.status_code == 403

    tutor = _create_user(session, org.id or 0, f'reset_tutor_{uuid4().hex[:6]}', 4)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            reset_course_progress(
                _build_request(), course.course_uuid, [target.id or 0], tutor, session
            )
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == 'Course admin access required'

    # Nothing was deleted.
    assert _progress_counts(session, course, target)['trail_steps'] == 1


def test_reset_course_progress_requires_users(session: Session):
    org = _get_org(session)
    admin = session.exec(select(User).where(User.username == 'batman')).first()
    assert admin is not None
    course = _create_course(session, org.id or 0)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            reset_course_progress(
                _build_request(), course.course_uuid, [], admin, session
            )
        )
    assert exc.value.status_code == 400


def test_reset_course_progress_unknown_user(session: Session):
    org = _get_org(session)
    admin = session.exec(select(User).where(User.username == 'batman')).first()
    assert admin is not None
    course = _create_course(session, org.id or 0)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            reset_course_progress(
                _build_request(), course.course_uuid, [999999], admin, session
            )
        )
    assert exc.value.status_code == 404
