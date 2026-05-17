import asyncio
from datetime import datetime
from uuid import uuid4

from sqlmodel import Session, select
from starlette.requests import Request

from src.db.courses.activities import (
    Activity,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter_Graph
from src.db.courses.course_member_groups import (
    CourseMemberGroup,
    CourseMemberGroupInviteCreate,
    CourseMemberGroupInvite,
    CourseMemberGroupInviteStatusEnum,
    CourseMemberGroupMember,
    CourseMemberGroupPendingCompletion,
)
from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from src.db.courses.course_tabs import CourseTab
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.db.trail_steps import TrailStep
from src.services.courses.member_groups import (
    accept_member_group_invite,
    bulk_delete_course_member_groups,
    create_member_group_invites,
    decline_member_group_invite,
    remove_member_from_course_group,
)
from src.services.trail.trail import add_activity_to_trail


def _build_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/courses/member-groups",
            "headers": [],
        }
    )


def _now() -> str:
    return datetime.utcnow().isoformat()


def _create_student(session: Session, org_id: int, username: str) -> User:
    now = _now()
    user = User(
        username=username,
        first_name=username.capitalize(),
        last_name="Student",
        email=f"{username}@wayne.com",
        password="secret",
        user_uuid=f"user_{uuid4()}",
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
            role_id=3,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()
    return user


def _create_course_with_activities(session: Session) -> tuple[Course, list[Activity], User]:
    org = session.exec(
        select(Organization).where(Organization.slug == "wayne")
    ).first()
    assert org is not None
    batman = session.exec(select(User).where(User.username == "batman")).first()
    assert batman is not None

    now = _now()
    course = Course(
        name=f"Groups {uuid4()}",
        description="",
        about="",
        learnings="",
        tags="",
        thumbnail_image="",
        public=False,
        org_id=org.id,
        course_uuid=f"course_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)

    session.add(
        ResourceAuthor(
            resource_uuid=course.course_uuid,
            user_id=batman.id or 0,
            authorship=ResourceAuthorshipEnum.CREATOR,
            creation_date=now,
            update_date=now,
        )
    )
    session.add(
        CourseTab(
            tab_uuid=f"tab-1{course.course_uuid}",
            course_id=course.id or 0,
            course_uuid=course.course_uuid,
            name="Tab 1",
            position=0,
            visible=True,
            creation_date=now,
            update_date=now,
        )
    )
    session.commit()

    chapter_one = Chapter(
        name="Chapter 1",
        description="",
        thumbnail_image="",
        org_id=org.id,
        course_id=course.id or 0,
        xp_reward=0,
        coin_reward=0,
        chapter_uuid=f"chapter_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    chapter_two = Chapter(
        name="Chapter 2",
        description="",
        thumbnail_image="",
        org_id=org.id,
        course_id=course.id or 0,
        xp_reward=0,
        coin_reward=0,
        chapter_uuid=f"chapter_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(chapter_one)
    session.add(chapter_two)
    session.commit()
    session.refresh(chapter_one)
    session.refresh(chapter_two)

    session.add(
        CourseChapter_Graph(
            course_id=course.id or 0,
            chapter_id=chapter_one.id or 0,
            predecessor_id=None,
            tab_uuid=f"tab-1{course.course_uuid}",
        )
    )
    session.add(
        CourseChapter_Graph(
            course_id=course.id or 0,
            chapter_id=chapter_two.id or 0,
            predecessor_id=chapter_one.id or 0,
            tab_uuid=f"tab-1{course.course_uuid}",
        )
    )
    session.commit()

    activities: list[Activity] = []
    for index, chapter in enumerate([chapter_one, chapter_two], start=1):
        activity = Activity(
            name=f"Activity {index}",
            activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
            content={},
            published=True,
            org_id=org.id,
            course_id=course.id or 0,
            activity_uuid=f"activity_{uuid4()}",
            creation_date=now,
            update_date=now,
        )
        session.add(activity)
        session.commit()
        session.refresh(activity)
        session.add(
            ChapterActivity(
                order=1,
                chapter_id=chapter.id or 0,
                activity_id=activity.id or 0,
                course_id=course.id or 0,
                org_id=org.id,
                creation_date=now,
                update_date=now,
            )
        )
        session.commit()
        activities.append(activity)

    return course, activities, batman


def _enroll_in_started_course(
    session: Session,
    user: User,
    activity: Activity,
) -> None:
    asyncio.run(
        add_activity_to_trail(
            _build_request(),
            user,
            activity.activity_uuid,
            session,
            complete=False,
        )
    )


def test_member_group_invite_accept_and_decline(session: Session):
    course, activities, _ = _create_course_with_activities(session)
    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    alfred = _create_student(session, org.id, "alfred")
    barbara = _create_student(session, org.id, "barbara")

    for user in [robin, alfred, barbara]:
        _enroll_in_started_course(session, user, activities[0])

    response = asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[alfred.id or 0, barbara.id or 0]
            ),
            current_user=robin,
            db_session=session,
        )
    )

    assert response.group is not None
    assert response.group.member_count == 1
    assert len(response.sent_invites) == 2

    invite_to_alfred = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.recipient_user_id == alfred.id
        )
    ).first()
    invite_to_barbara = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.recipient_user_id == barbara.id
        )
    ).first()
    assert invite_to_alfred is not None
    assert invite_to_barbara is not None

    accepted = asyncio.run(
        accept_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite_to_alfred.id or 0,
            current_user=alfred,
            db_session=session,
        )
    )
    declined = asyncio.run(
        decline_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite_to_barbara.id or 0,
            current_user=barbara,
            db_session=session,
        )
    )

    invite_to_alfred = session.get(CourseMemberGroupInvite, invite_to_alfred.id)
    invite_to_barbara = session.get(CourseMemberGroupInvite, invite_to_barbara.id)
    memberships = session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.course_id == course.id
        )
    ).all()

    assert accepted.group is not None
    assert accepted.group.member_count == 2
    assert declined.received_invites == []
    assert invite_to_alfred is not None
    assert invite_to_alfred.status == CourseMemberGroupInviteStatusEnum.accepted
    assert invite_to_barbara is not None
    assert invite_to_barbara.status == CourseMemberGroupInviteStatusEnum.declined
    assert len(memberships) == 2


