from datetime import datetime
from typing import List
from uuid import uuid4
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from src.services.users.users import release_user_coin_reward, release_user_xp_reward
from src.services.courses.activities.activities import get_activity_by_id_and_course
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

    await release_user_xp_reward(request, db_session, user.user_uuid, chapter.xp_reward)
    await release_user_coin_reward(request, db_session, user.user_uuid, chapter.coin_reward)


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

    statement = select(TrailRun).where(TrailRun.trail_id == trail.id)
    trail_runs = db_session.exec(statement).all()

    trail_runs = [
        TrailRunRead(**trail_run.__dict__, course={}, steps=[], course_total_steps=0)
        for trail_run in trail_runs
    ]

    # Add course object and total activities in a course to trail runs
    for trail_run in trail_runs:
        statement = select(Course).where(Course.id == trail_run.course_id)
        course = db_session.exec(statement).first()
        trail_run.course = course

        # Add number of activities (steps) in a course
        statement = select(ChapterActivity).where(
            ChapterActivity.course_id == trail_run.course_id
        )
        course_total_steps = db_session.exec(statement)
        # count number of activities in a this list
        trail_run.course_total_steps = len(course_total_steps.all())

    for trail_run in trail_runs:
        statement = select(TrailStep).where(TrailStep.trailrun_id == trail_run.id)
        trail_steps = db_session.exec(statement).all()

        trail_steps = [TrailStep(**trail_step.__dict__) for trail_step in trail_steps]
        trail_run.steps = trail_steps

        for trail_step in trail_steps:
            statement = select(Course).where(Course.id == trail_step.course_id)
            course = db_session.exec(statement).first()
            trail_step.data = dict(course=course)

    trail_read = TrailRead(
        **trail.model_dump(),
        runs=trail_runs,
    )

    return trail_read


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

    statement = select(TrailRun).where(TrailRun.trail_id == trail.id)
    trail_runs = db_session.exec(statement).all()

    trail_runs = [
        TrailRunRead(**trail_run.__dict__, course={}, steps=[], course_total_steps=0)
        for trail_run in trail_runs
    ]

    # Add course object and total activities in a course to trail runs
    for trail_run in trail_runs:
        statement = select(Course).where(Course.id == trail_run.course_id)
        course = db_session.exec(statement).first()
        trail_run.course = course

        # Add number of activities (steps) in a course
        statement = select(ChapterActivity).where(
            ChapterActivity.course_id == trail_run.course_id
        )
        course_total_steps = db_session.exec(statement)
        # count number of activities in a this list
        trail_run.course_total_steps = len(course_total_steps.all())

    for trail_run in trail_runs:
        statement = select(TrailStep).where(TrailStep.trailrun_id == trail_run.id)
        trail_steps = db_session.exec(statement).all()

        trail_steps = [TrailStep(**trail_step.__dict__) for trail_step in trail_steps]
        trail_run.steps = trail_steps

        for trail_step in trail_steps:
            statement = select(Course).where(Course.id == trail_step.course_id)
            course = db_session.exec(statement).first()

            statement = select(Assignment_Task_Complete).where(
                (Assignment_Task_Complete.course_id == trail_step.course_id)
                & (Assignment_Task_Complete.activity_uuid == trail_step.activity_uuid)
                & (Assignment_Task_Complete.user_id == trail_step.user_id)
            )
            parts = db_session.exec(statement).all()

            trail_step.data = dict(course=course, parts=parts)

    trail_read = TrailRead(
        **trail.model_dump(),
        runs=trail_runs,
    )

    return trail_read


