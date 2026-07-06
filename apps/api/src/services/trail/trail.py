import logging
from datetime import datetime
from typing import Any, List
from uuid import uuid4
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from src.services.notifications.service import (
    notify_group_activity_state_sync,
    notify_tutors_student_activity_started,
    notify_tutors_student_activity_completed,
    notify_student_activity_verified,
    notify_user_reward_update,
)
from src.services.courses.member_groups import (
    apply_pending_group_completion_if_any,
    can_user_receive_group_completion_now,
    get_group_peer_user_ids,
    get_group_member_user_ids,
    queue_group_pending_completion,
)
from src.services.users.users import release_user_coin_reward, release_user_xp_reward
from src.services.courses.activities.activities import get_activity_by_id_and_course
from src.services.courses.activities.workspaces import get_task
from src.services.courses.rooms import get_user_course_role_flags
from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun, TrailRunRead
from src.db.trail_steps import (
    Assignment_Task_Complete,
    TrailStep,
    TrailStepVerificationEnum,
)
from src.db.trails import Trail, TrailCreate, TrailRead
from src.db.users import AnonymousUser, PublicUser, User
from src.db.courses.chapters import Chapter


logger = logging.getLogger(__name__)


def _serialize_trail_course_summary(course: Course | None) -> dict[str, Any] | None:
    if course is None:
        return None

    return {
        "id": course.id,
        "course_uuid": course.course_uuid,
        "name": course.name,
        "description": course.description,
        "thumbnail_image": course.thumbnail_image,
        "org_id": course.org_id,
        "public": course.public,
    }


def _get_course_total_steps(course_id: int, db_session: Session) -> int:
    statement = select(ChapterActivity.id).where(ChapterActivity.course_id == course_id)
    return len(db_session.exec(statement).all())


def _build_trail_step_data(
    trail_step: TrailStep,
    db_session: Session,
    *,
    include_parts: bool,
) -> dict[str, Any]:
    if not include_parts:
        return {}

    statement = select(Assignment_Task_Complete).where(
        (Assignment_Task_Complete.course_id == trail_step.course_id)
        & (Assignment_Task_Complete.activity_uuid == trail_step.activity_uuid)
        & (Assignment_Task_Complete.user_id == trail_step.user_id)
    )
    parts = db_session.exec(statement).all()
    return {"parts": parts}


def _build_trail_read(
    trail: Trail,
    db_session: Session,
    *,
    include_parts: bool = False,
) -> TrailRead:
    statement = select(TrailRun).where(TrailRun.trail_id == trail.id)
    trail_runs = db_session.exec(statement).all()

    trail_run_reads = []
    for trail_run in trail_runs:
        course = db_session.exec(
            select(Course).where(Course.id == trail_run.course_id)
        ).first()

        step_statement = select(TrailStep).where(TrailStep.trailrun_id == trail_run.id)
        trail_steps = db_session.exec(step_statement).all()
        trail_step_reads = []

        for trail_step in trail_steps:
            trail_step_read = TrailStep(**trail_step.model_dump())
            trail_step_read.data = _build_trail_step_data(
                trail_step,
                db_session,
                include_parts=include_parts,
            )
            trail_step_reads.append(trail_step_read)

        trail_run_reads.append(
            TrailRunRead(
                **trail_run.model_dump(),
                course=_serialize_trail_course_summary(course),
                steps=trail_step_reads,
                course_total_steps=_get_course_total_steps(
                    trail_run.course_id, db_session
                ),
            )
        )

    return TrailRead(
        **trail.model_dump(),
        runs=trail_run_reads,
    )


async def get_chapter_slim(
    request: Request,
    chapter_id: int,
    db_session: Session,
) -> Chapter:
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Chapter does not exist"
        )

    return chapter