def test_accepting_new_invite_moves_member_and_deletes_old_small_group(session: Session):
    course, activities, _ = _create_course_with_activities(session)
    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    alfred = _create_student(session, org.id, "alfred_move")
    barbara = _create_student(session, org.id, "barbara_move")

    for user in [robin, alfred, barbara]:
        _enroll_in_started_course(session, user, activities[0])

    asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[alfred.id or 0]
            ),
            current_user=robin,
            db_session=session,
        )
    )
    invite_a = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.recipient_user_id == alfred.id
        )
    ).first()
    assert invite_a is not None
    asyncio.run(
        accept_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite_a.id or 0,
            current_user=alfred,
            db_session=session,
        )
    )
    first_group_id = invite_a.group_id

    asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[alfred.id or 0]
            ),
            current_user=barbara,
            db_session=session,
        )
    )
    invite_b = session.exec(
        select(CourseMemberGroupInvite)
        .where(CourseMemberGroupInvite.recipient_user_id == alfred.id)
        .order_by(CourseMemberGroupInvite.id.desc())
    ).first()
    assert invite_b is not None
    asyncio.run(
        accept_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite_b.id or 0,
            current_user=alfred,
            db_session=session,
        )
    )

    old_group = session.get(CourseMemberGroup, first_group_id)
    alfred_membership = session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.course_id == course.id,
            CourseMemberGroupMember.user_id == alfred.id,
        )
    ).first()
    assert old_group is None
    assert alfred_membership is not None
    assert alfred_membership.group_id == invite_b.group_id