# Returns whether the addition was initial (meaning new)
# HACK, complete will never be updated true -> false, only false -> true
async def add_activity_to_trail(
    request: Request,
    user: PublicUser,
    activity_uuid: str,
    db_session: Session,
    complete: bool = True,
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
        )
        db_session.add(trailstep)
        db_session.commit()
        db_session.refresh(trailstep)
        if complete:
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
            trailstep.complete = complete
        db_session.add(trailstep)
        db_session.commit()
        db_session.refresh(trailstep)

    # After recording this activity, check if the containing chapter is now complete
    # 1) Find the chapter for this activity within this course
    ca_stmt = select(ChapterActivity).where(
        (ChapterActivity.activity_id == activity.id)
        & (ChapterActivity.course_id == course.id)
    )
    chapter_activity = db_session.exec(ca_stmt).first()

    if chapter_activity:
        chapter_id = chapter_activity.chapter_id
        # 2) Get all activities in this chapter
        chapter_acts_stmt = select(ChapterActivity).where(
            (ChapterActivity.chapter_id == chapter_id)
            & (ChapterActivity.course_id == course.id)
        )
        chapter_activities = db_session.exec(chapter_acts_stmt).all()
        chapter_activity_ids = [ca.activity_id for ca in chapter_activities]

        chapter_activity_uuids = []
        for id in chapter_activity_ids:
            activity = await get_activity_by_id_and_course(request, id, course.id, db_session)
            chapter_activity_uuids.append(activity.activity_uuid)

        print(f"chapter_activity_uuids: {chapter_activity_uuids}")

        if chapter_activity_uuids:
            # 3) Check if the user has trail steps for all activities in the chapter (complete=True)
            steps_stmt = select(TrailStep).where(
                (TrailStep.trailrun_id == trailrun.id)
                & (TrailStep.user_id == user.id)
            )
            user_steps = db_session.exec(steps_stmt).all()
            completed_uuids = set(
                ts.activity_uuid for ts in user_steps if ts.complete is True
            )

            print(f"UUIDS: {completed_uuids}")

            chapter_all_completed = all(
                aid in completed_uuids for aid in chapter_activity_uuids
            )

            if chapter_all_completed:
                await chapter_completed(
                    request=request,
                    user=user,
                    chapter_id=chapter_id,
                    db_session=db_session,
                    was_initial=was_initial,
                )

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id, TrailRun.user_id == user.id
    )
    trail_runs = db_session.exec(statement).all()

    trail_runs = [
        TrailRunRead(**trail_run.__dict__, course={}, steps=[], course_total_steps=0)
        for trail_run in trail_runs
    ]

    for trail_run in trail_runs:
        statement = select(TrailStep).where(
            TrailStep.trailrun_id == trail_run.id, TrailStep.user_id == user.id
        )
        trail_steps = db_session.exec(statement).all()

        trail_steps = [TrailStep(**trail_step.__dict__) for trail_step in trail_steps]
        trail_run.steps = trail_steps

        for trail_step in trail_steps:
            statement = select(Course).where(Course.id == trail_step.course_id)
            course = db_session.exec(statement).first()
            trail_step.data = dict(course=course)

    if not complete:
        return False
    return was_initial


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

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id, TrailRun.user_id == user.id
    )
    trail_runs = db_session.exec(statement).all()

    trail_runs = [
        TrailRunRead(**trail_run.__dict__, course={}, steps=[], course_total_steps=0)
        for trail_run in trail_runs
    ]

    for trail_run in trail_runs:
        statement = select(TrailStep).where(
            TrailStep.trailrun_id == trail_run.id, TrailStep.user_id == user.id
        )
        trail_steps = db_session.exec(statement).all()

        trail_steps = [TrailStep(**trail_step.__dict__) for trail_step in trail_steps]
        trail_run.steps = trail_steps

        for trail_step in trail_steps:
            statement = select(Course).where(Course.id == trail_step.course_id)
            course = db_session.exec(statement).first()
            trail_step.data = dict(course=course)

    trail_read = TrailRead(
        **trail.model_dump(),
        runs=trail_runs,
    )

    return trail_read


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

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id, TrailRun.user_id == user.id
    )
    trail_runs = db_session.exec(statement).all()

    trail_runs = [
        TrailRunRead(**trail_run.__dict__, course={}, steps=[], course_total_steps=0)
        for trail_run in trail_runs
    ]

    for trail_run in trail_runs:
        statement = select(TrailStep).where(
            TrailStep.trailrun_id == trail_run.id, TrailStep.user_id == user.id
        )
        trail_steps = db_session.exec(statement).all()

        trail_steps = [TrailStep(**trail_step.__dict__) for trail_step in trail_steps]
        trail_run.steps = trail_steps

        for trail_step in trail_steps:
            statement = select(Course).where(Course.id == trail_step.course_id)
            course = db_session.exec(statement).first()
            trail_step.data = dict(course=course)

    trail_read = TrailRead(
        **trail.model_dump(),
        runs=trail_runs,
    )

    return trail_read


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

    trailstep.tutor_verified = status
    trailstep.update_date = str(datetime.now())
    db_session.add(trailstep)
    db_session.commit()
    db_session.refresh(trailstep)

    return {
        "detail": "Trail step verification updated",
        "trail_step_id": trailstep.id,
        "tutor_verified": trailstep.tutor_verified,
    }
