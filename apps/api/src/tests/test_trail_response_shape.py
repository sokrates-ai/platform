import asyncio
import json
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
from src.db.trail_steps import TrailStepVerificationEnum
from src.db.users import PublicUser, User
from src.services.courses.courses import get_course_meta_json
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

    payload = json.loads(
        asyncio.run(
            get_course_meta_json(
                _build_request(f"/api/v1/courses/{course.course_uuid}/meta"),
                course.course_uuid,
                user,
                session,
            )
        )
    )

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


def test_course_meta_json_is_encodable_and_well_formed(session: Session):
    """
    The /meta route returns pre-encoded bytes built by splicing the per-user
    trail into a cached course body, so the result has to be valid JSON with the
    trail present exactly once - a splice bug would produce broken JSON rather
    than a wrong field.
    """
    import orjson

    user, course, _ = _prepare_course_with_trail_step(session)

    body = asyncio.run(
        get_course_meta_json(
            _build_request(f"/api/v1/courses/{course.course_uuid}/meta"),
            course.course_uuid,
            user,
            session,
        )
    )

    payload = json.loads(body)
    assert payload["course_uuid"] == course.course_uuid
    assert payload["trail"] is not None
    assert body.count(b'"trail":') == 1

    # The enums inside this payload must survive orjson as plain strings; orjson
    # only handles them because they subclass str.
    assert json.loads(
        orjson.dumps(
            {
                "activity_type": ActivityTypeEnum.TYPE_DYNAMIC,
                "verification": TrailStepVerificationEnum.CORRECT,
                "authorship": ResourceAuthorshipEnum.CREATOR,
            }
        )
    ) == {
        "activity_type": "TYPE_DYNAMIC",
        "verification": "CORRECT",
        "authorship": ResourceAuthorshipEnum.CREATOR.value,
    }


def test_course_meta_json_for_anonymous_user_has_null_trail(session: Session):
    from src.db.users import AnonymousUser

    _, course, _ = _prepare_course_with_trail_step(session)
    # Anonymous reads only get through RBAC on a public course.
    course.public = True
    session.add(course)
    session.commit()

    body = asyncio.run(
        get_course_meta_json(
            _build_request(f"/api/v1/courses/{course.course_uuid}/meta"),
            course.course_uuid,
            AnonymousUser(),
            session,
        )
    )

    payload = json.loads(body)
    assert payload["trail"] is None
    assert payload["course_uuid"] == course.course_uuid


def test_course_meta_json_can_omit_the_tab_store(session: Session):
    """
    tab_store carries the map state for every tab and is the bulk of a course
    payload. Readers that render one tab ask for it to be left out.
    """
    user, course, _ = _prepare_course_with_trail_step(session)
    request = _build_request(f"/api/v1/courses/{course.course_uuid}/meta")

    full = json.loads(
        asyncio.run(get_course_meta_json(request, course.course_uuid, user, session))
    )
    lean = json.loads(
        asyncio.run(
            get_course_meta_json(
                request, course.course_uuid, user, session, include_tab_store=False
            )
        )
    )

    assert full["tabStore"] != {}
    assert lean["tabStore"] == {}
    # Everything else is untouched, including the active tab's own map.
    assert lean["map_state"] == full["map_state"]
    assert lean["chapters"] == full["chapters"]
    assert lean["course_uuid"] == full["course_uuid"]


def test_lean_and_full_course_payloads_do_not_share_a_cache_entry(session: Session):
    """
    The two shapes are cached separately; serving one for the other would
    either strip the editor's store or undo the saving.
    """
    from src.services.courses.meta_cache import _key

    assert _key("meta", "course_1") != _key("meta-lean", "course_1")
    assert _key("course", "course_1") != _key("course-lean", "course_1")


def test_course_tab_map_returns_that_tab_and_falls_back(session: Session):
    from src.services.courses.courses import get_course_tab_map_json

    user, course, _ = _prepare_course_with_trail_step(session)
    request = _build_request(f"/api/v1/courses/{course.course_uuid}/tabs/x/map")

    full = json.loads(
        asyncio.run(get_course_meta_json(request, course.course_uuid, user, session))
    )
    known_tab = next(iter(full["tabStore"]))

    stored = json.loads(
        asyncio.run(
            get_course_tab_map_json(
                request, course.course_uuid, known_tab, user, session
            )
        )
    )
    assert stored == full["tabStore"][known_tab]

    # An unknown tab falls back to the course map_state rather than erroring.
    fallback = json.loads(
        asyncio.run(
            get_course_tab_map_json(
                request, course.course_uuid, "tab-does-not-exist", user, session
            )
        )
    )
    assert "objects" in fallback and "boundaries" in fallback
