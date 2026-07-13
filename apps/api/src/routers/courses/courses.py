from typing import List
from fastapi import APIRouter, Depends, UploadFile, Form, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session
from src.db.users import PublicUser, UserRead
from src.core.events.database import get_db_session
from src.db.courses.course_canvas import CourseCanvasUpdate
from src.db.courses.course_rooms import (
    CourseRoomCreate,
    CourseRoomMemberRead,
    CourseRoomRead,
    CourseRoomUpdate,
    RoomRoleEnum,
)
from src.db.courses.course_updates import (
    CourseUpdateCreate,
    CourseUpdateRead,
    CourseUpdateUpdate,
)
from src.db.courses.course_tutor_room_selection import (
    CourseTutorRoomSelectionRead,
    CourseTutorRoomSelectionUpdate,
)
from src.db.courses.course_member_groups import (
    CourseMemberGroupBulkDeleteResult,
    CourseMemberGroupInviteCreate,
    CourseMemberGroupMeRead,
    CourseMemberGroupRead,
    CourseMemberGroupRosterStudentRead,
)
from src.db.courses.courses import (
    CourseCreate,
    CourseRead,
    CourseUpdate,
    FullCourseReadWithTrail,
)
from src.db.courses.chapters import ChapterRead
from src.db.trail_steps import TrailStepVerificationEnum
from src.security.auth import get_current_user
from src.services.courses.course_canvas import get_canvas, put_update
from src.services.courses.students import list_course_students, CourseStudent
from src.services.courses.member_groups import (
    accept_member_group_invite,
    bulk_delete_course_member_groups,
    create_member_group_invites,
    decline_member_group_invite,
    get_member_group_roster,
    get_my_member_group,
    leave_member_group,
    list_course_member_groups,
    remove_member_from_course_group,
)
from src.services.courses.rooms import (
    add_course_room_members,
    create_course_room,
    delete_course_room,
    list_course_room_members,
    list_course_rooms,
    list_manageable_course_rooms,
    remove_course_room_members,
    update_course_room,
)
from src.services.courses.tutor_room_selection import (
    add_room_students,
    clear_tutor_room_selection,
    get_tutor_room_selection,
    list_available_room_students,
    list_course_activity_status,
    list_room_activity_status,
    set_tutor_room_selection,
)
from src.services.courses.courses import (
    create_course,
    get_course,
    get_course_by_id,
    get_course_meta,
    get_courses_orgslug,
    update_course,
    delete_course,
    update_course_thumbnail,
)
from src.services.courses.chapters import get_course_chapters_for_tab
from src.services.courses.updates import (
    create_update,
    delete_update,
    get_updates_by_course_uuid,
    update_update,
)


router = APIRouter()


class RoomActivityStatusStep(BaseModel):
    user_id: int
    activity_uuid: str
    complete: bool
    tutor_verified: TrailStepVerificationEnum
    creation_date: str | None = None
    update_date: str | None = None
    completed_date: str | None = None
    verified_date: str | None = None


class RoomActivityStatusRead(BaseModel):
    steps: List[RoomActivityStatusStep]


@router.post('/')
async def api_create_course(
    request: Request,
    org_id: int,
    name: str = Form(),
    description: str = Form(),
    public: bool = Form(),
    learnings: str = Form(None),
    tags: str = Form(None),
    about: str = Form(),
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    thumbnail: UploadFile | None = None,
) -> CourseRead:
    """
    Create new Course
    """
    course = CourseCreate(
        name=name,
        description=description,
        org_id=org_id,
        public=public,
        thumbnail_image='',
        about=about,
        learnings=learnings,
        tags=tags,
    )
    return await create_course(
        request, org_id, course, current_user, db_session, thumbnail
    )


