from typing import Any, Dict, Literal, List
from uuid import uuid4

import orjson

from src.services.courses import meta_cache
from src.db.courses.chapters import Chapter
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.course_canvas import CourseCanvas
from sqlmodel import Session, select, or_, and_
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.organizations import Organization
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.security.features_utils.usage import (
    check_limits_with_usage,
    decrease_feature_usage,
    increase_feature_usage,
)
from src.services.trail.trail import get_user_trail_with_orgid
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum
from src.db.users import PublicUser, AnonymousUser, User, UserRead
from src.db.courses.courses import (
    Course,
    CourseCreate,
    CourseRead,
    CourseUpdate,
    default_map_state,
)
from src.db.courses.course_tabs import CourseTab, CourseTabRead, CourseTabUpsert
from src.db.courses.course_chapters import CourseChapter, CourseChapter_Graph
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_element_is_public,
    authorization_verify_if_user_is_anon,
)
from src.services.courses.thumbnails import upload_thumbnail
from fastapi import HTTPException, Request, UploadFile
from datetime import datetime


def sanitize_map_state(raw_map: Any) -> Dict[str, Any]:
    base = default_map_state()
    if not isinstance(raw_map, dict):
        return default_map_state()

    objects = raw_map.get('objects')
    sanitized_objects = list(objects) if isinstance(objects, list) else []

    raw_boundaries = raw_map.get('boundaries')
    fallback_boundaries = base['boundaries']
    sanitized_boundaries = {
        axis: (
            raw_boundaries.get(axis)
            if isinstance(raw_boundaries, dict)
            and isinstance(raw_boundaries.get(axis), (int, float))
            else fallback_boundaries[axis]
        )
        for axis in ('left', 'right', 'top', 'bottom')
    }

    return {
        'objects': sanitized_objects,
        'boundaries': sanitized_boundaries,
    }


DEFAULT_TABS: List[Dict[str, str]] = [
    {"tab_uuid": "tab-1", "name": "Tab 1"},
    {"tab_uuid": "tab-2", "name": "Tab 2"},
]


def _normalize_course_tab_uuid(tab_uuid: str, course_uuid: str) -> str:
    if tab_uuid.endswith(course_uuid):
        return tab_uuid
    return f"{tab_uuid}{course_uuid}"


def sanitize_tab_map_store(raw_store: Any) -> Dict[str, Dict[str, Any]]:
    sanitized: Dict[str, Dict[str, Any]] = {}
    if not isinstance(raw_store, dict):
        return sanitized

    for key, entry in raw_store.items():
        tab_id = str(key)
        candidate = entry
        if isinstance(candidate, dict) and 'map' in candidate:
            candidate = candidate.get('map')
        sanitized[tab_id] = sanitize_map_state(candidate)

    return sanitized


def fetch_course_tabs(course_id: int, db_session: Session) -> List[CourseTab]:
    statement = (
        select(CourseTab)
        .where(CourseTab.course_id == course_id)
        .order_by(CourseTab.position.asc(), CourseTab.id.asc())
    )
    return list(db_session.exec(statement).all())


def ensure_default_tabs(course: Course, db_session: Session) -> List[CourseTab]:
    tabs = fetch_course_tabs(course.id, db_session)
    if tabs:
        return tabs

    now = datetime.utcnow().isoformat()
    created_tabs: List[CourseTab] = []
    for index, spec in enumerate(DEFAULT_TABS):
        tab = CourseTab(
            tab_uuid=_normalize_course_tab_uuid(spec["tab_uuid"], course.course_uuid),
            course_id=course.id,
            course_uuid=course.course_uuid,
            name=spec["name"],
            position=index,
            visible=True,
            visible_after=None,
            creation_date=now,
            update_date=now,
        )
        db_session.add(tab)
        created_tabs.append(tab)

    db_session.commit()
    for tab in created_tabs:
        db_session.refresh(tab)

    return created_tabs