def test_group_completion_propagates_and_queues_pending_completion(session: Session):
    course, activities, _ = _create_course_with_activities(session)
    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    alfred = _create_student(session, org.id, "alfred_progress")
    barbara = _create_student(session, org.id, "barbara_progress")

    for user in [robin, alfred, barbara]:
        _enroll_in_started_course(session, user, activities[0])

    asyncio.run(
        add_activity_to_trail(_build_request(), robin, activities[0].activity_uuid, session, complete=True)
    )
    asyncio.run(
        add_activity_to_trail(_build_request(), alfred, activities[0].activity_uuid, session, complete=True)
    )

    asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[alfred.id or 0, barbara.id or 0]
            ),
            current_user=robin,
            db_session=session,
        )
    )
    invites = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.course_id == course.id
        )
    ).all()
    for invite in invites:
        asyncio.run(
            accept_member_group_invite(
                _build_request(),
                course.course_uuid,
                invite.id or 0,
                current_user=session.get(User, invite.recipient_user_id),
                db_session=session,
            )
        )

    asyncio.run(
        add_activity_to_trail(_build_request(), robin, activities[1].activity_uuid, session, complete=True)
    )

    alfred_pending = session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.user_id == alfred.id
        )
    ).first()
    barbara_pending = session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.user_id == barbara.id
        )
    ).first()
    alfred_synced_step = session.exec(
        select(TrailStep).where(
            TrailStep.user_id == alfred.id,
            TrailStep.activity_uuid == activities[1].activity_uuid,
        )
    ).first()

    assert alfred_pending is None
    assert alfred_synced_step is not None
    assert alfred_synced_step.complete is True
    assert barbara_pending is not None
    assert barbara_pending.activity_uuid == activities[1].activity_uuid

    asyncio.run(
        add_activity_to_trail(_build_request(), barbara, activities[0].activity_uuid, session, complete=True)
    )
    asyncio.run(
        add_activity_to_trail(_build_request(), barbara, activities[1].activity_uuid, session, complete=False)
    )

    pending_after_start = session.exec(
        select(CourseMemberGroupPendingCompletion).where(
            CourseMemberGroupPendingCompletion.user_id == barbara.id,
            CourseMemberGroupPendingCompletion.activity_uuid == activities[1].activity_uuid,
        )
    ).first()
    barbara_synced_step = session.exec(
        select(TrailStep).where(
            TrailStep.user_id == barbara.id,
            TrailStep.activity_uuid == activities[1].activity_uuid,
        )
    ).first()

    assert pending_after_start is None
    assert barbara_synced_step is not None
    assert barbara_synced_step.complete is True


def test_bulk_delete_course_member_groups_all_and_rooms(session: Session):
    course, activities, batman = _create_course_with_activities(session)
    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    alfred = _create_student(session, org.id, "alfred_room")
    barbara = _create_student(session, org.id, "barbara_room")
    cassandra = _create_student(session, org.id, "cassandra_room")

    for user in [robin, alfred, barbara, cassandra]:
        _enroll_in_started_course(session, user, activities[0])

    room_a = CourseRoom(
        course_id=course.id or 0,
        name="Room A",
        description="",
        creation_date=_now(),
        update_date=_now(),
    )
    room_b = CourseRoom(
        course_id=course.id or 0,
        name="Room B",
        description="",
        creation_date=_now(),
        update_date=_now(),
    )
    session.add(room_a)
    session.add(room_b)
    session.commit()
    session.refresh(room_a)
    session.refresh(room_b)

    session.add(CourseRoomMember(room_id=room_a.id or 0, user_id=robin.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.add(CourseRoomMember(room_id=room_a.id or 0, user_id=alfred.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.add(CourseRoomMember(room_id=room_b.id or 0, user_id=barbara.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.add(CourseRoomMember(room_id=room_b.id or 0, user_id=cassandra.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.commit()

    asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[alfred.id or 0]
            ),
            current_user=robin,
            db_session=session,
        )
    )
    invite_one = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.recipient_user_id == alfred.id
        )
    ).first()
    assert invite_one is not None
    asyncio.run(
        accept_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite_one.id or 0,
            current_user=alfred,
            db_session=session,
        )
    )

    asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[cassandra.id or 0]
            ),
            current_user=barbara,
            db_session=session,
        )
    )
    invite_two = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.recipient_user_id == cassandra.id
        )
    ).first()
    assert invite_two is not None
    asyncio.run(
        accept_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite_two.id or 0,
            current_user=cassandra,
            db_session=session,
        )
    )

    room_delete = asyncio.run(
        bulk_delete_course_member_groups(
            _build_request(),
            course.course_uuid,
            mode="rooms",
            room_ids=[room_a.id or 0],
            current_user=batman,
            db_session=session,
        )
    )
    remaining_groups = session.exec(
        select(CourseMemberGroup).where(CourseMemberGroup.course_id == course.id)
    ).all()
    assert room_delete.deleted_count == 1
    assert len(remaining_groups) == 1

    delete_all = asyncio.run(
        bulk_delete_course_member_groups(
            _build_request(),
            course.course_uuid,
            mode="all",
            room_ids=[],
            current_user=batman,
            db_session=session,
        )
    )
    remaining_groups = session.exec(
        select(CourseMemberGroup).where(CourseMemberGroup.course_id == course.id)
    ).all()
    assert delete_all.deleted_count == 1
    assert remaining_groups == []


