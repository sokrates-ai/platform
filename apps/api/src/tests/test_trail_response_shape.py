import asyncio
from datetime import datetime
from uuid import uuid4

from sqlmodel import Session
from starlette.requests import Request

from src.db.courses.activities import (
    Activity,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.course_tabs import CourseTab
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum
from src.db.users import PublicUser, User
from src.services.courses.courses import get_course_meta
from src.services.trail.trail import add_activity_to_trail, get_user_trails


def _build_request(path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": [],
        }
    )


def _dump_model(model, *, by_alias: bool = False) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump(by_alias=by_alias)
    return model.dict(by_alias=by_alias)


def _build_map_state() -> dict:
    return {
        "objects": [
            {
                "id": "map-node-1",
                "name": "Top-level only",
                "file": "x" * 128,
            }
        ],
        "boundaries": {
            "left": -1000,
            "right": 1000,
            "top": -1000,
            "bottom": 1000,
        },
    }


def _build_tab_store(tab_uuid: str) -> dict:
    return {
        tab_uuid: {
            "map": _build_map_state(),
            "content": {
                "chapters": [],
            },
        }
    }


def _prepare_course_with_trail_step(
    session: Session,
) -> tuple[PublicUser, Course, Activity]:
    now = datetime.utcnow().isoformat()
    org = Organization(
        name=f"Trail Shape Org {uuid4()}",
        description="",
        slug=f"trail-shape-{uuid4()}",
        email=f"trail-shape-org-{uuid4()}@school.dev",
        logo_image="",
        thumbnail_image="",
        org_uuid=f"org_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(org)
    session.commit()
    session.refresh(org)

    user = User(
        username=f"trail-shape-{uuid4()}",
        first_name="Trail",
        last_name="Shape",
        email=f"trail-shape-{uuid4()}@school.dev",
        password="secret",
        user_uuid=f"user_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    tab_uuid = f"tab-{uuid4()}"
    course = Course(
        name=f"Trail Shape {uuid4()}",
        description="A course used to verify lean trail payloads.",
        about="",
        learnings="",
        tags="",
        thumbnail_image="thumbnail.png",
        map_state=_build_map_state(),
        tab_store=_build_tab_store(tab_uuid),
        public=False,
        org_id=org.id,
        course_uuid=f"course_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)

    tab = CourseTab(
        tab_uuid=tab_uuid,
        course_id=course.id,
        course_uuid=course.course_uuid,
        name="Content",
        position=0,
        creation_date=now,
        update_date=now,
    )
    session.add(tab)

    author = ResourceAuthor(
        resource_uuid=course.course_uuid,
        user_id=user.id,
        authorship=ResourceAuthorshipEnum.CREATOR,
        creation_date=now,
        update_date=now,
    )
    session.add(author)
    session.commit()

    activity = Activity(
        name="Dynamic Page",
        activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
        content={},
        published=True,
        org_id=org.id,
        course_id=course.id,
        activity_uuid=f"activity_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    public_user = PublicUser.model_validate(user)
    asyncio.run(
        add_activity_to_trail(
            _build_request("/api/v1/trail/start_activity"),
            public_user,
            activity.activity_uuid,
            session,
            complete=False,
        )
    )

    return public_user, course, activity


def test_get_user_trails_returns_lean_course_summaries(session: Session):
    user, course, _ = _prepare_course_with_trail_step(session)

    trail = asyncio.run(
        get_user_trails(
            _build_request("/api/v1/trail"),
            user,
            session,
        )
    )
    payload = _dump_model(trail)

    assert len(payload["runs"]) == 1

    run = payload["runs"][0]
    assert run["course"] == {
        "id": course.id,
        "course_uuid": course.course_uuid,
        "name": course.name,
        "description": course.description,
        "thumbnail_image": course.thumbnail_image,
        "org_id": course.org_id,
        "public": course.public,
    }
    assert "map_state" not in run["course"]
    assert "tabStore" not in run["course"]
    assert run["steps"][0]["data"] == {}


def test_get_course_meta_keeps_trail_steps_lean(session: Session):
    user, course, _ = _prepare_course_with_trail_step(session)

    course_meta = asyncio.run(
        get_course_meta(
            _build_request(f"/api/v1/courses/{course.course_uuid}/meta"),
            course.course_uuid,
            user,
            session,
        )
    )
    payload = _dump_model(course_meta, by_alias=True)

    assert payload["course_uuid"] == course.course_uuid
    assert payload["trail"] is not None
    assert len(payload["trail"]["runs"]) == 1

    run = payload["trail"]["runs"][0]
    assert run["course"] == {
        "id": course.id,
        "course_uuid": course.course_uuid,
        "name": course.name,
        "description": course.description,
        "thumbnail_image": course.thumbnail_image,
        "org_id": course.org_id,
        "public": course.public,
    }
    assert "map_state" not in run["course"]
    assert "tabStore" not in run["course"]
    assert run["steps"][0]["data"] == {"parts": []}