def delete_chapters_for_tab(course: Course, tab_uuid: str, db_session: Session) -> None:
    chapter_id_rows = db_session.exec(
        select(CourseChapter_Graph.chapter_id)
        .where(CourseChapter_Graph.course_id == course.id)
        .where(CourseChapter_Graph.tab_uuid == tab_uuid)
    ).all()
    chapter_ids = {chapter_id for chapter_id in chapter_id_rows if chapter_id is not None}
    if not chapter_ids:
        return

    graph_edges = db_session.exec(
        select(CourseChapter_Graph)
        .where(CourseChapter_Graph.course_id == course.id)
        .where(
            or_(
                CourseChapter_Graph.chapter_id.in_(chapter_ids),
                CourseChapter_Graph.predecessor_id.in_(chapter_ids),
            )
        )
    ).all()
    for edge in graph_edges:
        db_session.delete(edge)

    chapter_activities = db_session.exec(
        select(ChapterActivity)
        .where(ChapterActivity.course_id == course.id)
        .where(ChapterActivity.chapter_id.in_(chapter_ids))
    ).all()
    for chapter_activity in chapter_activities:
        db_session.delete(chapter_activity)

    course_chapters = db_session.exec(
        select(CourseChapter)
        .where(CourseChapter.course_id == course.id)
        .where(CourseChapter.chapter_id.in_(chapter_ids))
    ).all()
    for course_chapter in course_chapters:
        db_session.delete(course_chapter)

    chapters = db_session.exec(
        select(Chapter)
        .where(Chapter.course_id == course.id)
        .where(Chapter.id.in_(chapter_ids))
    ).all()
    for chapter in chapters:
        db_session.delete(chapter)


def upsert_course_tabs(
    course: Course,
    incoming_tabs: List[CourseTabUpsert],
    db_session: Session,
) -> List[CourseTab]:
    if not incoming_tabs:
        raise HTTPException(
            status_code=400,
            detail="A course must have at least one tab.",
        )

    existing_tabs = fetch_course_tabs(course.id, db_session)
    existing_by_id = {tab.tab_uuid: tab for tab in existing_tabs}
    incoming_by_id = {tab.tab_uuid: tab for tab in incoming_tabs}

    now = datetime.utcnow().isoformat()

    # Upsert provided tabs
    for tab_uuid, payload in incoming_by_id.items():
        payload_data = payload.model_dump(exclude_unset=True)
        if tab_uuid in existing_by_id:
            tab = existing_by_id[tab_uuid]
            has_updates = False
            if tab.name != payload.name:
                tab.name = payload.name
                has_updates = True
            if tab.position != payload.position:
                tab.position = payload.position
                has_updates = True
            if "visible" in payload_data and tab.visible != payload_data["visible"]:
                tab.visible = payload_data["visible"]
                has_updates = True
            if "visible_after" in payload_data and tab.visible_after != payload_data["visible_after"]:
                tab.visible_after = payload_data["visible_after"]
                has_updates = True
            if has_updates:
                tab.update_date = now
                db_session.add(tab)
        else:
            tab = CourseTab(
                tab_uuid=payload.tab_uuid,
                course_id=course.id,
                course_uuid=course.course_uuid,
                name=payload.name,
                position=payload.position,
                visible=payload.visible if payload.visible is not None else True,
                visible_after=payload.visible_after,
                creation_date=now,
                update_date=now,
            )
            db_session.add(tab)

    tabs_to_delete = [
        tab for tab_uuid, tab in existing_by_id.items() if tab_uuid not in incoming_by_id
    ]

    for tab in tabs_to_delete:
        delete_chapters_for_tab(course, tab.tab_uuid, db_session)
        db_session.delete(tab)

    db_session.commit()
    return fetch_course_tabs(course.id, db_session)


def build_course_read(
    course: Course,
    authors: List[UserRead],
    tabs: List[CourseTab],
) -> CourseRead:
    sanitized_store = sanitize_tab_map_store(course.tab_store)
    today = datetime.utcnow().date()

    if not tabs:
        tab_reads = [
            CourseTabRead(
                tab_uuid=spec["tab_uuid"],
                course_uuid=course.course_uuid,
                name=spec["name"],
                position=index,
                visible=True,
                visible_after=None,
                is_visible=True,
            )
            for index, spec in enumerate(DEFAULT_TABS)
        ]
    else:
        tab_reads = [
            CourseTabRead(
                tab_uuid=tab.tab_uuid,
                course_uuid=tab.course_uuid,
                name=tab.name,
                position=tab.position,
                visible=tab.visible,
                visible_after=tab.visible_after,
                is_visible=(
                    tab.visible
                    and (
                        tab.visible_after is None
                        or tab.visible_after <= today
                    )
                ),
            )
            for tab in tabs
        ]

    ordered_tab_ids = [tab.tab_uuid for tab in tabs] if tabs else [spec["tab_uuid"] for spec in DEFAULT_TABS]

    for tab_id in ordered_tab_ids:
        if tab_id not in sanitized_store:
            sanitized_store[tab_id] = default_map_state()

    primary_tab_id = ordered_tab_ids[0] if ordered_tab_ids else None
    map_state = sanitized_store.get(primary_tab_id) if primary_tab_id else None
    if map_state is None:
        map_state = sanitize_map_state(course.map_state)

    payload = course.model_dump()
    payload['tab_store'] = sanitized_store
    payload['map_state'] = map_state
    payload['tab_metadata'] = tab_reads

    return CourseRead(**payload, authors=authors)


