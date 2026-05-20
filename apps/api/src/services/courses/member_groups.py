from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Literal

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.course_chapters import CourseChapter_Graph
from src.db.courses.course_member_groups import (
    CourseMemberGroup,
    CourseMemberGroupBulkDeleteResult,
    CourseMemberGroupInvite,
    CourseMemberGroupInviteCreate,
    CourseMemberGroupInviteRead,
    CourseMemberGroupInviteStatusEnum,
    CourseMemberGroupMeRead,
    CourseMemberGroupMember,
    CourseMemberGroupMemberRead,
    CourseMemberGroupPendingCompletion,
    CourseMemberGroupRead,
    CourseMemberGroupRosterStudentRead,
)
from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.services.courses.rooms import get_course_by_uuid, get_user_course_role_flags
from src.services.notifications.service import send_notification


def _now() -> str:
    return datetime.utcnow().isoformat()


def _is_student_role(role_id: int | None) -> bool:
    return role_id == 3


def _build_user_read(user: User) -> UserRead:
    return UserRead.model_validate(user)


def _display_name(user: User) -> str:
    full_name = " ".join(
        part for part in [user.first_name.strip(), user.last_name.strip()] if part
    ).strip()
    return full_name or user.username or user.email


async def notify_group_members_member_left(
    *,
    recipient_user_ids: list[int],
    course: Course,
    departing_user: User,
    db_session: Session,
) -> None:
    if not recipient_user_ids:
        return

    await send_notification(
        topic="broadcast",
        title="Group member left",
        body=f'{_display_name(departing_user)} left your group in {course.name}.',
        level="info",
        user_ids=recipient_user_ids,
        data={
            "kind": "group_member_left",
            "course_id": course.id,
            "course_uuid": course.course_uuid,
            "departing_user_id": departing_user.id,
            "departing_user_name": _display_name(departing_user),
        },
    )


def _load_users_by_id(db_session: Session, user_ids: list[int]) -> dict[int, User]:
    if not user_ids:
        return {}
    users = db_session.exec(select(User).where(User.id.in_(user_ids))).all()
    return {user.id: user for user in users if user.id is not None}


def _load_room_ids_by_user_id(
    db_session: Session,
    *,
    course_id: int,
    user_ids: list[int],
) -> dict[int, list[int]]:
    if not user_ids:
        return {}
    memberships = db_session.exec(
        select(CourseRoomMember.user_id, CourseRoomMember.room_id)
        .join(CourseRoom, CourseRoom.id == CourseRoomMember.room_id)
        .where(
            CourseRoom.course_id == course_id,
            CourseRoomMember.user_id.in_(user_ids),
            CourseRoomMember.role == RoomRoleEnum.student,
        )
    ).all()
    room_ids_by_user_id: dict[int, list[int]] = defaultdict(list)
    for user_id, room_id in memberships:
        if user_id is None or room_id is None:
            continue
        room_ids_by_user_id[user_id].append(room_id)
    return dict(room_ids_by_user_id)


async def require_course_student_context(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> Course:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "read"
    )

    if current_user.id == 0:
        raise HTTPException(status_code=403, detail="Authentication required")

    role_flags = get_user_course_role_flags(current_user.id, course, db_session)
    if role_flags["is_admin"] or role_flags["is_maintainer"] or role_flags["is_tutor"]:
        raise HTTPException(status_code=403, detail="Student enrollment required")

    membership = db_session.exec(
        select(UserOrganization).where(
            UserOrganization.user_id == current_user.id,
            UserOrganization.org_id == course.org_id,
        )
    ).first()
    if not membership or not _is_student_role(membership.role_id):
        raise HTTPException(status_code=403, detail="Student enrollment required")

    trail_run = db_session.exec(
        select(TrailRun).where(
            TrailRun.course_id == course.id,
            TrailRun.user_id == current_user.id,
        )
    ).first()
    if not trail_run:
        raise HTTPException(status_code=403, detail="Student enrollment required")

    return course


