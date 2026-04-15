from datetime import datetime

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
from src.db.users import AnonymousUser, PublicUser


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
        room_id=selection.room_id if selection else None
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
        selection.update_date = now
    else:
        selection = CourseTutorRoomSelection(
            course_id=course.id,
            user_id=current_user.id,
            room_id=room.id,
            creation_date=now,
            update_date=now,
        )
        db_session.add(selection)

    db_session.commit()
    db_session.refresh(selection)

    return CourseTutorRoomSelectionRead(room_id=selection.room_id)


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

    return CourseTutorRoomSelectionRead(room_id=None)
