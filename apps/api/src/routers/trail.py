from src.db.courses.activities import Activity
from src.services.courses.activities.activities import get_activity
from src.services.users.users import security_get_user_by_uuid
from src.services.courses.activities.workspaces import create_task_log
from fastapi import APIRouter, Depends, Request
from src.core.events.database import get_db_session
from src.db.trails import TrailCreate, TrailRead
from src.security.auth import get_current_user
from src.db.trail_steps import TrailStep, TrailStepVerificationEnum
from pydantic import BaseModel
from sqlmodel import select
from src.services.trail.trail import (
    Trail,
    add_activity_to_trail,
    add_course_to_trail,
    create_user_trail,
    get_activity_task_markers_of_activity,
    get_user_trails,
    get_user_trail_with_orgid,
    mark_activity_task_complete,
    remove_course_from_trail,
    verify_trail_step_by_tutor,
)


router = APIRouter()


@router.post('/start')
async def api_start_trail(
    request: Request,
    trail_object: TrailCreate,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Trail:
    """
    Start trail
    """
    return await create_user_trail(request, user, trail_object, db_session)


@router.get('/')
async def api_get_user_trail(
    request: Request,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> TrailRead:
    """
    Get a user trails
    """
    return await get_user_trails(request, user=user, db_session=db_session)


@router.get('/org/{org_id}/trail')
async def api_get_trail_by_org_id(
    request: Request,
    org_id: int,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> TrailRead:
    """
    Get a user trails using org slug
    """
    return await get_user_trail_with_orgid(
        request, user, org_id=org_id, db_session=db_session
    )


@router.post('/add_course/{course_uuid}')
async def api_add_course_to_trail(
    request: Request,
    course_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> TrailRead:
    """
    Add Course to trail
    """
    return await add_course_to_trail(request, user, course_uuid, db_session)


@router.delete('/remove_course/{course_uuid}')
async def api_remove_course_to_trail(
    request: Request,
    course_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> TrailRead:
    """
    Remove Course from trail
    """
    return await remove_course_from_trail(
        request, user, course_uuid, db_session
    )


class TrailActivityResponse(BaseModel):
    was_initial: bool


class TrailStepTutorVerificationRequest(BaseModel):
    activity_uuid: str
    student_uuid: str
    status: TrailStepVerificationEnum


@router.post('/add_activity/{activity_uuid}')
async def api_add_activity_to_trail(
    request: Request,
    activity_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> TrailActivityResponse:
    """
    Add Course to trail
    """
    was_initial = await add_activity_to_trail(
        request, user, activity_uuid, db_session
    )
    return TrailActivityResponse(was_initial=bool(was_initial))


@router.post('/start_activity/{activity_uuid}')
async def api_start_activity_in_trail(
    request: Request,
    activity_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> TrailActivityResponse:
    """
    Insert a trail step for an activity without marking it complete.
    """
    was_initial = await add_activity_to_trail(
        request,
        user,
        activity_uuid,
        db_session,
        complete=False,
    )
    return TrailActivityResponse(was_initial=bool(was_initial))


@router.post('/verify_step')
async def api_verify_trail_step(
    request: Request,
    body: TrailStepTutorVerificationRequest,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> dict:
    """
    Verify a student's trail step.
    """
    return await verify_trail_step_by_tutor(
        request,
        body.activity_uuid,
        body.student_uuid,
        body.status,
        user,
        db_session,
    )


class WSRecordSolution(BaseModel):
    activity_uuid: str
    user_uuid: str
    task_id: int
    correct: bool




@router.post('/ws_record_solution')
async def api_ws_record_solution(
    request: Request,
    body: WSRecordSolution,
    # user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> None:
    """
    Add Course to trail from WS
    """

    print('WSMarkComplete called: ', body)

    user_uuid = body.user_uuid
    user = await security_get_user_by_uuid(request, db_session, uuid=user_uuid)
    if user is None:
        raise Exception('illegal user')

    # TODO: add atomic progress.

    # Check if activity contains multiple tasks
    activity: Activity = await get_activity(
        request=request,
        activity_uuid=body.activity_uuid,
        current_user=user,
        db_session=db_session,
    )

    print(f'activity: {activity.content}')

    tasks = activity.content.get('task_ids', None)
    if tasks is None or len(tasks) == 0:
        raise Exception('activity does not contain tasks')
    print(f'activity tasks: {tasks}')

    task_found = False
    for task_id in tasks:
        if task_id == body.task_id:
            task_found = True
            break

    if not task_found:
        raise Exception('task not found in activity')

    # Add to task log of the user.
    await create_task_log(db_session, task_id, user_uuid, correct=body.correct)

    # Only add this activity if it was marked as `correct`
    if not body.correct:
        return

    markers = await get_activity_task_markers_of_activity(
        request=request,
        user=user,
        activity_uuid=activity.activity_uuid,
        course_id=activity.course_id,
        org_id=activity.org_id,
        db_session=db_session,
    )

    markers_flat = [marker.task_id for marker in markers]

    # Ensure that the activity is added to the trail if not already.
    await add_activity_to_trail(
        request=request,
        user=user,
        activity_uuid=body.activity_uuid,
        db_session=db_session,
        complete=False,
    )

    if body.task_id not in markers_flat:
        await mark_activity_task_complete(
            request=request,
            user=user,
            task_id=body.task_id,
            activity_uuid=activity.activity_uuid,
            org_id=activity.org_id,
            course_id=activity.course_id,
            db_session=db_session,
        )

    # Ensure that the task is included in the markers.
    markers_flat.append(body.task_id)

    everything_marked = True
    for task_id in tasks:
        if task_id not in markers_flat:
            everything_marked = False
            break

    print(
        f'markers_flat: {markers_flat} | everything_marked: {everything_marked}'
    )

    # If everything is marked, we can add the activity to the trail
    if everything_marked:
        print('!!!everything except last one marked, adding activity to trail')
        await add_activity_to_trail(
            request=request,
            user=user,
            activity_uuid=body.activity_uuid,
            db_session=db_session,
            complete=True,
        )

        trailstep = db_session.exec(
            select(TrailStep).where(
                (TrailStep.activity_uuid == body.activity_uuid)
                & (TrailStep.user_id == user.id)
            )
        ).first()
        if trailstep:
            data = dict(trailstep.data or {})
            if data.get("reward_task_id") is None:
                data["reward_task_id"] = body.task_id
                trailstep.data = data
                db_session.add(trailstep)
                db_session.commit()
        else:
            print(f"Missing trail step for reward capture: {body.activity_uuid}")

    return None