async def require_course_staff_context(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> Course:
    course = await get_course_by_uuid(
        request, course_uuid, current_user, db_session, "read"
    )
    if current_user.id == 0:
        raise HTTPException(status_code=403, detail="Authentication required")

    role_flags = get_user_course_role_flags(current_user.id, course, db_session)
    if not (
        role_flags["is_admin"]
        or role_flags["is_maintainer"]
        or role_flags["is_tutor"]
    ):
        raise HTTPException(status_code=403, detail="Course staff access required")
    return course


def get_group_by_member_user_id(
    *,
    course_id: int,
    user_id: int,
    db_session: Session,
) -> CourseMemberGroup | None:
    return db_session.exec(
        select(CourseMemberGroup)
        .join(
            CourseMemberGroupMember,
            CourseMemberGroupMember.group_id == CourseMemberGroup.id,
        )
        .where(
            CourseMemberGroup.course_id == course_id,
            CourseMemberGroupMember.course_id == course_id,
            CourseMemberGroupMember.user_id == user_id,
        )
    ).first()


def get_group_members(
    *,
    group_id: int,
    db_session: Session,
) -> list[CourseMemberGroupMember]:
    return db_session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.group_id == group_id
        )
    ).all()


def cleanup_group_if_needed(
    *,
    group_id: int,
    db_session: Session,
) -> None:
    group = db_session.get(CourseMemberGroup, group_id)
    if not group:
        return

    members = get_group_members(group_id=group_id, db_session=db_session)
    if len(members) >= 2:
        group.update_date = _now()
        db_session.add(group)
        db_session.commit()
        return

    invites = db_session.exec(
        select(CourseMemberGroupInvite).where(CourseMemberGroupInvite.group_id == group_id)
    ).all()
    for invite in invites:
        if invite.status == CourseMemberGroupInviteStatusEnum.pending:
            invite.status = CourseMemberGroupInviteStatusEnum.cancelled
            invite.update_date = _now()
            db_session.add(invite)

    delete_group(group_id=group_id, db_session=db_session)


def ensure_group_for_sender(
    *,
    course: Course,
    sender_user_id: int,
    db_session: Session,
) -> CourseMemberGroup:
    existing = get_group_by_member_user_id(
        course_id=course.id,
        user_id=sender_user_id,
        db_session=db_session,
    )
    if existing:
        return existing

    now = _now()
    group = CourseMemberGroup(
        course_id=course.id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)

    member = CourseMemberGroupMember(
        group_id=group.id or 0,
        course_id=course.id,
        user_id=sender_user_id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return group


def move_user_to_group(
    *,
    course_id: int,
    user_id: int,
    group_id: int,
    db_session: Session,
) -> None:
    current_membership = db_session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.course_id == course_id,
            CourseMemberGroupMember.user_id == user_id,
        )
    ).first()

    previous_group_id = current_membership.group_id if current_membership else None
    if current_membership and current_membership.group_id == group_id:
        return

    if current_membership:
        db_session.delete(current_membership)
        db_session.commit()

    now = _now()
    new_membership = CourseMemberGroupMember(
        group_id=group_id,
        course_id=course_id,
        user_id=user_id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(new_membership)
    db_session.commit()

    if previous_group_id:
        cleanup_group_if_needed(group_id=previous_group_id, db_session=db_session)


def cancel_pending_invites_for_user(
    *,
    course_id: int,
    user_id: int,
    db_session: Session,
) -> None:
    invites = db_session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.course_id == course_id,
            CourseMemberGroupInvite.recipient_user_id == user_id,
            CourseMemberGroupInvite.status == CourseMemberGroupInviteStatusEnum.pending,
        )
    ).all()
    now = _now()
    for invite in invites:
        invite.status = CourseMemberGroupInviteStatusEnum.cancelled
        invite.update_date = now
        db_session.add(invite)
    db_session.commit()


def delete_pending_group_completions_for_user(
    *,
    course_id: int,
    user_id: int,
    db_session: Session,
) -> None:
    pending_rows = db_session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.course_id == course_id,
            CourseMemberGroupPendingCompletion.user_id == user_id,
        )
    ).all()
    for pending in pending_rows:
        db_session.delete(pending)
    db_session.commit()