def test_member_group_roster_only_returns_students_in_shared_rooms(session: Session):
    from src.services.courses.member_groups import get_member_group_roster

    course, activities, _ = _create_course_with_activities(session)
    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    alfred = _create_student(session, org.id, "alfred_shared")
    barbara = _create_student(session, org.id, "barbara_other")

    for user in [robin, alfred, barbara]:
        _enroll_in_started_course(session, user, activities[0])

    room_a = CourseRoom(
        course_id=course.id or 0,
        name="Shared Room",
        description="",
        creation_date=_now(),
        update_date=_now(),
    )
    room_b = CourseRoom(
        course_id=course.id or 0,
        name="Other Room",
        description="",
        creation_date=_now(),
        update_date=_now(),
    )
    session.add(room_a)
    session.add(room_b)
    session.commit()
    session.refresh(room_a)
    session.refresh(room_b)

    session.add(CourseRoomMember(room_id=room_a.id or 0, user_id=robin.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.add(CourseRoomMember(room_id=room_a.id or 0, user_id=alfred.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.add(CourseRoomMember(room_id=room_b.id or 0, user_id=barbara.id or 0, role=RoomRoleEnum.student, creation_date=_now(), update_date=_now()))
    session.commit()

    roster = asyncio.run(
        get_member_group_roster(
            _build_request(),
            course.course_uuid,
            robin,
            session,
        )
    )

    assert [entry.user.id for entry in roster] == [alfred.id]


def test_staff_can_kick_member_and_small_group_is_deleted(session: Session):
    course, activities, batman = _create_course_with_activities(session)
    robin = session.exec(select(User).where(User.username == "robin")).first()
    assert robin is not None
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    alfred = _create_student(session, org.id, "alfred_kick")

    for user in [robin, alfred]:
        _enroll_in_started_course(session, user, activities[0])

    asyncio.run(
        create_member_group_invites(
            _build_request(),
            course.course_uuid,
            payload=CourseMemberGroupInviteCreate(
                recipient_user_ids=[alfred.id or 0]
            ),
            current_user=robin,
            db_session=session,
        )
    )
    invite = session.exec(
        select(CourseMemberGroupInvite).where(
            CourseMemberGroupInvite.recipient_user_id == alfred.id
        )
    ).first()
    assert invite is not None
    asyncio.run(
        accept_member_group_invite(
            _build_request(),
            course.course_uuid,
            invite.id or 0,
            current_user=alfred,
            db_session=session,
        )
    )
    group_id = invite.group_id

    remaining_groups = asyncio.run(
        remove_member_from_course_group(
            _build_request(),
            course.course_uuid,
            group_id,
            alfred.id or 0,
            batman,
            session,
        )
    )

    group = session.get(CourseMemberGroup, group_id)
    kicked_membership = session.exec(
        select(CourseMemberGroupMember).where(
            CourseMemberGroupMember.course_id == course.id,
            CourseMemberGroupMember.user_id == alfred.id,
        )
    ).first()

    assert group is None
    assert kicked_membership is None
    assert remaining_groups == []
