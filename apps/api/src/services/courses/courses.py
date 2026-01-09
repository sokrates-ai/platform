from typing import Any, Dict, Literal, List, Optional
from uuid import uuid4
from src.db.courses.chapters import Chapter
from sqlmodel import Session, select, or_, and_
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.organizations import Organization
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
    FullCourseReadWithTrail,
    default_map_state,
)
from src.db.courses.course_tabs import CourseTab, CourseTabRead, CourseTabUpsert
from src.db.courses.course_chapters import CourseChapter_Graph
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
            tab_uuid=spec["tab_uuid"],
            course_id=course.id,
            course_uuid=course.course_uuid,
            name=spec["name"],
            position=index,
            creation_date=now,
            update_date=now,
        )
        db_session.add(tab)
        created_tabs.append(tab)

    db_session.commit()
    for tab in created_tabs:
        db_session.refresh(tab)

    return created_tabs


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
        if tab_uuid in existing_by_id:
            tab = existing_by_id[tab_uuid]
            if tab.name != payload.name or tab.position != payload.position:
                tab.name = payload.name
                tab.position = payload.position
                tab.update_date = now
                db_session.add(tab)
        else:
            tab = CourseTab(
                tab_uuid=payload.tab_uuid,
                course_id=course.id,
                course_uuid=course.course_uuid,
                name=payload.name,
                position=payload.position,
                creation_date=now,
                update_date=now,
            )
            db_session.add(tab)

    # Reassign chapters from tabs that will be removed
    ordered_payload = sorted(incoming_tabs, key=lambda t: t.position)
    fallback_tab_uuid = ordered_payload[0].tab_uuid if ordered_payload else None

    tabs_to_delete = [
        tab for tab_uuid, tab in existing_by_id.items() if tab_uuid not in incoming_by_id
    ]
    if tabs_to_delete and not fallback_tab_uuid:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete all tabs from a course.",
        )

    for tab in tabs_to_delete:
        if not fallback_tab_uuid:
            continue
        edge_stmt = (
            select(CourseChapter_Graph)
            .where(CourseChapter_Graph.course_id == course.id)
            .where(CourseChapter_Graph.tab_uuid == tab.tab_uuid)
        )
        edges = db_session.exec(edge_stmt).all()
        for edge in edges:
            edge.tab_uuid = fallback_tab_uuid  # type: ignore[arg-type]
            db_session.add(edge)
        db_session.delete(tab)

    db_session.commit()
    return fetch_course_tabs(course.id, db_session)


def build_course_read(
    course: Course,
    authors: List[UserRead],
    tabs: List[CourseTab],
) -> CourseRead:
    sanitized_store = sanitize_tab_map_store(course.tab_store)

    if not tabs:
        tab_reads = [
            CourseTabRead(
                tab_uuid=spec["tab_uuid"],
                course_uuid=course.course_uuid,
                name=spec["name"],
                position=index,
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


async def get_course_meta(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> FullCourseReadWithTrail:
    # Avoid circular import
    from src.services.courses.chapters import get_course_chapters

    course_statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(course_statement).first()

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

    # Get course chapters
    chapters = await get_course_chapters(request, course.id, db_session, current_user)

    # Trail
    trail = None

    if isinstance(current_user, AnonymousUser):
        trail = None
    else:
        trail = await get_user_trail_with_orgid(
            request, current_user, course.org_id, db_session
        )

    return FullCourseReadWithTrail(
        **course_read.model_dump(),
        chapters=chapters,
        trail=trail if trail else None,
    )

async def get_courses_orgslug(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    org_slug: str,
    db_session: Session,
    page: int = 1,
    limit: int = 10,
) -> List[CourseRead]:
    offset = (page - 1) * limit

    # Base query
    query = (
        select(Course)
        .join(Organization)
        .where(Organization.slug == org_slug)
    )

    if isinstance(current_user, AnonymousUser):
        # For anonymous users, only show public courses
        query = query.where(Course.public == True)
    else:
        # For authenticated users, show:
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
            .where(or_(
                Course.public == True,
                UserGroupResource.resource_uuid == None,  # Courses not in any UserGroup # noqa: E711
                UserGroupUser.user_id == current_user.id,  # Courses in UserGroups where user is a member
                ResourceAuthor.user_id == current_user.id  # Courses where user is a resource author
            ))
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
    )

    courses = db_session.exec(query).all()

    # Fetch authors for each course
    course_reads = []
    for course in courses:
        authors_query = (
            select(User)
            .join(ResourceAuthor, ResourceAuthor.user_id == User.id)  # type: ignore
            .where(ResourceAuthor.resource_uuid == course.course_uuid)
        )
        authors = db_session.exec(authors_query).all()

        author_reads = [UserRead.model_validate(author) for author in authors]
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
        spec["tab_uuid"]: default_map_state() for spec in DEFAULT_TABS
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
            tab_uuid=spec["tab_uuid"] + course.course_uuid,
            course_id=course.id,
            course_uuid=course.course_uuid,
            name=spec["name"],
            position=index,
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

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "delete", db_session)

    # Feature usage
    decrease_feature_usage("courses", course.org_id, db_session)

    for chapter in chapters:
        db_session.delete(chapter)
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
