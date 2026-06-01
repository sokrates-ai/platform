from __future__ import annotations

from fastapi import HTTPException, Request
from sqlmodel import Session
from sqlmodel import select

from src.db.courses.activities import Activity
from src.db.trail_steps import TrailStep
from src.services.courses.activities.activities import get_activity
from src.services.courses.activities.workspaces import create_task_log
from src.services.trail.trail import (
    add_activity_to_trail,
    get_activity_task_markers_of_activity,
    mark_activity_task_complete,
)
from src.services.users.users import security_get_user_by_uuid


async def record_workspace_solution(
    request: Request,
    db_session: Session,
    *,
    correct: bool,
    task_id: int,
    activity_uuid: str,
    user_uuid: str,
) -> None:
    user = await security_get_user_by_uuid(request, db_session, uuid=user_uuid)
    if user is None:
        raise HTTPException(status_code=404, detail="User does not exist")

    activity: Activity = await get_activity(
        request=request,
        activity_uuid=activity_uuid,
        current_user=user,
        db_session=db_session,
    )

    tasks = activity.content.get("task_ids") or []
    if not tasks and activity.content.get("task_id") is not None:
        tasks = [activity.content["task_id"]]
    if not tasks:
        raise HTTPException(status_code=422, detail="Activity does not contain tasks")
    if task_id not in tasks:
        raise HTTPException(status_code=422, detail="Task is not part of the activity")

    await create_task_log(db_session, task_id, user_uuid, correct=correct)

    if not correct:
        return

    markers = await get_activity_task_markers_of_activity(
        request=request,
        user=user,
        activity_uuid=activity.activity_uuid,
        course_id=activity.course_id,
        org_id=activity.org_id,
        db_session=db_session,
    )
    marker_ids = [marker.task_id for marker in markers]

    await add_activity_to_trail(
        request=request,
        user=user,
        activity_uuid=activity.activity_uuid,
        db_session=db_session,
        complete=False,
    )

    if task_id not in marker_ids:
        await mark_activity_task_complete(
            request=request,
            user=user,
            task_id=task_id,
            activity_uuid=activity.activity_uuid,
            org_id=activity.org_id,
            course_id=activity.course_id,
            db_session=db_session,
        )

    marker_ids.append(task_id)

    everything_marked = True
    for current_task_id in tasks:
        if current_task_id not in marker_ids:
            everything_marked = False
            break

    if everything_marked:
        await add_activity_to_trail(
            request=request,
            user=user,
            activity_uuid=activity.activity_uuid,
            db_session=db_session,
            complete=True,
        )

        trailstep = db_session.exec(
            select(TrailStep).where(
                (TrailStep.activity_uuid == activity.activity_uuid)
                & (TrailStep.user_id == user.id)
            )
        ).first()

        if trailstep:
            data = dict(trailstep.data or {})
            if data.get("reward_task_id") is None:
                data["reward_task_id"] = task_id
                trailstep.data = data
                db_session.add(trailstep)
                db_session.commit()
