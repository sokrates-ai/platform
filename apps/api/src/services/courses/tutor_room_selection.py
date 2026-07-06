from datetime import datetime
from typing import List

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.courses.courses import Course
from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from src.db.courses.course_tutor_room_selection import (
    CourseTutorRoomSelection,
    CourseTutorRoomSelectionRead,
    CourseTutorRoomSelectionUpdate,
)
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.services.courses.rooms import ensure_user_role_for_room, parse_user_ids


def get_course_and_role_flags(
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> tuple[Course, dict[str, bool]]:
    course = db_session.exec(
        select(Course).where(Course.course_uuid == course_uuid)
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.id == 0:
        raise HTTPException(status_code=403, detail="Authentication required")

    statement = (
        select(Role)
        .join(UserOrganization, Role.id == UserOrganization.role_id)
        .where(
            UserOrganization.user_id == current_user.id,
            UserOrganization.org_id == course.org_id,
        )
    )
    roles = db_session.exec(statement).all()

    is_admin = any(
        role.id == 1 or role.role_uuid == "role_global_admin" for role in roles
    )
    is_maintainer = any(
        role.id == 2 or role.role_uuid == "role_global_maintainer" for role in roles
    )
    is_tutor = any(
        role.id == 4 or role.role_uuid == "role_global_tutor" for role in roles
    )

    if not (is_admin or is_maintainer or is_tutor):
        raise HTTPException(
            status_code=403,
            detail="User does not have permission to manage tutor rooms",
        )

    return course, {
        "is_admin": is_admin,
        "is_maintainer": is_maintainer,
        "is_tutor": is_tutor,
    }


def ensure_user_can_manage_room(
    room_id: int,
    course: Course,
    current_user: PublicUser | AnonymousUser,
    role_flags: dict[str, bool],
    db_session: Session,
) -> CourseRoom:
    room = db_session.exec(
        select(CourseRoom).where(
            CourseRoom.id == room_id, CourseRoom.course_id == course.id
        )
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if role_flags["is_admin"] or role_flags["is_maintainer"]:
        return room

    membership = db_session.exec(
        select(CourseRoomMember).where(
            CourseRoomMember.room_id == room.id,
            CourseRoomMember.user_id == current_user.id,
            CourseRoomMember.role == RoomRoleEnum.tutor,
        )
    ).first()

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="User does not have permission to manage this room",
        )

    return room


async def get_tutor_room_selection(
    _request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseTutorRoomSelectionRead:
    course, _ = get_course_and_role_flags(course_uuid, current_user, db_session)

    selection = db_session.exec(
        select(CourseTutorRoomSelection).where(
            CourseTutorRoomSelection.course_id == course.id,
            CourseTutorRoomSelection.user_id == current_user.id,
        )
    ).first()

    return CourseTutorRoomSelectionRead(
        room_id=selection.room_id if selection else None,
        selected_tab_id=selection.selected_tab_id if selection else None,
    )


async def set_tutor_room_selection(
    _request: Request,
    course_uuid: str,
    selection_update: CourseTutorRoomSelectionUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseTutorRoomSelectionRead:
    course, role_flags = get_course_and_role_flags(
        course_uuid, current_user, db_session
    )

    room = ensure_user_can_manage_room(
        selection_update.room_id, course, current_user, role_flags, db_session
    )

    selection = db_session.exec(
        select(CourseTutorRoomSelection).where(
            CourseTutorRoomSelection.course_id == course.id,
            CourseTutorRoomSelection.user_id == current_user.id,
        )
    ).first()

    now = str(datetime.now())
    if selection:
        selection.room_id = room.id
        if selection_update.selected_tab_id is not None:
            selection.selected_tab_id = selection_update.selected_tab_id
        selection.update_date = now
    else:
        selection = CourseTutorRoomSelection(
            course_id=course.id,
            user_id=current_user.id,
            room_id=room.id,
            selected_tab_id=selection_update.selected_tab_id,
            creation_date=now,
            update_date=now,
        )
        db_session.add(selection)

    db_session.commit()
    db_session.refresh(selection)

    return CourseTutorRoomSelectionRead(
        room_id=selection.room_id,
        selected_tab_id=selection.selected_tab_id,
    )


async def clear_tutor_room_selection(
    _request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseTutorRoomSelectionRead:
    course, _ = get_course_and_role_flags(course_uuid, current_user, db_session)

    selection = db_session.exec(
        select(CourseTutorRoomSelection).where(
            CourseTutorRoomSelection.course_id == course.id,
            CourseTutorRoomSelection.user_id == current_user.id,
        )
    ).first()

    if selection:
        db_session.delete(selection)
        db_session.commit()

    return CourseTutorRoomSelectionRead(room_id=None, selected_tab_id=None)


def _normalize_activity_uuid(activity_uuid: str) -> str:
    if activity_uuid.startswith("activity_"):
        return activity_uuid
    return f"activity_{activity_uuid}"


def _parse_activity_uuids(activity_uuids: str) -> list[str]:
    if not activity_uuids:
        return []
    parsed: list[str] = []
    seen: set[str] = set()
    for raw in activity_uuids.split(","):
        trimmed = raw.strip()
        if not trimmed:
            continue
        normalized = _normalize_activity_uuid(trimmed)
        if normalized in seen:
            continue
        seen.add(normalized)
        parsed.append(normalized)
    return parsed


async def list_room_activity_status(
    _request: Request,
    course_uuid: str,
    room_id: int,
    activity_uuids: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[dict]:
    course, role_flags = get_course_and_role_flags(
        course_uuid, current_user, db_session
    )
    room = ensure_user_can_manage_room(
        room_id, course, current_user, role_flags, db_session
    )

    normalized_activity_uuids = _parse_activity_uuids(activity_uuids)
    if not normalized_activity_uuids:
        return []

    student_ids = db_session.exec(
        select(CourseRoomMember.user_id).where(
            CourseRoomMember.room_id == room.id,
            CourseRoomMember.role == RoomRoleEnum.student,
        )
    ).all()
    student_ids = [student_id for student_id in student_ids if student_id]
    if not student_ids:
        return []

    steps = db_session.exec(
        select(TrailStep).where(
            TrailStep.course_id == course.id,
            TrailStep.user_id.in_(student_ids),
            TrailStep.activity_uuid.in_(normalized_activity_uuids),
        )
    ).all()

    return [
        {
            "user_id": step.user_id,
            "activity_uuid": step.activity_uuid,
            "complete": step.complete,
            "tutor_verified": step.tutor_verified,
            "creation_date": step.creation_date,
            "update_date": step.update_date,
            "completed_date": step.completed_date,
            "verified_date": step.verified_date,
        }
        for step in steps
    ]


async def list_available_room_students(
    _request: Request,
    course_uuid: str,
    room_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> List[UserRead]:
    """
    List students enrolled in the course who are not yet members of the given room.
    Tutor-scoped: the caller must be a tutor of this room (or an admin/maintainer).
    """
    course, role_flags = get_course_and_role_flags(
        course_uuid, current_user, db_session
    )
    room = ensure_user_can_manage_room(
        room_id, course, current_user, role_flags, db_session
    )

    existing_member_ids = db_session.exec(
        select(CourseRoomMember.user_id).where(CourseRoomMember.room_id == room.id)
    ).all()
    existing_member_ids = {uid for uid in existing_member_ids if uid is not None}

    statement = (
        select(User)
        .join(TrailRun, TrailRun.user_id == User.id)
        .join(UserOrganization, UserOrganization.user_id == User.id)
        .join(Role, Role.id == UserOrganization.role_id)
        .where(
            TrailRun.course_id == course.id,
            UserOrganization.org_id == course.org_id,
            (Role.role_uuid == "role_global_student") | (Role.id == 3),
        )
        .distinct()
    )
    students = db_session.exec(statement).all()

    return [
        UserRead.model_validate(student)
        for student in students
        if student.id is not None and student.id not in existing_member_ids
    ]


async def add_room_students(
    _request: Request,
    course_uuid: str,
    room_id: int,
    user_ids: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> str:
    """
    Add one or more students to the given room.
    Tutor-scoped: the caller must be a tutor of this room (or an admin/maintainer).
    Membership is non-exclusive (a student may belong to multiple rooms).
    """
    course, role_flags = get_course_and_role_flags(
        course_uuid, current_user, db_session
    )
    room = ensure_user_can_manage_room(
        room_id, course, current_user, role_flags, db_session
    )

    user_id_list = parse_user_ids(user_ids)
    if not user_id_list:
        raise HTTPException(status_code=400, detail="No user_ids provided")

    for user_id in user_id_list:
        ensure_user_role_for_room(user_id, course, RoomRoleEnum.student, db_session)

        existing = db_session.exec(
            select(CourseRoomMember).where(
                CourseRoomMember.room_id == room.id,
                CourseRoomMember.user_id == user_id,
            )
        ).first()
        if existing:
            continue

        now = str(datetime.now())
        db_session.add(
            CourseRoomMember(
                room_id=room.id,
                user_id=user_id,
                role=RoomRoleEnum.student,
                creation_date=now,
                update_date=now,
            )
        )
        db_session.commit()

    return "Students added to room successfully"