async def chapter_completed(
    request: Request,
    user: PublicUser,
    chapter_id: int,
    db_session: Session,
    was_initial: bool,
) -> None:
    if not was_initial:
        print("Not running chapter complete reward hook, is not initial.")
        return

    chapter = await get_chapter_slim(request, chapter_id, db_session)

    print(
        f"Rewarding user {user.user_uuid} {chapter.xp_reward} XP | {chapter.coin_reward} coints | [chapter_completed] chapter={chapter_id}"
    )

    await release_user_xp_reward(
        request, db_session, user.user_uuid, chapter.xp_reward
    )
    updated_user = await release_user_coin_reward(
        request, db_session, user.user_uuid, chapter.coin_reward
    )

    if chapter.xp_reward or chapter.coin_reward:
        try:
            await notify_user_reward_update(
                user_id=updated_user.id,
                data={
                    "coins": updated_user.coins,
                    "level": updated_user.level,
                    "level_progress": updated_user.level_progress,
                    "delta_coins": chapter.coin_reward,
                    "delta_xp": chapter.xp_reward,
                    "source": "chapter_verified",
                    "chapter_id": chapter.id,
                    "chapter_uuid": chapter.chapter_uuid,
                },
            )
        except Exception as exc:
            logger.warning(
                "Failed to notify chapter reward update",
                extra={
                    "chapter_id": chapter.id,
                    "chapter_uuid": chapter.chapter_uuid,
                    "user_id": user.id,
                    "error": str(exc),
                },
            )


async def create_user_trail(
    request: Request,
    user: PublicUser,
    trail_object: TrailCreate,
    db_session: Session,
) -> Trail:
    statement = select(Trail).where(
        Trail.org_id == trail_object.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if trail:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trail already exists",
        )

    trail = Trail.model_validate(trail_object)

    trail.creation_date = str(datetime.now())
    trail.update_date = str(datetime.now())
    trail.org_id = trail_object.org_id
    trail.trail_uuid = str(f"trail_{uuid4()}")

    # create trail
    db_session.add(trail)
    db_session.commit()
    db_session.refresh(trail)

    return trail


async def get_user_trails(
    request: Request,
    user: PublicUser,
    db_session: Session,
) -> TrailRead:
    statement = select(Trail).where(Trail.user_id == user.id)
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    return _build_trail_read(trail, db_session)


async def check_trail_presence(
    org_id: int,
    user_id: int,
    request: Request,
    user: PublicUser,
    db_session: Session,
):
    statement = select(Trail).where(Trail.org_id == org_id, Trail.user_id == user_id)
    trail = db_session.exec(statement).first()

    if not trail:
        trail = await create_user_trail(
            request,
            user,
            TrailCreate(
                org_id=org_id,
                user_id=user.id,
            ),
            db_session,
        )
        return trail

    return trail


async def get_user_trail_with_orgid(
    request: Request, user: PublicUser | AnonymousUser, org_id: int, db_session: Session
) -> TrailRead:

    if isinstance(user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous users cannot access this endpoint",
        )

    trail = await check_trail_presence(
        org_id=org_id,
        user_id=user.id,
        request=request,
        user=user,
        db_session=db_session,
    )

    return _build_trail_read(trail, db_session, include_parts=True)