def serialize_group(
    *,
    group: CourseMemberGroup,
    db_session: Session,
) -> CourseMemberGroupRead:
    members = get_group_members(group_id=group.id or 0, db_session=db_session)
    user_ids = [member.user_id for member in members]
    users_by_id = _load_users_by_id(db_session, user_ids)
    room_ids_by_user_id = _load_room_ids_by_user_id(
        db_session,
        course_id=group.course_id,
        user_ids=user_ids,
    )
    return CourseMemberGroupRead(
        id=group.id or 0,
        member_count=len(members),
        members=[
            CourseMemberGroupMemberRead(
                user=_build_user_read(users_by_id[member.user_id]),
                room_ids=room_ids_by_user_id.get(member.user_id, []),
            )
            for member in members
            if member.user_id in users_by_id
        ],
        creation_date=group.creation_date,
        update_date=group.update_date,
    )


def serialize_invite(
    *,
    invite: CourseMemberGroupInvite,
    users_by_id: dict[int, User],
) -> CourseMemberGroupInviteRead:
    sender = users_by_id.get(invite.sender_user_id)
    recipient = users_by_id.get(invite.recipient_user_id)
    if sender is None or recipient is None:
        raise HTTPException(status_code=500, detail="Invite user missing")
    return CourseMemberGroupInviteRead(
        id=invite.id or 0,
        status=invite.status,
        sender=_build_user_read(sender),
        recipient=_build_user_read(recipient),
        creation_date=invite.creation_date,
        update_date=invite.update_date,
    )


async def get_my_member_group(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseMemberGroupMeRead:
    course = await require_course_student_context(
        request, course_uuid, current_user, db_session
    )
    group = get_group_by_member_user_id(
        course_id=course.id,
        user_id=current_user.id,
        db_session=db_session,
    )
    invites = db_session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.course_id == course.id,
            (
                (CourseMemberGroupInvite.sender_user_id == current_user.id)
                | (CourseMemberGroupInvite.recipient_user_id == current_user.id)
            ),
        )
    ).all()
    invite_user_ids = list(
        {
            invite.sender_user_id
            for invite in invites
        }
        | {
            invite.recipient_user_id
            for invite in invites
        }
    )
    users_by_id = _load_users_by_id(db_session, invite_user_ids)
    return CourseMemberGroupMeRead(
        group=serialize_group(group=group, db_session=db_session) if group else None,
        sent_invites=[
            serialize_invite(invite=invite, users_by_id=users_by_id)
            for invite in invites
            if invite.sender_user_id == current_user.id
            and invite.status == CourseMemberGroupInviteStatusEnum.pending
        ],
        received_invites=[
            serialize_invite(invite=invite, users_by_id=users_by_id)
            for invite in invites
            if invite.recipient_user_id == current_user.id
            and invite.status == CourseMemberGroupInviteStatusEnum.pending
        ],
    )


