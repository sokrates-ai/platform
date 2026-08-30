from typing import List

from fastapi import HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from src.db.task_log import TaskLog
from src.db.tasks import Course_Task
from src.db.trail_runs import TrailRun
from src.db.trail_steps import Assignment_Task_Complete, TrailStep
from src.db.users import PublicUser, User
from src.services.courses.tutor_room_selection import get_course_and_role_flags


class CourseProgressResetRequest(BaseModel):
    user_ids: List[int] = []


class CourseProgressResetUserResult(BaseModel):
    user_id: int
    user_uuid: str
    trail_steps: int
    task_markers: int
    trail_runs: int
    task_logs: int


class CourseProgressResetResult(BaseModel):
    reset_users: List[CourseProgressResetUserResult] = []


async def reset_course_progress(
    request: Request,
    course_uuid: str,
    user_ids: List[int],
    current_user: PublicUser,
    db_session: Session,
) -> CourseProgressResetResult:
    """
    Delete every progress record a set of users has in a course:
    trail steps, atomic task markers, task logs and the enrollment (trail run).

    Destructive and irreversible, so it is restricted to course admins and
    maintainers (tutors are deliberately excluded).
    """
    course, role_flags = get_course_and_role_flags(
        course_uuid, current_user, db_session
    )

    if not (role_flags["is_admin"] or role_flags["is_maintainer"]):
        raise HTTPException(
            status_code=403, detail="Course admin access required"
        )

    unique_user_ids = list(dict.fromkeys(user_ids))

    if not unique_user_ids:
        raise HTTPException(status_code=400, detail="No users selected")

    users = db_session.exec(
        select(User).where(User.id.in_(unique_user_ids))  # type: ignore[union-attr]
    ).all()
    users_by_id = {user.id: user for user in users}

    missing = [
        user_id for user_id in unique_user_ids if user_id not in users_by_id
    ]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Users not found: {', '.join(str(user_id) for user_id in missing)}",
        )

    # Task logs are not scoped by course, so they have to be narrowed down to
    # the tasks that belong to this course.
    course_task_ids = db_session.exec(
        select(Course_Task.task_id).where(Course_Task.course_id == course.id)
    ).all()

    results: List[CourseProgressResetUserResult] = []

    for user_id in unique_user_ids:
        user = users_by_id[user_id]

        trail_steps = db_session.exec(
            select(TrailStep).where(
                TrailStep.course_id == course.id,
                TrailStep.user_id == user_id,
            )
        ).all()

        task_markers = db_session.exec(
            select(Assignment_Task_Complete).where(
                Assignment_Task_Complete.course_id == course.id,
                Assignment_Task_Complete.user_id == user_id,
            )
        ).all()

        trail_runs = db_session.exec(
            select(TrailRun).where(
                TrailRun.course_id == course.id,
                TrailRun.user_id == user_id,
            )
        ).all()

        task_logs = []
        if course_task_ids:
            task_logs = db_session.exec(
                select(TaskLog).where(
                    TaskLog.user_uuid == user.user_uuid,
                    TaskLog.task_id.in_(course_task_ids),  # type: ignore[union-attr]
                )
            ).all()

        for row in [*trail_steps, *task_markers, *task_logs, *trail_runs]:
            db_session.delete(row)

        results.append(
            CourseProgressResetUserResult(
                user_id=user_id,
                user_uuid=user.user_uuid,
                trail_steps=len(trail_steps),
                task_markers=len(task_markers),
                trail_runs=len(trail_runs),
                task_logs=len(task_logs),
            )
        )

    db_session.commit()

    return CourseProgressResetResult(reset_users=results)