def can_manage_hidden_course(
    course: Course,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> bool:
    """Keep hidden courses manageable without exposing them to learners."""
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        return False

    authorship = db_session.exec(
        select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == course.course_uuid,
            ResourceAuthor.user_id == current_user.id,
            ResourceAuthor.authorship.in_(
                [
                    ResourceAuthorshipEnum.CREATOR,
                    ResourceAuthorshipEnum.MAINTAINER,
                ]
            ),
        )
    ).first()
    if authorship:
        return True

    roles = db_session.exec(
        select(Role)
        .join(UserOrganization, UserOrganization.role_id == Role.id)
        .where(
            UserOrganization.user_id == current_user.id,
            UserOrganization.org_id == course.org_id,
        )
    ).all()
    for role in roles:
        try:
            if role.rights and role.rights["courses"]["action_update"] is True:
                return True
        except (KeyError, TypeError):
            continue

    return False


async def get_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "read", db_session)

    # Get course authors
    authors_statement = (
        select(User)
        .join(ResourceAuthor)
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
    )
    authors = db_session.exec(authors_statement).all()

    # convert from User to UserRead
    author_reads = [UserRead.model_validate(author) for author in authors]

    tabs = ensure_default_tabs(course, db_session)
    course_read = build_course_read(course, author_reads, tabs)

    return course_read


async def get_course_by_id(
    request: Request,
    course_id: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Course).where(Course.id == course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "read", db_session)

    # Get course authors
    authors_statement = (
        select(User)
        .join(ResourceAuthor)
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
    )
    authors = db_session.exec(authors_statement).all()

    # convert from User to UserRead
    author_reads = [UserRead.model_validate(author) for author in authors]

    tabs = ensure_default_tabs(course, db_session)
    course_read = build_course_read(course, author_reads, tabs)

    return course_read