async def get_member_group_roster(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[CourseMemberGroupRosterStudentRead]:
    course = await require_course_student_context(
        request, course_uuid, current_user, db_session
    )
    students = db_session.exec(
        select(User)
        .join(TrailRun, TrailRun.user_id == User.id)
        .join(
            UserOrganization,
            (UserOrganization.user_id == User.id)
            & (UserOrganization.org_id == course.org_id),
        )
        .where(
            TrailRun.course_id == course.id,
            UserOrganization.role_id == 3,
        )
    ).all()
    user_ids = [student.id for student in students if student.id is not None]
    room_ids_by_user_id = _load_room_ids_by_user_id(
        db_session,
        course_id=course.id,
        user_ids=user_ids,
    )
    current_user_room_ids = set(room_ids_by_user_id.get(current_user.id, []))
    memberships = []
    if user_ids:
        memberships = db_session.exec(
            select(CourseMemberGroupMember).where(
                CourseMemberGroupMember.course_id == course.id,
                CourseMemberGroupMember.user_id.in_(user_ids),
            )
        ).all()
    group_id_by_user_id = {membership.user_id: membership.group_id for membership in memberships}
    pending_sent = {
        invite.recipient_user_id
        for invite in db_session.exec(
            select(CourseMemberGroupInvite).where(
                CourseMemberGroupInvite.course_id == course.id,
                CourseMemberGroupInvite.sender_user_id == current_user.id,
                CourseMemberGroupInvite.status == CourseMemberGroupInviteStatusEnum.pending,
            )
        ).all()
    }
    pending_received = {
        invite.sender_user_id
        for invite in db_session.exec(
            select(CourseMemberGroupInvite).where(
                CourseMemberGroupInvite.course_id == course.id,
                CourseMemberGroupInvite.recipient_user_id == current_user.id,
                CourseMemberGroupInvite.status == CourseMemberGroupInviteStatusEnum.pending,
            )
        ).all()
    }
    return [
        CourseMemberGroupRosterStudentRead(
            user=_build_user_read(student),
            room_ids=room_ids_by_user_id.get(student.id or 0, []),
            group_id=group_id_by_user_id.get(student.id or 0),
            has_pending_invite_from_me=(student.id or 0) in pending_sent,
            has_pending_invite_to_me=(student.id or 0) in pending_received,
        )
        for student in students
        if student.id is not None
        and student.id != current_user.id
        and bool(
            current_user_room_ids.intersection(
                set(room_ids_by_user_id.get(student.id or 0, []))
            )
        )
    ]


async def create_member_group_invites(
    request: Request,
    course_uuid: str,
    payload: CourseMemberGroupInviteCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseMemberGroupMeRead:
    course = await require_course_student_context(
        request, course_uuid, current_user, db_session
    )
    recipient_ids = list(dict.fromkeys(payload.recipient_user_ids))
    if not recipient_ids:
        raise HTTPException(status_code=400, detail="No recipients provided")

    eligible_students = db_session.exec(
        select(User)
        .join(TrailRun, TrailRun.user_id == User.id)
        .join(
            UserOrganization,
            (UserOrganization.user_id == User.id)
            & (UserOrganization.org_id == course.org_id),
        )
        .where(
            TrailRun.course_id == course.id,
            UserOrganization.role_id == 3,
            User.id.in_(recipient_ids),
        )
    ).all()
    eligible_ids = {student.id for student in eligible_students if student.id is not None}
    invalid_ids = [user_id for user_id in recipient_ids if user_id not in eligible_ids]
    if invalid_ids:
        raise HTTPException(status_code=400, detail="Invalid invite recipients")

    group = ensure_group_for_sender(
        course=course,
        sender_user_id=current_user.id,
        db_session=db_session,
    )
    now = _now()
    for recipient_id in recipient_ids:
        if recipient_id == current_user.id:
            continue
        existing_membership = db_session.exec(
            select(CourseMemberGroupMember).where(
                CourseMemberGroupMember.course_id == course.id,
                CourseMemberGroupMember.user_id == recipient_id,
                CourseMemberGroupMember.group_id == group.id,
            )
        ).first()
        if existing_membership:
            continue

        old_pending = db_session.exec(
            select(CourseMemberGroupInvite).where(
                CourseMemberGroupInvite.course_id == course.id,
                CourseMemberGroupInvite.recipient_user_id == recipient_id,
                CourseMemberGroupInvite.status == CourseMemberGroupInviteStatusEnum.pending,
            )
        ).all()
        for invite in old_pending:
            invite.status = CourseMemberGroupInviteStatusEnum.cancelled
            invite.update_date = now
            db_session.add(invite)

        invite = CourseMemberGroupInvite(
            group_id=group.id or 0,
            course_id=course.id,
            sender_user_id=current_user.id,
            recipient_user_id=recipient_id,
            status=CourseMemberGroupInviteStatusEnum.pending,
            creation_date=now,
            update_date=now,
        )
        db_session.add(invite)
    db_session.commit()

    sender = db_session.get(User, current_user.id)
    if sender:
        for recipient_id in recipient_ids:
            if recipient_id == current_user.id:
                continue
            recipient = db_session.get(User, recipient_id)
            if not recipient:
                continue
            await send_notification(
                topic=f"user/{recipient_id}",
                title="New group invite",
                body=f'{_display_name(sender)} invited you to a course group in {course.name}.',
                level="info",
                user_id=recipient_id,
                data={
                    "kind": "group_invite_received",
                    "course_id": course.id,
                    "course_uuid": course_uuid,
                    "group_id": group.id,
                    "sender_user_id": sender.id,
                    "sender_name": _display_name(sender),
                },
            )
    return await get_my_member_group(request, course_uuid, current_user, db_session)


async def accept_member_group_invite(
    request: Request,
    course_uuid: str,
    invite_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseMemberGroupMeRead:
    course = await require_course_student_context(
        request, course_uuid, current_user, db_session
    )
    invite = db_session.get(CourseMemberGroupInvite, invite_id)
    if not invite or invite.course_id != course.id:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.recipient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Invite access denied")
    if invite.status != CourseMemberGroupInviteStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    move_user_to_group(
        course_id=course.id,
        user_id=current_user.id,
        group_id=invite.group_id,
        db_session=db_session,
    )
    cancel_pending_invites_for_user(
        course_id=course.id,
        user_id=current_user.id,
        db_session=db_session,
    )
    invite.status = CourseMemberGroupInviteStatusEnum.accepted
    invite.update_date = _now()
    db_session.add(invite)
    db_session.commit()
    cleanup_group_if_needed(group_id=invite.group_id, db_session=db_session)

    sender = db_session.get(User, invite.sender_user_id)
    recipient = db_session.get(User, current_user.id)
    if sender and recipient:
        await send_notification(
            topic=f"user/{sender.id}",
            title="Group invite accepted",
            body=f'{_display_name(recipient)} accepted your group invite in {course.name}.',
            level="success",
            user_id=sender.id,
            data={
                "kind": "group_invite_accepted",
                "course_id": course.id,
                "course_uuid": course_uuid,
                "group_id": invite.group_id,
                "recipient_user_id": recipient.id,
                "recipient_name": _display_name(recipient),
            },
        )
    return await get_my_member_group(request, course_uuid, current_user, db_session)


async def decline_member_group_invite(
    request: Request,
    course_uuid: str,
    invite_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseMemberGroupMeRead:
    course = await require_course_student_context(
        request, course_uuid, current_user, db_session
    )
    invite = db_session.get(CourseMemberGroupInvite, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.recipient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Invite access denied")
    if invite.status != CourseMemberGroupInviteStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Invite is no longer pending")
    invite.status = CourseMemberGroupInviteStatusEnum.declined
    invite.update_date = _now()
    db_session.add(invite)
    db_session.commit()

    sender = db_session.get(User, invite.sender_user_id)
    recipient = db_session.get(User, current_user.id)
    if sender and recipient:
        await send_notification(
            topic=f"user/{sender.id}",
            title="Group invite declined",
            body=f'{_display_name(recipient)} declined your group invite in {course.name}.',
            level="info",
            user_id=sender.id,
            data={
                "kind": "group_invite_declined",
                "course_id": course.id,
                "course_uuid": course_uuid,
                "group_id": invite.group_id,
                "recipient_user_id": recipient.id,
                "recipient_name": _display_name(recipient),
            },
        )
    return await get_my_member_group(request, course_uuid, current_user, db_session)


async def leave_member_group(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseMemberGroupMeRead:
    course = await require_course_student_context(
        request, course_uuid, current_user, db_session
    )
    membership = db_session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.course_id == course.id,
            CourseMemberGroupMember.user_id == current_user.id,
        )
    ).first()
    if not membership:
        return await get_my_member_group(request, course_uuid, current_user, db_session)

    group_id = membership.group_id
    peer_user_ids = [
        member.user_id
        for member in get_group_members(group_id=group_id, db_session=db_session)
        if member.user_id != current_user.id
    ]
    departing_user = db_session.get(User, current_user.id)
    db_session.delete(membership)
    db_session.commit()
    cleanup_group_if_needed(group_id=group_id, db_session=db_session)
    if departing_user:
        await notify_group_members_member_left(
            recipient_user_ids=peer_user_ids,
            course=course,
            departing_user=departing_user,
            db_session=db_session,
        )
    return await get_my_member_group(request, course_uuid, current_user, db_session)


async def list_course_member_groups(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[CourseMemberGroupRead]:
    course = await require_course_staff_context(
        request, course_uuid, current_user, db_session
    )
    groups = db_session.exec(
        select(CourseMemberGroup).where(CourseMemberGroup.course_id == course.id)
    ).all()
    return [serialize_group(group=group, db_session=db_session) for group in groups]


def delete_group_ids(*, group_ids: list[int], db_session: Session) -> list[int]:
    deleted: list[int] = []
    for group_id in group_ids:
        group = db_session.get(CourseMemberGroup, group_id)
        if not group:
            continue
        deleted.append(group_id)
        delete_group(group_id=group_id, db_session=db_session)
    return deleted


def delete_group(
    *,
    group_id: int,
    db_session: Session,
) -> None:
    members = db_session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.group_id == group_id
        )
    ).all()
    invites = db_session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.group_id == group_id
        )
    ).all()
    pending = db_session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.group_id == group_id
        )
    ).all()
    group = db_session.get(CourseMemberGroup, group_id)

    for row in pending:
        db_session.delete(row)
    for row in invites:
        db_session.delete(row)
    for row in members:
        db_session.delete(row)
    if group:
        db_session.delete(group)
    db_session.commit()