@router.put('/thumbnail/{course_uuid}')
async def api_create_course_thumbnail(
    request: Request,
    course_uuid: str,
    thumbnail: UploadFile | None = None,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseRead:
    """
    Update new Course Thumbnail
    """
    print('=====UPLOAD====')
    return await update_course_thumbnail(
        request, course_uuid, current_user, db_session, thumbnail
    )


@router.get('/{course_uuid}')
async def api_get_course(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseRead:
    """
    Get single Course by course_uuid
    """
    return await get_course(
        request, course_uuid, current_user=current_user, db_session=db_session
    )


@router.get('/id/{course_id}')
async def api_get_course_by_id(
    request: Request,
    course_id: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseRead:
    """
    Get single Course by id
    """
    return await get_course_by_id(
        request, course_id, current_user=current_user, db_session=db_session
    )


@router.get('/{course_uuid}/meta')
async def api_get_course_meta(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FullCourseReadWithTrail:
    """
    Get single Course Metadata (chapters, activities) by course_uuid
    """
    return await get_course_meta(
        request, course_uuid, current_user=current_user, db_session=db_session
    )


@router.get('/{course_uuid}/tabs/{tab_uuid}/content')
async def api_get_course_tab_content(
    request: Request,
    course_uuid: str,
    tab_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[ChapterRead]:
    """
    Get the chapters mapped to a specific course tab.
    """
    return await get_course_chapters_for_tab(
        request,
        course_uuid,
        tab_uuid,
        current_user=current_user,
        db_session=db_session,
    )


@router.get('/org_slug/{org_slug}/page/{page}/limit/{limit}')
async def api_get_course_by_orgslug(
    request: Request,
    page: int,
    limit: int,
    org_slug: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseRead]:
    """
    Get courses by page and limit
    """
    return await get_courses_orgslug(
        request, current_user, org_slug, db_session, page, limit
    )


@router.put('/{course_uuid}')
async def api_update_course(
    request: Request,
    course_object: CourseUpdate,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseRead:
    """
    Update Course by course_uuid
    """
    # print(f'aa={course_object}')
    return await update_course(
        request, course_object, course_uuid, current_user, db_session
    )


@router.delete('/{course_uuid}')
async def api_delete_course(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    """
    Delete Course by ID
    """

    return await delete_course(request, course_uuid, current_user, db_session)


@router.get('/{course_uuid}/updates')
async def api_get_course_updates(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseUpdateRead]:
    """
    Get Course Updates by course_uuid
    """

    return await get_updates_by_course_uuid(
        request, course_uuid, current_user, db_session
    )


@router.post('/{course_uuid}/updates')
async def api_create_course_update(
    request: Request,
    course_uuid: str,
    update_object: CourseUpdateCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseUpdateRead:
    """
    Create new Course Update
    """

    return await create_update(
        request, course_uuid, update_object, current_user, db_session
    )


@router.put('/{course_uuid}/update/{courseupdate_uuid}')
async def api_update_course_update(
    request: Request,
    course_uuid: str,
    courseupdate_uuid: str,
    update_object: CourseUpdateUpdate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseUpdateRead:
    """
    Update Course Update by courseupdate_uuid
    """

    return await update_update(
        request, courseupdate_uuid, update_object, current_user, db_session
    )


@router.delete('/{course_uuid}/update/{courseupdate_uuid}')
async def api_delete_course_update(
    request: Request,
    course_uuid: str,
    courseupdate_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    """
    Delete Course Update by courseupdate_uuid
    """

    return await delete_update(
        request, courseupdate_uuid, current_user, db_session
    )


@router.get('/{course_uuid}/canvas')
def get_course_canvas(
    request: Request,
    course_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    return get_canvas(request, course_uuid, user, db_session)


@router.put('/{course_uuid}/canvas')
def put_course_canvas(
    request: Request,
    course_uuid: str,
    course_canvas_update: CourseCanvasUpdate,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    return put_update(
        request, course_uuid, course_canvas_update, user, db_session
    )


@router.get('/students/list')
async def api_list_course_students(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> List[CourseStudent]:
    """
    List students who are enrolled in the selected course.
    """
    return await list_course_students(
        request, course_uuid, current_user, db_session
    )


@router.get('/{course_uuid}/member-groups/me')
async def api_get_my_member_group(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseMemberGroupMeRead:
    return await get_my_member_group(request, course_uuid, current_user, db_session)


@router.get('/{course_uuid}/member-groups/roster')
async def api_get_member_group_roster(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseMemberGroupRosterStudentRead]:
    return await get_member_group_roster(
        request, course_uuid, current_user, db_session
    )


@router.post('/{course_uuid}/member-groups/invites')
async def api_create_member_group_invites(
    request: Request,
    course_uuid: str,
    payload: CourseMemberGroupInviteCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseMemberGroupMeRead:
    return await create_member_group_invites(
        request, course_uuid, payload, current_user, db_session
    )


@router.post('/{course_uuid}/member-groups/invites/{invite_id}/accept')
async def api_accept_member_group_invite(
    request: Request,
    course_uuid: str,
    invite_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseMemberGroupMeRead:
    return await accept_member_group_invite(
        request, course_uuid, invite_id, current_user, db_session
    )


@router.post('/{course_uuid}/member-groups/invites/{invite_id}/decline')
async def api_decline_member_group_invite(
    request: Request,
    course_uuid: str,
    invite_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseMemberGroupMeRead:
    return await decline_member_group_invite(
        request, course_uuid, invite_id, current_user, db_session
    )


@router.delete('/{course_uuid}/member-groups/me')
async def api_leave_member_group(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseMemberGroupMeRead:
    return await leave_member_group(request, course_uuid, current_user, db_session)


@router.get('/{course_uuid}/member-groups')
async def api_list_course_member_groups(
    request: Request,
    course_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseMemberGroupRead]:
    return await list_course_member_groups(
        request, course_uuid, current_user, db_session
    )


@router.delete('/{course_uuid}/member-groups')
async def api_bulk_delete_course_member_groups(
    request: Request,
    course_uuid: str,
    mode: str,
    room_ids: str | None = None,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseMemberGroupBulkDeleteResult:
    parsed_room_ids = []
    if room_ids:
        try:
            parsed_room_ids = [int(room_id) for room_id in room_ids.split(',') if room_id]
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="room_ids must be comma separated integers",
            ) from exc
    return await bulk_delete_course_member_groups(
        request,
        course_uuid,
        mode,  # type: ignore[arg-type]
        parsed_room_ids,
        current_user,
        db_session,
    )


@router.delete('/{course_uuid}/member-groups/{group_id}/members/{user_id}')
async def api_remove_member_from_course_group(
    request: Request,
    course_uuid: str,
    group_id: int,
    user_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseMemberGroupRead]:
    return await remove_member_from_course_group(
        request,
        course_uuid,
        group_id,
        user_id,
        current_user,
        db_session,
    )


@router.get('/{course_uuid}/rooms')
async def api_list_course_rooms(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> List[CourseRoomRead]:
    """
    List rooms for a course.
    """
    return await list_course_rooms(
        request, course_uuid, current_user, db_session
    )


@router.get('/{course_uuid}/rooms/manageable')
async def api_list_manageable_course_rooms(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> List[CourseRoomRead]:
    """
    List rooms the current tutor can manage for a course.
    """
    return await list_manageable_course_rooms(
        request, course_uuid, current_user, db_session
    )


@router.post('/{course_uuid}/rooms')
async def api_create_course_room(
    request: Request,
    course_uuid: str,
    room_object: CourseRoomCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> CourseRoomRead:
    """
    Create a new room for a course.
    """
    return await create_course_room(
        request, course_uuid, room_object, current_user, db_session
    )


@router.put('/{course_uuid}/rooms/{room_id}')
async def api_update_course_room(
    request: Request,
    course_uuid: str,
    room_id: int,
    room_object: CourseRoomUpdate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> CourseRoomRead:
    """
    Update a course room.
    """
    return await update_course_room(
        request, course_uuid, room_id, room_object, current_user, db_session
    )


@router.delete('/{course_uuid}/rooms/{room_id}')
async def api_delete_course_room(
    request: Request,
    course_uuid: str,
    room_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    """
    Delete a course room.
    """
    return await delete_course_room(
        request, course_uuid, room_id, current_user, db_session
    )


@router.get('/{course_uuid}/rooms/{room_id}/members')
async def api_list_course_room_members(
    request: Request,
    course_uuid: str,
    room_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> List[CourseRoomMemberRead]:
    """
    List members of a course room.
    """
    return await list_course_room_members(
        request, course_uuid, room_id, current_user, db_session
    )


@router.get('/{course_uuid}/rooms/{room_id}/activity-status')
async def api_list_course_room_activity_status(
    request: Request,
    course_uuid: str,
    room_id: int,
    activity_uuids: str = "",
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> RoomActivityStatusRead:
    """
    List activity status for students in a course room.
    """
    steps = await list_room_activity_status(
        request, course_uuid, room_id, activity_uuids, current_user, db_session
    )
    return RoomActivityStatusRead(steps=steps)


@router.get('/{course_uuid}/activity-status')
async def api_list_course_activity_status(
    request: Request,
    course_uuid: str,
    activity_uuids: str = "",
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> RoomActivityStatusRead:
    """
    List activity status for all students in a course.
    """
    steps = await list_course_activity_status(
        request, course_uuid, activity_uuids, current_user, db_session
    )
    return RoomActivityStatusRead(steps=steps)


@router.post('/{course_uuid}/rooms/{room_id}/members/add')
async def api_add_course_room_members(
    request: Request,
    course_uuid: str,
    room_id: int,
    user_ids: str,
    role: RoomRoleEnum,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    """
    Add users to a course room.
    """
    return await add_course_room_members(
        request, course_uuid, room_id, user_ids, role, current_user, db_session
    )


@router.get('/{course_uuid}/rooms/{room_id}/available-students')
async def api_list_available_room_students(
    request: Request,
    course_uuid: str,
    room_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> List[UserRead]:
    """
    List students enrolled in the course who are not yet members of the room.
    """
    return await list_available_room_students(
        request, course_uuid, room_id, current_user, db_session
    )


@router.post('/{course_uuid}/rooms/{room_id}/students/add')
async def api_add_room_students(
    request: Request,
    course_uuid: str,
    room_id: int,
    user_ids: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    """
    Add students to a course room (tutor-scoped).
    """
    return await add_room_students(
        request, course_uuid, room_id, user_ids, current_user, db_session
    )


@router.delete('/{course_uuid}/rooms/{room_id}/members/remove')
async def api_remove_course_room_members(
    request: Request,
    course_uuid: str,
    room_id: int,
    user_ids: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    """
    Remove users from a course room.
    """
    return await remove_course_room_members(
        request, course_uuid, room_id, user_ids, current_user, db_session
    )


@router.get('/{course_uuid}/tutor-room-selection')
async def api_get_tutor_room_selection(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> CourseTutorRoomSelectionRead:
    """
    Get the current tutor room selection for this course.
    """
    return await get_tutor_room_selection(
        request, course_uuid, current_user, db_session
    )


@router.put('/{course_uuid}/tutor-room-selection')
async def api_set_tutor_room_selection(
    request: Request,
    course_uuid: str,
    selection_update: CourseTutorRoomSelectionUpdate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> CourseTutorRoomSelectionRead:
    """
    Set the tutor room selection for this course.
    """
    return await set_tutor_room_selection(
        request, course_uuid, selection_update, current_user, db_session
    )


@router.delete('/{course_uuid}/tutor-room-selection')
async def api_clear_tutor_room_selection(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> CourseTutorRoomSelectionRead:
    """
    Clear the tutor room selection for this course.
    """
    return await clear_tutor_room_selection(
        request, course_uuid, current_user, db_session
    )