async def get_course_meta_json(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> bytes:
    """
    The /meta payload as JSON bytes, using the shared course cache.

    Authorization runs on every call. Only the course body - which is identical
    for every user - is cached; the caller's trail is spliced in afterwards.
    """
    course_statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(course_statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    await rbac_check(request, course.course_uuid, current_user, "read", db_session)

    shared = await meta_cache.get_cached_shared_payload(course_uuid)
    if shared is None:
        shared = orjson.dumps(
            _build_course_meta_shared(request, course, db_session)
        )
        await meta_cache.set_cached_shared_payload(course_uuid, shared)

    trail = None
    if not isinstance(current_user, AnonymousUser):
        trail = await get_user_trail_with_orgid(
            request, current_user, course.org_id, db_session
        )

    return meta_cache.splice_trail(
        shared, trail.dict(by_alias=True) if trail else None
    )


def _build_course_meta_shared(
    request: Request,
    course: Course,
    db_session: Session,
) -> dict:
    """Everything in the meta payload except the per-user trail."""
    # Avoid circular import
    from src.services.courses.chapters import get_course_chapters_sync

    authors_statement = (
        select(User)
        .join(ResourceAuthor)
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
    )
    authors = db_session.exec(authors_statement).all()
    author_reads = [UserRead.model_validate(author) for author in authors]

    tabs = ensure_default_tabs(course, db_session)
    course_read = build_course_read(course, author_reads, tabs)
    chapters = get_course_chapters_sync(course.id, db_session)

    payload = course_read.dict(by_alias=True)
    payload['chapters'] = [chapter.dict(by_alias=True) for chapter in chapters]
    return payload


async def get_courses_orgslug(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    org_slug: str,
    db_session: Session,
    page: int = 1,
    limit: int = 10,
) -> List[CourseRead]:
    offset = (page - 1) * limit

    org = db_session.exec(
        select(Organization).where(Organization.slug == org_slug)
    ).first()
    if not org:
        return []

    # Base query
    query = (
        select(Course)
        .join(Organization)
        .where(Organization.slug == org_slug)
    )

    if isinstance(current_user, AnonymousUser):
        # For anonymous users, only show public courses
        query = query.where(Course.public == True, Course.visible == True)
    else:
        roles_statement = (
            select(Role)
            .join(UserOrganization, UserOrganization.role_id == Role.id)
            .where(
                UserOrganization.user_id == current_user.id,
                UserOrganization.org_id == org.id,
            )
        )
        roles = db_session.exec(roles_statement).all()

        has_course_read = False
        has_course_update = False
        for role in roles:
            role = Role.model_validate(role)
            if role.rights:
                try:
                    course_rights = role.rights["courses"]
                    has_course_read = (
                        has_course_read or course_rights["action_read"] is True
                    )
                    has_course_update = (
                        has_course_update or course_rights["action_update"] is True
                    )
                except (KeyError, TypeError):
                    continue

        if not has_course_read:
            # For authenticated users without course read rights, show:
            # 1. Public courses
            # 2. Courses not in any UserGroup
            # 3. Courses in UserGroups where the user is a member
            # 4. Courses where the user is a resource author
            query = (
                query
                .outerjoin(UserGroupResource, UserGroupResource.resource_uuid == Course.course_uuid)  # type: ignore
                .outerjoin(UserGroupUser, and_(
                    UserGroupUser.usergroup_id == UserGroupResource.usergroup_id,
                    UserGroupUser.user_id == current_user.id
                ))
                .outerjoin(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)  # type: ignore
                .where(
                    and_(
                        or_(
                            Course.public == True,
                            UserGroupResource.resource_uuid == None,  # Courses not in any UserGroup # noqa: E711
                            UserGroupUser.user_id == current_user.id,  # Courses in UserGroups where user is a member
                            ResourceAuthor.user_id == current_user.id,  # Courses where user is a resource author
                        ),
                        or_(
                            Course.visible == True,
                            and_(
                                ResourceAuthor.user_id == current_user.id,
                                ResourceAuthor.authorship.in_(
                                    [
                                        ResourceAuthorshipEnum.CREATOR,
                                        ResourceAuthorshipEnum.MAINTAINER,
                                    ]
                                ),
                            ),
                        ),
                    )
                )
            )
        elif not has_course_update:
            # Learners and tutors must not see hidden courses. Authors retain
            # access so they can manage and make their own course visible again.
            query = (
                query
                .outerjoin(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)  # type: ignore
                .where(
                    or_(
                        Course.visible == True,
                        and_(
                            ResourceAuthor.user_id == current_user.id,
                            ResourceAuthor.authorship.in_(
                                [
                                    ResourceAuthorshipEnum.CREATOR,
                                    ResourceAuthorshipEnum.MAINTAINER,
                                ]
                            ),
                        ),
                    )
                )
            )

    # Apply pagination
    # The distinct columns are a hack that prevents that the = operator is used on a JSON column.
    query = query.offset(offset).limit(limit).distinct(
        Course.name,
        Course.description,
        Course.about,
        Course.learnings,
        Course.tags,
        Course.thumbnail_image,
        Course.public,
        Course.visible,
    )

    courses = db_session.exec(query).all()

    if not courses:
        return []

    # Fetch shared course metadata in batches instead of issuing one author and
    # one tab query for every course in the page.
    course_uuids = [course.course_uuid for course in courses]
    course_ids = [course.id for course in courses]

    authors_by_course: Dict[str, List[UserRead]] = {
        course_uuid: [] for course_uuid in course_uuids
    }
    authors_query = (
        select(User, ResourceAuthor.resource_uuid)
        .join(ResourceAuthor, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid.in_(course_uuids))
    )
    for author, resource_uuid in db_session.exec(authors_query).all():
        authors_by_course[resource_uuid].append(UserRead.model_validate(author))

    tabs_by_course: Dict[int, List[CourseTab]] = {course_id: [] for course_id in course_ids}
    tabs_query = (
        select(CourseTab)
        .where(CourseTab.course_id.in_(course_ids))
        .order_by(CourseTab.course_id, CourseTab.position.asc(), CourseTab.id.asc())
    )
    for tab in db_session.exec(tabs_query).all():
        tabs_by_course[tab.course_id].append(tab)

    course_reads = []
    for course in courses:
        author_reads = authors_by_course[course.course_uuid]
        tabs = tabs_by_course[course.id]
        if not tabs:
            # Keep the existing compatibility behavior for older courses that
            # predate the default-tab records.
            tabs = ensure_default_tabs(course, db_session)
        course_read = build_course_read(course, author_reads, tabs)
        course_reads.append(course_read)

    return course_reads


async def create_course(
    request: Request,
    org_id: int,
    course_object: CourseCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    thumbnail_file: UploadFile | None = None,
):
    course = Course.model_validate(course_object)

    # RBAC check
    await rbac_check(request, "course_x", current_user, "create", db_session)

    # Usage check
    check_limits_with_usage("courses", org_id, db_session)

    # Complete course object
    course.org_id = course.org_id

    # Get org uuid
    org_statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(org_statement).first()

    course.course_uuid = str(f"course_{uuid4()}")
    course.creation_date = str(datetime.now())
    course.update_date = str(datetime.now())
    course.map_state = default_map_state()
    course.tab_store = {
        _normalize_course_tab_uuid(spec["tab_uuid"], course.course_uuid): default_map_state()
        for spec in DEFAULT_TABS
    }

    # Upload thumbnail
    if thumbnail_file and thumbnail_file.filename:
        name_in_disk = f"{course.course_uuid}_thumbnail_{uuid4()}.{thumbnail_file.filename.split('.')[-1]}"
        await upload_thumbnail(
            thumbnail_file, name_in_disk, org.org_uuid, course.course_uuid  # type: ignore
        )
        course.thumbnail_image = name_in_disk

    else:
        course.thumbnail_image = ""

    # Insert course
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)

    # Create default course tabs
    now = datetime.utcnow().isoformat()
    created_tabs: List[CourseTab] = []
    for index, spec in enumerate(DEFAULT_TABS):
        tab = CourseTab(
            tab_uuid=_normalize_course_tab_uuid(spec["tab_uuid"], course.course_uuid),
            course_id=course.id,
            course_uuid=course.course_uuid,
            name=spec["name"],
            position=index,
            visible=True,
            visible_after=None,
            creation_date=now,
            update_date=now,
        )
        db_session.add(tab)
        created_tabs.append(tab)

    db_session.commit()
    for tab in created_tabs:
        db_session.refresh(tab)

    # Make the user the creator of the course
    resource_author = ResourceAuthor(
        resource_uuid=course.course_uuid,
        user_id=current_user.id,
        authorship=ResourceAuthorshipEnum.CREATOR,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # Insert course author
    db_session.add(resource_author)
    db_session.commit()
    db_session.refresh(resource_author)

    # Get course authors
    authors_statement = (
        select(User)
        .join(ResourceAuthor)
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
    )
    authors = db_session.exec(authors_statement).all()

    # Feature usage
    increase_feature_usage("courses", course.org_id, db_session)

    # convert from User to UserRead
    author_reads = [UserRead.model_validate(author) for author in authors]

    tabs = fetch_course_tabs(course.id, db_session)
    course_read = build_course_read(course, author_reads, tabs)

    return course_read


async def update_course_thumbnail(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    thumbnail_file: UploadFile | None = None,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    name_in_disk = None

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "update", db_session)

    # Get org uuid
    org_statement = select(Organization).where(Organization.id == course.org_id)
    org = db_session.exec(org_statement).first()

    # Upload thumbnail
    if thumbnail_file and thumbnail_file.filename:
        print("UPLOADING INTERNALR")
        name_in_disk = f"{course_uuid}_thumbnail_{uuid4()}.{thumbnail_file.filename.split('.')[-1]}"
        await upload_thumbnail(
            thumbnail_file, name_in_disk, org.org_uuid, course.course_uuid  # type: ignore
        )

    # Update course
    if name_in_disk:
        course.thumbnail_image = name_in_disk
    else:
        raise HTTPException(
            status_code=500,
            detail="Issue with thumbnail upload",
        )

    # Complete the course object
    course.update_date = str(datetime.now())

    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)

    # Get course authors
    authors_statement = (
        select(User)
        .join(ResourceAuthor)
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
    )
    authors = db_session.exec(authors_statement).all()

    # convert from User to UserRead
    author_reads = [UserRead.model_validate(author) for author in authors]

    tabs = fetch_course_tabs(course.id, db_session)
    course_read = build_course_read(course, author_reads, tabs)

    return course_read


async def update_course(
    request: Request,
    course_object: CourseUpdate,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "update", db_session)

    incoming_data = course_object.model_dump(exclude_none=True, exclude={"tab_store", "map_state", "tabs"})
    for field, value in incoming_data.items():
        setattr(course, field, value)

    new_tab_store = (
        sanitize_tab_map_store(course_object.tab_store)
        if course_object.tab_store is not None
        else None
    )

    if course_object.tabs is not None:
        existing_tabs = fetch_course_tabs(course.id, db_session)
        existing_ids = {tab.tab_uuid for tab in existing_tabs}
        used_ids = set(existing_ids)
        remap: Dict[str, str] = {}
        normalized_tabs: List[CourseTabUpsert] = []

        for tab in course_object.tabs:
            tab_uuid = tab.tab_uuid
            if tab_uuid in existing_ids:
                normalized_tabs.append(tab)
                used_ids.add(tab_uuid)
                continue

            normalized_uuid = _normalize_course_tab_uuid(tab_uuid, course.course_uuid)
            if normalized_uuid in used_ids:
                normalized_uuid = f"{normalized_uuid}-{uuid4()}"
            used_ids.add(normalized_uuid)

            if normalized_uuid != tab_uuid:
                remap[tab_uuid] = normalized_uuid
                payload = tab.model_dump()
                payload["tab_uuid"] = normalized_uuid
                normalized_tabs.append(CourseTabUpsert(**payload))
            else:
                normalized_tabs.append(tab)

        course_object.tabs = normalized_tabs

        if new_tab_store is not None and remap:
            remapped_store: Dict[str, Any] = {}
            for key, value in new_tab_store.items():
                remapped_store[remap.get(key, key)] = value
            new_tab_store = remapped_store

    if course_object.map_state is not None:
        course.map_state = sanitize_map_state(course_object.map_state)

    if new_tab_store is not None:
        course.tab_store = new_tab_store

    if course_object.tabs is not None:
        tabs = upsert_course_tabs(course, course_object.tabs, db_session)
    else:
        tabs = ensure_default_tabs(course, db_session)

    sanitized_store = sanitize_tab_map_store(course.tab_store)
    aligned_store: Dict[str, Dict[str, Any]] = {}
    for tab in tabs:
        aligned_store[tab.tab_uuid] = sanitized_store.get(tab.tab_uuid, default_map_state())

    course.tab_store = aligned_store

    if course_object.map_state is None and new_tab_store is not None:
        primary_tab_id = tabs[0].tab_uuid if tabs else None
        if primary_tab_id and primary_tab_id in aligned_store:
            course.map_state = aligned_store[primary_tab_id]
    course.map_state = sanitize_map_state(course.map_state)

    # Complete the course object
    course.update_date = str(datetime.now())

    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)

    # Get course authors
    authors_statement = (
        select(User)
        .join(ResourceAuthor)
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
    )
    authors = db_session.exec(authors_statement).all()

    # convert from User to UserRead
    author_reads = [UserRead.model_validate(author) for author in authors]

    course_read = build_course_read(course, author_reads, tabs)

    return course_read