async def bulk_delete_course_member_groups(
    request: Request,
    course_uuid: str,
    mode: Literal["all", "rooms"],
    room_ids: list[int],
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> CourseMemberGroupBulkDeleteResult:
    course = await require_course_staff_context(
        request, course_uuid, current_user, db_session
    )
    if mode == "all":
        group_ids = db_session.exec(
            select(CourseMemberGroup.id).where(CourseMemberGroup.course_id == course.id)
        ).all()
        deleted = delete_group_ids(group_ids=[gid for gid in group_ids if gid is not None], db_session=db_session)
        return CourseMemberGroupBulkDeleteResult(
            deleted_group_ids=deleted,
            deleted_count=len(deleted),
        )

    if mode != "rooms":
        raise HTTPException(status_code=400, detail="Invalid mode")
    if not room_ids:
        raise HTTPException(status_code=400, detail="room_ids required for room mode")

    user_ids = db_session.exec(
        select(CourseRoomMember.user_id)
        .join(CourseRoom, CourseRoom.id == CourseRoomMember.room_id)
        .where(
            CourseRoom.course_id == course.id,
            CourseRoomMember.room_id.in_(room_ids),
            CourseRoomMember.role == RoomRoleEnum.student,
        )
    ).all()
    unique_user_ids = [user_id for user_id in user_ids if user_id is not None]
    if not unique_user_ids:
        return CourseMemberGroupBulkDeleteResult(
            deleted_group_ids=[],
            deleted_count=0,
        )

    group_ids = db_session.exec(
        select(CourseMemberGroupMember.group_id).where(
            CourseMemberGroupMember.course_id == course.id,
            CourseMemberGroupMember.user_id.in_(unique_user_ids),
        )
    ).all()
    deleted = delete_group_ids(
        group_ids=sorted({group_id for group_id in group_ids if group_id is not None}),
        db_session=db_session,
    )
    return CourseMemberGroupBulkDeleteResult(
        deleted_group_ids=deleted,
        deleted_count=len(deleted),
    )


async def remove_member_from_course_group(
    request: Request,
    course_uuid: str,
    group_id: int,
    user_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[CourseMemberGroupRead]:
    course = await require_course_staff_context(
        request, course_uuid, current_user, db_session
    )

    group = db_session.get(CourseMemberGroup, group_id)
    if not group or group.course_id != course.id:
        raise HTTPException(status_code=404, detail="Group not found")

    membership = db_session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.group_id == group_id,
            CourseMemberGroupMember.course_id == course.id,
            CourseMemberGroupMember.user_id == user_id,
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Group member not found")

    peer_user_ids = [
        member.user_id
        for member in get_group_members(group_id=group_id, db_session=db_session)
        if member.user_id != user_id
    ]
    departing_user = db_session.get(User, user_id)
    db_session.delete(membership)
    db_session.commit()

    delete_pending_group_completions_for_user(
        course_id=course.id,
        user_id=user_id,
        db_session=db_session,
    )
    cleanup_group_if_needed(group_id=group_id, db_session=db_session)
    if departing_user:
        await notify_group_members_member_left(
            recipient_user_ids=peer_user_ids,
            course=course,
            departing_user=departing_user,
            db_session=db_session,
        )

    groups = db_session.exec(
        select(CourseMemberGroup).where(CourseMemberGroup.course_id == course.id)
    ).all()
    return [serialize_group(group=entry, db_session=db_session) for entry in groups]


def get_group_peer_user_ids(
    *,
    course_id: int,
    user_id: int,
    db_session: Session,
) -> list[int]:
    group = get_group_by_member_user_id(
        course_id=course_id,
        user_id=user_id,
        db_session=db_session,
    )
    if not group:
        return []
    members = get_group_members(group_id=group.id or 0, db_session=db_session)
    return [
        member.user_id
        for member in members
        if member.user_id != user_id
    ]


def get_group_member_user_ids(
    *,
    course_id: int,
    user_id: int,
    db_session: Session,
    include_user: bool = True,
) -> list[int]:
    group = get_group_by_member_user_id(
        course_id=course_id,
        user_id=user_id,
        db_session=db_session,
    )
    if not group:
        return [user_id] if include_user else []

    members = get_group_members(group_id=group.id or 0, db_session=db_session)
    member_user_ids = [
        member.user_id
        for member in members
        if include_user or member.user_id != user_id
    ]
    return sorted({member_user_ids_item for member_user_ids_item in member_user_ids})


def _get_activity_chapter_context(
    *,
    course_id: int,
    activity_uuid: str,
    db_session: Session,
) -> tuple[int, int, list[int]] | None:
    activity = db_session.exec(
        select(Activity).where(
            Activity.course_id == course_id,
            Activity.activity_uuid == activity_uuid,
        )
    ).first()
    if not activity or activity.id is None:
        return None

    link = db_session.exec(
        select(ChapterActivity).where(
            ChapterActivity.course_id == course_id,
            ChapterActivity.activity_id == activity.id,
        )
    ).first()
    if not link:
        return None

    chapter_edges = db_session.exec(
        select(CourseChapter_Graph).where(
            CourseChapter_Graph.course_id == course_id,
            CourseChapter_Graph.chapter_id == link.chapter_id,
        )
    ).all()
    predecessor_ids = [
        edge.predecessor_id
        for edge in chapter_edges
        if edge.predecessor_id is not None
    ]
    return link.chapter_id, link.order, predecessor_ids


def _get_last_activity_uuid_for_chapter(
    *,
    course_id: int,
    chapter_id: int,
    db_session: Session,
) -> str | None:
    chapter_activity = db_session.exec(
        select(ChapterActivity)
        .where(
            ChapterActivity.course_id == course_id,
            ChapterActivity.chapter_id == chapter_id,
        )
        .order_by(ChapterActivity.order.desc())
    ).first()
    if not chapter_activity:
        return None
    activity = db_session.get(Activity, chapter_activity.activity_id)
    if not activity:
        return None
    return activity.activity_uuid


def _user_has_completed_activity(
    *,
    course_id: int,
    user_id: int,
    activity_uuid: str,
    db_session: Session,
) -> bool:
    step = db_session.exec(
        select(TrailStep).where(
            TrailStep.course_id == course_id,
            TrailStep.user_id == user_id,
            TrailStep.activity_uuid == activity_uuid,
        )
    ).first()
    return bool(step and step.complete)


def can_user_receive_group_completion_now(
    *,
    course_id: int,
    user_id: int,
    activity_uuid: str,
    db_session: Session,
) -> bool:
    existing_step = db_session.exec(
        select(TrailStep).where(
            TrailStep.course_id == course_id,
            TrailStep.user_id == user_id,
            TrailStep.activity_uuid == activity_uuid,
        )
    ).first()
    if existing_step:
        return True

    context = _get_activity_chapter_context(
        course_id=course_id,
        activity_uuid=activity_uuid,
        db_session=db_session,
    )
    if context is None:
        return False

    chapter_id, activity_order, predecessor_ids = context
    for predecessor_id in predecessor_ids:
        last_predecessor_activity = _get_last_activity_uuid_for_chapter(
            course_id=course_id,
            chapter_id=predecessor_id,
            db_session=db_session,
        )
        if last_predecessor_activity and not _user_has_completed_activity(
            course_id=course_id,
            user_id=user_id,
            activity_uuid=last_predecessor_activity,
            db_session=db_session,
        ):
            return False

    if activity_order <= 1:
        return True

    previous_link = db_session.exec(
        select(ChapterActivity)
        .where(
            ChapterActivity.course_id == course_id,
            ChapterActivity.chapter_id == chapter_id,
            ChapterActivity.order == activity_order - 1,
        )
    ).first()
    if not previous_link:
        return True
    previous_activity = db_session.get(Activity, previous_link.activity_id)
    if not previous_activity:
        return True
    return _user_has_completed_activity(
        course_id=course_id,
        user_id=user_id,
        activity_uuid=previous_activity.activity_uuid,
        db_session=db_session,
    )


async def queue_group_pending_completion(
    *,
    course_id: int,
    user_id: int,
    source_user_id: int,
    activity_uuid: str,
    db_session: Session,
) -> None:
    group = get_group_by_member_user_id(
        course_id=course_id,
        user_id=user_id,
        db_session=db_session,
    )
    if not group:
        return
    existing = db_session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.course_id == course_id,
            CourseMemberGroupPendingCompletion.user_id == user_id,
            CourseMemberGroupPendingCompletion.activity_uuid == activity_uuid,
        )
    ).first()
    now = _now()
    if existing:
        existing.source_user_id = source_user_id
        existing.update_date = now
        db_session.add(existing)
    else:
        db_session.add(
            CourseMemberGroupPendingCompletion(
                group_id=group.id or 0,
                course_id=course_id,
                user_id=user_id,
                source_user_id=source_user_id,
                activity_uuid=activity_uuid,
                creation_date=now,
                update_date=now,
            )
        )
    db_session.commit()

    source_user = db_session.get(User, source_user_id)
    activity = db_session.exec(
        select(Activity).where(
            Activity.course_id == course_id,
            Activity.activity_uuid == activity_uuid,
        )
    ).first()
    if source_user and activity:
        await send_notification(
            topic=f"user/{user_id}",
            title="Group progress waiting",
            body=f'{source_user.first_name or source_user.username} completed "{activity.name}" for your group. Start it to sync your progress.',
            level="info",
            user_id=user_id,
            data={
                "kind": "group_pending_completion",
                "course_id": course_id,
                "activity_uuid": activity_uuid,
                "source_user_id": source_user_id,
            },
        )


async def apply_pending_group_completion_if_any(
    *,
    course_id: int,
    user: PublicUser,
    activity_uuid: str,
    request: Request,
    db_session: Session,
) -> bool:
    pending = db_session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.course_id == course_id,
            CourseMemberGroupPendingCompletion.user_id == user.id,
            CourseMemberGroupPendingCompletion.activity_uuid == activity_uuid,
        )
    ).first()
    if not pending:
        return False

    from src.services.trail.trail import add_activity_to_trail

    await add_activity_to_trail(
        request=request,
        user=user,
        activity_uuid=activity_uuid,
        db_session=db_session,
        complete=True,
        propagate_group_completion=False,
        emit_group_activity_state_sync=False,
    )
    db_session.delete(pending)
    db_session.commit()
    return True