# Returns whether the addition was initial (meaning new)
# HACK, complete will never be updated true -> false, only false -> true
async def add_activity_to_trail(
    request: Request,
    user: PublicUser,
    activity_uuid: str,
    db_session: Session,
    complete: bool = True,
    propagate_group_completion: bool = True,
    emit_group_activity_state_sync: bool = True,
) -> bool:
    was_initial = None

    # Look for the activity
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found"
        )

    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    trail = await check_trail_presence(
        org_id=course.org_id,
        user_id=user.id,
        request=request,
        user=user,
        db_session=db_session,
    )

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id,
        TrailRun.course_id == course.id,
        TrailRun.user_id == user.id,
    )
    trailrun = db_session.exec(statement).first()

    if not trailrun:
        trailrun = TrailRun(
            trail_id=trail.id if trail.id is not None else 0,
            course_id=course.id if course.id is not None else 0,
            org_id=course.org_id,
            user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(trailrun)
        db_session.commit()
        db_session.refresh(trailrun)

    statement = select(TrailStep).where(
        TrailStep.trailrun_id == trailrun.id,
        TrailStep.activity_uuid == activity_uuid,
        TrailStep.user_id == user.id,
    )
    trailstep = db_session.exec(statement).first()

    if not trailstep:
        trailstep = TrailStep(
            trailrun_id=trailrun.id if trailrun.id is not None else 0,
            activity_uuid=activity_uuid,
            course_id=course.id if course.id is not None else 0,
            trail_id=trail.id if trail.id is not None else 0,
            org_id=course.org_id,
            complete=complete,
            tutor_verified=TrailStepVerificationEnum.NONE,
            ai_verified=TrailStepVerificationEnum.NONE,
            grade="",
            user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
            completed_date=str(datetime.now()) if complete else None,
        )
        db_session.add(trailstep)
        db_session.commit()
        db_session.refresh(trailstep)
        was_initial = True
    else:
        print(
            f"TrailStep already exists for activity {activity_uuid} and user {user.id}, got UPDATED."
        )
        if (not trailstep.complete) and complete:
            print(f"HOWEVER, trailstep is not complete, got updated: trailstep.complete={trailstep.complete}, complete={complete}")
            was_initial = True
        else:
            was_initial = False

        # Update the existing trail step with new data
        trailstep.update_date = str(datetime.now())
        if complete:
            # Record the first completion so we can measure first-view→complete
            # duration and, later, complete→verify tutor response time.
            if not trailstep.complete and trailstep.completed_date is None:
                trailstep.completed_date = str(datetime.now())
            trailstep.complete = complete
        db_session.add(trailstep)
        db_session.commit()
        db_session.refresh(trailstep)

    if was_initial:
        notification_targets = (
            get_tutor_notification_targets_for_student_course_activity_notifications(
                course_id=course.id,
                student_id=user.id,
                db_session=db_session,
            )
        )
        if notification_targets:
            try:
                if complete:
                    await notify_tutors_student_activity_completed(
                        notification_targets=notification_targets,
                        student=user,
                        activity=activity,
                        course=course,
                    )
                else:
                    await notify_tutors_student_activity_started(
                        notification_targets=notification_targets,
                        student=user,
                        activity=activity,
                        course=course,
                    )
            except Exception as exc:
                event_name = (
                    "completed" if complete else "started"
                )
                logger.warning(
                    f"Failed to notify tutors about {event_name} activity",
                    extra={
                        "course_id": course.id,
                        "activity_uuid": activity.activity_uuid,
                        "student_id": user.id,
                        "error": str(exc),
                    },
                )

    # Chapter rewards now trigger on first tutor verification (CORRECT).

    if not complete:
        await apply_pending_group_completion_if_any(
            course_id=course.id,
            user=user,
            activity_uuid=activity_uuid,
            request=request,
            db_session=db_session,
        )
        return was_initial

    if was_initial and propagate_group_completion:
        peer_user_ids = get_group_peer_user_ids(
            course_id=course.id,
            user_id=user.id,
            db_session=db_session,
        )
        for peer_user_id in peer_user_ids:
            peer_user = db_session.get(User, peer_user_id)
            if not peer_user:
                continue
            if can_user_receive_group_completion_now(
                course_id=course.id,
                user_id=peer_user_id,
                activity_uuid=activity_uuid,
                db_session=db_session,
            ):
                await add_activity_to_trail(
                    request=request,
                    user=peer_user,
                    activity_uuid=activity_uuid,
                    db_session=db_session,
                    complete=True,
                    propagate_group_completion=False,
                    emit_group_activity_state_sync=False,
                )
            else:
                await queue_group_pending_completion(
                    course_id=course.id,
                    user_id=peer_user_id,
                    source_user_id=user.id,
                    activity_uuid=activity_uuid,
                    db_session=db_session,
                )
    if was_initial and complete and emit_group_activity_state_sync:
        group_member_user_ids = get_group_member_user_ids(
            course_id=course.id,
            user_id=user.id,
            db_session=db_session,
            include_user=True,
        )
        if len(group_member_user_ids) > 1:
            try:
                await notify_group_activity_state_sync(
                    user_ids=group_member_user_ids,
                    source_user=user,
                    activity=activity,
                    course=course,
                )
            except Exception as exc:
                logger.warning(
                    "Failed to notify group members about activity state sync",
                    extra={
                        "course_id": course.id,
                        "activity_uuid": activity.activity_uuid,
                        "source_user_id": user.id,
                        "error": str(exc),
                    },
                )
    return was_initial


def build_course_room_notification_uuid(room_id: int) -> str:
    # TODO: FAT FOLLOW-UP
    # `course_room` still has no real UUID column. This synthetic value is only
    # here so room-scoped notifications can carry stable room context for now.
    # Replace this with a persisted room UUID once the schema supports it.
    return f"course_room_{room_id}"


def get_tutor_notification_targets_for_student_course_activity_notifications(
    *,
    course_id: int,
    student_id: int,
    db_session: Session,
) -> list[dict[str, int | str]]:
    student_room_ids = db_session.exec(
        select(CourseRoomMember.room_id)
        .join(CourseRoom, CourseRoom.id == CourseRoomMember.room_id)
        .where(
            CourseRoom.course_id == course_id,
            CourseRoomMember.user_id == student_id,
            CourseRoomMember.role == RoomRoleEnum.student,
        )
    ).all()

    room_ids = [room_id for room_id in student_room_ids if room_id is not None]
    if not room_ids:
        return []

    tutor_memberships = db_session.exec(
        select(CourseRoomMember.room_id, CourseRoomMember.user_id)
        .join(CourseRoom, CourseRoom.id == CourseRoomMember.room_id)
        .where(
            CourseRoom.course_id == course_id,
            CourseRoomMember.room_id.in_(room_ids),
            CourseRoomMember.role == RoomRoleEnum.tutor,
        )
    ).all()

    return [
        {
            "tutor_user_id": tutor_user_id,
            "room_id": room_id,
            "room_uuid": build_course_room_notification_uuid(room_id),
        }
        for room_id, tutor_user_id in tutor_memberships
        if room_id is not None
        and tutor_user_id is not None
        and tutor_user_id != student_id
    ]


async def add_course_to_trail(
    request: Request,
    user: PublicUser,
    course_uuid: str,
    db_session: Session,
) -> TrailRead:
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # check if run already exists
    statement = select(TrailRun).where(
        TrailRun.course_id == course.id, TrailRun.user_id == user.id
    )
    trailrun = db_session.exec(statement).first()

    if trailrun:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="TrailRun already exists"
        )

    statement = select(Trail).where(
        Trail.org_id == course.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id,
        TrailRun.course_id == course.id,
        TrailRun.user_id == user.id,
    )
    trail_run = db_session.exec(statement).first()

    if not trail_run:
        trail_run = TrailRun(
            trail_id=trail.id if trail.id is not None else 0,
            course_id=course.id if course.id is not None else 0,
            org_id=course.org_id,
            user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(trail_run)
        db_session.commit()
        db_session.refresh(trail_run)

    return _build_trail_read(trail, db_session)


async def remove_course_from_trail(
    request: Request,
    user: PublicUser,
    course_uuid: str,
    db_session: Session,
) -> TrailRead:
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    statement = select(Trail).where(
        Trail.org_id == course.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id,
        TrailRun.course_id == course.id,
        TrailRun.user_id == user.id,
    )
    trail_run = db_session.exec(statement).first()

    if trail_run:
        db_session.delete(trail_run)
        db_session.commit()

    # Delete all trail steps for this course
    statement = select(TrailStep).where(
        TrailStep.course_id == course.id, TrailStep.user_id == user.id
    )
    trail_steps = db_session.exec(statement).all()

    for trail_step in trail_steps:
        db_session.delete(trail_step)
        db_session.commit()

    return _build_trail_read(trail, db_session)


#
# Atomic task-based progression
#


async def get_activity_task_markers_of_activity(
    request: Request,
    user: PublicUser,
    activity_uuid: str,
    course_id: int,
    org_id: int,
    db_session: Session,
) -> List[Assignment_Task_Complete]:
    statement = select(Assignment_Task_Complete).where(
        (Assignment_Task_Complete.activity_uuid == activity_uuid)
        & (Assignment_Task_Complete.user_id == user.id)
        & (Assignment_Task_Complete.course_id == course_id)
        & (Assignment_Task_Complete.org_id == org_id)
    )

    markers = db_session.exec(statement).all()

    return markers


async def mark_activity_task_complete(
    request: Request,
    user: PublicUser,
    task_id: int,
    activity_uuid: int,
    course_id: int,
    org_id: int,
    db_session: Session,
):
    marker = Assignment_Task_Complete(
        complete=True,
        task_id=task_id,
        activity_uuid=activity_uuid,
        user_id=user.id,
        course_id=course_id,
        org_id=org_id,
    )

    db_session.add(marker)
    db_session.commit()


async def verify_trail_step_by_tutor(
    request: Request,
    activity_uuid: str,
    student_uuid: str,
    status: TrailStepVerificationEnum,
    current_user: PublicUser,
    db_session: Session,
) -> dict:
    if current_user.id == 0:
        raise HTTPException(status_code=403, detail="Authentication required")

    student = db_session.exec(
        select(User).where(User.user_uuid == student_uuid)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    trailstep = db_session.exec(
        select(TrailStep).where(
            (TrailStep.activity_uuid == activity_uuid)
            & (TrailStep.user_id == student.id)
        )
    ).first()
    if not trailstep:
        raise HTTPException(status_code=404, detail="Trail step not found")
    if not trailstep.complete:
        raise HTTPException(
            status_code=400,
            detail="Only completed trail steps can be verified",
        )

    course = db_session.exec(
        select(Course).where(Course.id == trailstep.course_id)
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    role_flags = get_user_course_role_flags(current_user.id, course, db_session)
    is_admin_or_maintainer = role_flags["is_admin"] or role_flags["is_maintainer"]

    if not (is_admin_or_maintainer or role_flags["is_tutor"]):
        raise HTTPException(
            status_code=403,
            detail="User does not have permission to verify trail steps",
        )

    if not is_admin_or_maintainer:
        tutor_room_ids = db_session.exec(
            select(CourseRoomMember.room_id)
            .join(CourseRoom, CourseRoom.id == CourseRoomMember.room_id)
            .where(
                CourseRoom.course_id == course.id,
                CourseRoomMember.user_id == current_user.id,
                CourseRoomMember.role == RoomRoleEnum.tutor,
            )
        ).all()

        student_room_ids = db_session.exec(
            select(CourseRoomMember.room_id)
            .join(CourseRoom, CourseRoom.id == CourseRoomMember.room_id)
            .where(
                CourseRoom.course_id == course.id,
                CourseRoomMember.user_id == student.id,
                CourseRoomMember.role == RoomRoleEnum.student,
            )
        ).all()

        if not tutor_room_ids or not student_room_ids:
            raise HTTPException(
                status_code=403,
                detail="Tutor and student must share a room",
            )

        if set(tutor_room_ids).isdisjoint(student_room_ids):
            raise HTTPException(
                status_code=403,
                detail="Tutor and student must share a room",
            )

    activity = db_session.exec(
        select(Activity).where(
            (Activity.activity_uuid == activity_uuid)
            & (Activity.course_id == course.id)
        )
    ).first()

    target_user_ids = get_group_member_user_ids(
        course_id=course.id,
        user_id=student.id,
        db_session=db_session,
        include_user=True,
    )
    target_users = db_session.exec(select(User).where(User.id.in_(target_user_ids))).all()
    target_user_by_id = {target_user.id: target_user for target_user in target_users}
    target_steps = db_session.exec(
        select(TrailStep).where(
            TrailStep.course_id == course.id,
            TrailStep.activity_uuid == activity_uuid,
            TrailStep.user_id.in_(target_user_ids),
        )
    ).all()
    target_step_by_user_id = {target_step.user_id: target_step for target_step in target_steps}

    previous_status_by_user_id: dict[int, TrailStepVerificationEnum] = {}
    affected_user_ids: list[int] = []
    for target_user_id in target_user_ids:
        target_step = target_step_by_user_id.get(target_user_id)
        if not target_step or not target_step.complete:
            continue
        previous_status_by_user_id[target_user_id] = target_step.tutor_verified
        target_step.tutor_verified = status
        target_step.update_date = str(datetime.now())
        # Record the first real tutor verification (complete→verify response time).
        if status != TrailStepVerificationEnum.NONE and target_step.verified_date is None:
            target_step.verified_date = str(datetime.now())
        db_session.add(target_step)
        affected_user_ids.append(target_user_id)
    db_session.commit()

    source_trailstep = target_step_by_user_id.get(student.id)
    if not source_trailstep:
        raise HTTPException(status_code=404, detail="Trail step not found")
    db_session.refresh(source_trailstep)

    for target_user_id in affected_user_ids:
        target_step = target_step_by_user_id.get(target_user_id)
        target_user = target_user_by_id.get(target_user_id)
        previous_status = previous_status_by_user_id.get(target_user_id)
        if not target_step or not target_user or previous_status is None:
            continue

        if (
            status in {
                TrailStepVerificationEnum.CORRECT,
                TrailStepVerificationEnum.INCORRECT,
            }
            and previous_status != status
            and target_user.id != current_user.id
        ):
            if activity:
                try:
                    await notify_student_activity_verified(
                        student=target_user,
                        tutor=current_user,
                        activity=activity,
                        course=course,
                        status=status,
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to notify student about tutor verification",
                        extra={
                            "course_id": course.id,
                            "activity_uuid": activity_uuid,
                            "student_id": target_user.id,
                            "tutor_id": current_user.id,
                            "error": str(exc),
                        },
                    )
            else:
                logger.warning(
                    "Skipping tutor verification notification because activity is missing",
                    extra={
                        "course_id": course.id,
                        "activity_uuid": activity_uuid,
                        "student_id": target_user.id,
                    },
                )

        if status == TrailStepVerificationEnum.CORRECT and previous_status != status:
            reward_data = dict(target_step.data or {})
            activity_reward_granted = reward_data.get("activity_reward_granted") is True
            if not activity_reward_granted:
                if activity:
                    reward_task_id = reward_data.get("reward_task_id")
                    if reward_task_id is None:
                        task_ids = activity.content.get("task_ids", [])
                        if task_ids:
                            reward_task_id = task_ids[-1]
                            reward_data["reward_task_id"] = reward_task_id

                    if reward_task_id is not None:
                        reward_task_id_int = None
                        try:
                            reward_task_id_int = int(reward_task_id)
                        except (TypeError, ValueError):
                            logger.warning(
                                "Skipping activity reward; reward task id invalid",
                                extra={
                                    "course_id": course.id,
                                    "activity_uuid": activity_uuid,
                                    "student_id": target_user.id,
                                    "task_id": reward_task_id,
                                },
                            )

                        if reward_task_id_int is not None:
                            task = await get_task(
                                request, db_session, reward_task_id_int
                            )
                            if task:
                                try:
                                    updated_user = None
                                    await release_user_xp_reward(
                                        request,
                                        db_session,
                                        target_user.user_uuid,
                                        task.xp_reward,
                                    )
                                    updated_user = await release_user_coin_reward(
                                        request,
                                        db_session,
                                        target_user.user_uuid,
                                        task.coin_reward,
                                    )
                                except Exception as exc:
                                    logger.warning(
                                        "Failed to release activity reward",
                                        extra={
                                            "course_id": course.id,
                                            "activity_uuid": activity_uuid,
                                            "student_id": target_user.id,
                                            "task_id": reward_task_id_int,
                                            "error": str(exc),
                                        },
                                    )
                                if updated_user and (task.xp_reward or task.coin_reward):
                                    try:
                                        await notify_user_reward_update(
                                            user_id=updated_user.id,
                                            data={
                                                "coins": updated_user.coins,
                                                "level": updated_user.level,
                                                "level_progress": updated_user.level_progress,
                                                "delta_coins": task.coin_reward,
                                                "delta_xp": task.xp_reward,
                                                "source": "activity_verified",
                                                "course_id": course.id,
                                                "course_uuid": course.course_uuid,
                                                "activity_id": activity.id,
                                                "activity_uuid": activity_uuid,
                                            },
                                        )
                                    except Exception as exc:
                                        logger.warning(
                                            "Failed to notify activity reward update",
                                            extra={
                                                "course_id": course.id,
                                                "activity_uuid": activity_uuid,
                                                "student_id": target_user.id,
                                                "task_id": reward_task_id_int,
                                                "error": str(exc),
                                            },
                                        )
                            else:
                                logger.warning(
                                    "Skipping activity reward; task missing",
                                    extra={
                                        "course_id": course.id,
                                        "activity_uuid": activity_uuid,
                                        "student_id": target_user.id,
                                        "task_id": reward_task_id_int,
                                    },
                                )
                    else:
                        logger.warning(
                            "Skipping activity reward; reward task id missing",
                            extra={
                                "course_id": course.id,
                                "activity_uuid": activity_uuid,
                                "student_id": target_user.id,
                            },
                        )

                    reward_data["activity_reward_granted"] = True
                else:
                    logger.warning(
                        "Skipping activity reward because activity is missing",
                        extra={
                            "course_id": course.id,
                            "activity_uuid": activity_uuid,
                            "student_id": target_user.id,
                        },
                    )

            if activity and reward_data.get("chapter_reward_granted") is not True:
                ca_stmt = select(ChapterActivity).where(
                    (ChapterActivity.activity_id == activity.id)
                    & (ChapterActivity.course_id == course.id)
                )
                chapter_activity = db_session.exec(ca_stmt).first()

                if chapter_activity:
                    chapter_id = chapter_activity.chapter_id
                    chapter_acts_stmt = select(ChapterActivity).where(
                        (ChapterActivity.chapter_id == chapter_id)
                        & (ChapterActivity.course_id == course.id)
                    )
                    chapter_activities = db_session.exec(chapter_acts_stmt).all()
                    chapter_activity_ids = [
                        ca.activity_id for ca in chapter_activities
                    ]

                    chapter_activity_uuids = []
                    for id in chapter_activity_ids:
                        chapter_activity = await get_activity_by_id_and_course(
                            request, id, course.id, db_session
                        )
                        chapter_activity_uuids.append(chapter_activity.activity_uuid)

                    if chapter_activity_uuids:
                        steps_stmt = select(TrailStep).where(
                            (TrailStep.trailrun_id == target_step.trailrun_id)
                            & (TrailStep.user_id == target_user.id)
                        )
                        user_steps = db_session.exec(steps_stmt).all()
                        verified_uuids = set(
                            ts.activity_uuid
                            for ts in user_steps
                            if ts.tutor_verified == TrailStepVerificationEnum.CORRECT
                        )

                        chapter_all_verified = all(
                            aid in verified_uuids
                            for aid in chapter_activity_uuids
                        )

                        if chapter_all_verified:
                            await chapter_completed(
                                request=request,
                                user=target_user,
                                chapter_id=chapter_id,
                                db_session=db_session,
                                was_initial=True,
                            )
                            reward_data["chapter_reward_granted"] = True

            if reward_data != (target_step.data or {}):
                target_step.data = reward_data
                db_session.add(target_step)
                db_session.commit()
                db_session.refresh(target_step)

    return {
        "detail": "Trail step verification updated",
        "trail_step_id": source_trailstep.id,
        "tutor_verified": source_trailstep.tutor_verified,
        "affected_user_ids": affected_user_ids,
    }
