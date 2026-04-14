from datetime import datetime
from typing import Literal, List

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.courses.courses import Course
from src.db.courses.course_rooms import (
    CourseRoom,
    CourseRoomCreate,
    CourseRoomMember,
    CourseRoomMemberRead,
    CourseRoomRead,
    CourseRoomUpdate,
    RoomRoleEnum,
)
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_element_is_public,
    authorization_verify_if_user_is_anon,
)



async def get_course_by_uuid(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    action: Literal["create", "read", "update", "delete"],
) -> Course:
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await rbac_check(request, course.course_uuid, current_user, action, db_session)
    return course


async def rbac_check(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
):
    if action == "read":
        if current_user.id == 0:
            return await authorization_verify_if_element_is_public(
                request, course_uuid, action, db_session
            )
        return await authorization_verify_based_on_roles_and_authorship(
            request, current_user.id, action, course_uuid, db_session
        )

    await authorization_verify_if_user_is_anon(current_user.id)
    await authorization_verify_based_on_roles_and_authorship(
        request, current_user.id, action, course_uuid, db_session
    )


def parse_user_ids(user_ids: str) -> List[int]:
    if not user_ids:
        return []
    try:
        return [int(uid) for uid in user_ids.split(",") if uid.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid user_ids") from exc


def to_room_read(room: CourseRoom, student_count: int, tutor_count: int) -> CourseRoomRead:
    return CourseRoomRead(
        id=room.id or 0,
        course_id=room.course_id,
        name=room.name,
        description=room.description,
        creation_date=room.creation_date,
        update_date=room.update_date,
        student_count=student_count,
        tutor_count=tutor_count,
    )


async def list_course_rooms(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> List[CourseRoomRead]:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "read"
    )

    rooms = db_session.exec(
        select(CourseRoom).where(CourseRoom.course_id == course.id)
    ).all()

    room_ids = [room.id for room in rooms if room.id is not None]
    member_counts: dict[int, dict[str, int]] = {
        room_id: {"student": 0, "tutor": 0} for room_id in room_ids
    }

    if room_ids:
        members = db_session.exec(
            select(CourseRoomMember).where(CourseRoomMember.room_id.in_(room_ids))
        ).all()
        for member in members:
            if member.room_id not in member_counts:
                member_counts[member.room_id] = {"student": 0, "tutor": 0}
            if member.role == RoomRoleEnum.tutor:
                member_counts[member.room_id]["tutor"] += 1
            else:
                member_counts[member.room_id]["student"] += 1

    return [
        to_room_read(
            room,
            member_counts.get(room.id or 0, {}).get("student", 0),
            member_counts.get(room.id or 0, {}).get("tutor", 0),
        )
        for room in rooms
    ]


async def create_course_room(
    request: Request,
    course_uuid: str,
    room_object: CourseRoomCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseRoomRead:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "create"
    )

    room = CourseRoom(
        **room_object.model_dump(),
        course_id=course.id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    return to_room_read(room, 0, 0)


async def update_course_room(
    request: Request,
    course_uuid: str,
    room_id: int,
    room_object: CourseRoomUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseRoomRead:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "update"
    )

    room = db_session.exec(
        select(CourseRoom).where(
            CourseRoom.id == room_id, CourseRoom.course_id == course.id
        )
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room_object.name is not None:
        room.name = room_object.name
    if room_object.description is not None:
        room.description = room_object.description
    room.update_date = str(datetime.now())

    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    members = db_session.exec(
        select(CourseRoomMember).where(CourseRoomMember.room_id == room.id)
    ).all()
    student_count = sum(1 for member in members if member.role == RoomRoleEnum.student)
    tutor_count = sum(1 for member in members if member.role == RoomRoleEnum.tutor)

    return to_room_read(room, student_count, tutor_count)


async def delete_course_room(
    request: Request,
    course_uuid: str,
    room_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> str:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "delete"
    )

    room = db_session.exec(
        select(CourseRoom).where(
            CourseRoom.id == room_id, CourseRoom.course_id == course.id
        )
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    db_session.delete(room)
    db_session.commit()
    return "Room deleted successfully"


async def list_course_room_members(
    request: Request,
    course_uuid: str,
    room_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> List[CourseRoomMemberRead]:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "read"
    )

    room = db_session.exec(
        select(CourseRoom).where(
            CourseRoom.id == room_id, CourseRoom.course_id == course.id
        )
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    members = db_session.exec(
        select(CourseRoomMember).where(CourseRoomMember.room_id == room.id)
    ).all()

    user_ids = [member.user_id for member in members]
    users = []
    if user_ids:
        users = db_session.exec(select(User).where(User.id.in_(user_ids))).all()

    users_by_id = {user.id: user for user in users if user.id is not None}

    return [
        CourseRoomMemberRead(
            user=UserRead.model_validate(users_by_id[member.user_id]),
            role=member.role,
        )
        for member in members
        if member.user_id in users_by_id
    ]


def ensure_user_role_for_room(
    user_id: int,
    course: Course,
    role: RoomRoleEnum,
    db_session: Session,
) -> None:
    statement = (
        select(UserOrganization, Role)
        .join(Role, Role.id == UserOrganization.role_id)
        .where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == course.org_id,
        )
    )
    result = db_session.exec(statement).first()

    if not result:
        raise HTTPException(status_code=404, detail="User not found in organization")

    role_obj = result[1]
    role_uuid = role_obj.role_uuid if role_obj else None
    role_id = role_obj.id if role_obj else None

    if role == RoomRoleEnum.student and not (
        role_uuid == "role_global_student" or role_id == 3
    ):
        raise HTTPException(
            status_code=400, detail="User does not have a student role"
        )
    if role == RoomRoleEnum.tutor and not (
        role_uuid == "role_global_tutor" or role_id == 4
    ):
        raise HTTPException(
            status_code=400, detail="User does not have a tutor role"
        )


async def add_course_room_members(
    request: Request,
    course_uuid: str,
    room_id: int,
    user_ids: str,
    role: RoomRoleEnum,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> str:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "update"
    )

    room = db_session.exec(
        select(CourseRoom).where(
            CourseRoom.id == room_id, CourseRoom.course_id == course.id
        )
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    user_id_list = parse_user_ids(user_ids)
    if not user_id_list:
        raise HTTPException(status_code=400, detail="No user_ids provided")

    for user_id in user_id_list:
        ensure_user_role_for_room(user_id, course, role, db_session)

        statement = select(CourseRoomMember).where(
            CourseRoomMember.room_id == room.id,
            CourseRoomMember.user_id == user_id,
        )
        member = db_session.exec(statement).first()

        if member:
            member.role = role
            member.update_date = str(datetime.now())
            db_session.add(member)
            db_session.commit()
            continue

        new_member = CourseRoomMember(
            room_id=room.id,
            user_id=user_id,
            role=role,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(new_member)
        db_session.commit()

    return "Users added to room successfully"


async def remove_course_room_members(
    request: Request,
    course_uuid: str,
    room_id: int,
    user_ids: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> str:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "update"
    )

    room = db_session.exec(
        select(CourseRoom).where(
            CourseRoom.id == room_id, CourseRoom.course_id == course.id
        )
    ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    user_id_list = parse_user_ids(user_ids)
    if not user_id_list:
        raise HTTPException(status_code=400, detail="No user_ids provided")

    for user_id in user_id_list:
        member = db_session.exec(
            select(CourseRoomMember).where(
                CourseRoomMember.room_id == room.id,
                CourseRoomMember.user_id == user_id,
            )
        ).first()
        if member:
            db_session.delete(member)
            db_session.commit()

    return "Users removed from room successfully"