async def delete_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Get course
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # Delete all chapters of this course first.
    statement = select(Chapter).where(Chapter.course_id == course.id)
    chapters = db_session.exec(statement).all()

    # Delete user canvas state tied to this course to avoid FK violations.
    statement = select(CourseCanvas).where(CourseCanvas.course_id == course.id)
    canvases = db_session.exec(statement).all()

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "delete", db_session)

    # Feature usage
    decrease_feature_usage("courses", course.org_id, db_session)

    for chapter in chapters:
        db_session.delete(chapter)
    for canvas in canvases:
        db_session.delete(canvas)
    db_session.delete(course)
    db_session.commit()

    return {"detail": "Course deleted"}





## 🔒 RBAC Utils ##


async def rbac_check(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
):
    if action == "read":
        course = db_session.exec(
            select(Course).where(Course.course_uuid == course_uuid)
        ).first()
        if course and not course.visible and not can_manage_hidden_course(
            course, current_user, db_session
        ):
            raise HTTPException(status_code=404, detail="Course not found")

        if current_user.id == 0:  # Anonymous user
            res = await authorization_verify_if_element_is_public(
                request, course_uuid, action, db_session
            )
            return res
        else:
            res = (
                await authorization_verify_based_on_roles_and_authorship(
                    request, current_user.id, action, course_uuid, db_session
                )
            )
            return res
    else:
        await authorization_verify_if_user_is_anon(current_user.id)

        await authorization_verify_based_on_roles_and_authorship(
            request,
            current_user.id,
            action,
            course_uuid,
            db_session,
        )


## 🔒 RBAC Utils ##
