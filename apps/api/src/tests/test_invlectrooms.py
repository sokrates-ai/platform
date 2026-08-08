import requests
from fastapi.testclient import TestClient
from hashlib import sha256
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime
from uuid import uuid4
from sqlmodel import Session, select

from src.db.organizations import Organization
from src.db.users import User, PublicUser
from src.db.courses.courses import Course, default_map_state, default_tab_store
from src.db.courses.course_tabs import CourseTab
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum
from src.db.courses.activities import Activity
from src.security.auth import get_current_user


def _test_content_dir() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "content"
        if candidate.exists():
            return candidate
    raise RuntimeError("Content directory not found for tests")


def _prepare_course_with_author(session: Session) -> Tuple[Course, str, PublicUser]:
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    if org is None:
        raise AssertionError("Test organization 'wayne' must exist")

    user = session.exec(select(User).where(User.username == "batman")).first()
    if user is None:
        raise AssertionError("Test user 'batman' must exist")

    public_user = PublicUser.model_validate(user)

    now = datetime.utcnow().isoformat()
    course = Course(
        name="Imported Course",
        description="",
        about="",
        learnings="",
        tags="",
        thumbnail_image="",
        map_state=default_map_state(),
        tab_store=default_tab_store(),
        public=False,
        org_id=org.id,
        course_uuid=f"course_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)

    tab_uuid = f"tab_{uuid4()}"
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
    session.commit()

    author = ResourceAuthor(
        resource_uuid=course.course_uuid,
        user_id=user.id,
        authorship=ResourceAuthorshipEnum.CREATOR,
        creation_date=now,
        update_date=now,
    )
    session.add(author)
    session.commit()

    return course, tab.tab_uuid, public_user


def test_scrape_invlectrooms_success(client: TestClient, monkeypatch):
    class DummyResponse:
        def __init__(
            self,
            *,
            text: Optional[str] = None,
            json_data: Optional[dict] = None,
            content: Optional[bytes] = None,
        ):
            self.text = text or ""
            self._json_data = json_data
            self._content = content
            self.status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self):
            if self._json_data is None:
                raise ValueError("No JSON data")
            return self._json_data

        @property
        def content(self) -> bytes:
            if self._content is not None:
                return self._content
            return self.text.encode("utf-8")

    def fake_get(url: str, timeout: float, headers: dict):
        assert "User-Agent" in headers
        if url == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/riddlegroups/room/674":
            return DummyResponse(
                text="""
                <html>
                    <body>
                        <h1>Room</h1>
                        <p>Available</p>
                        <p><img src="/friedrich/docs/InvLectRooms/mathe2/static/plan.png" alt="Room plan" title="Plan" /></p>
                        <script>
                            fetch("/friedrich/docs/InvLectRooms/mathe2/riddlegroups/room/674/refresh");
                        </script>
                    </body>
                </html>
                """
            )
        if url == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/riddlegroups/room/674/refresh":
            return DummyResponse(
                json_data={
                    "problems": [
                        {
                            "id": 1,
                            "status": "UNSOLVED",
                            "title": "Room",
                            "body": '<p><img src="/friedrich/docs/InvLectRooms/mathe2/media/uploads/body.png"></p>',
                            "img": "/friedrich/docs/InvLectRooms/mathe2/media/uploads/dcc4d6941ce0d5df3b4bb68fe4ef8a54596a3eda1d96334cdf61a7543221d357.jpg",
                        }
                    ],
                    "tutorStatus": False,
                    "tutorStatusMessage": "Tutor available",
                }
            )
        if url == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/static/plan.png":
            return DummyResponse(content=b"plan-image")
        if url == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/media/uploads/dcc4d6941ce0d5df3b4bb68fe4ef8a54596a3eda1d96334cdf61a7543221d357.jpg":
            return DummyResponse(content=b"problem-image")
        if url == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/media/uploads/body.png":
            return DummyResponse(content=b"body-image")
        raise AssertionError(f"Unexpected URL requested: {url}")

    monkeypatch.setattr("src.services.invlectrooms.scraper.requests.get", fake_get)

    response = client.post(
        "/api/v1/invlectrooms",
        json={"url": "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/riddlegroups/room/674"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["url"] == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/riddlegroups/room/674"
    assert payload["refresh_url"] == "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/riddlegroups/room/674/refresh"
    refresh = payload["refresh"]
    assert refresh["tutorStatusMessage"] == "Tutor available"
    image_mappings = {
        entry["original"]: entry["local"] for entry in refresh["_images"]
    }
    plan_original = "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/static/plan.png"
    expected_plan_hash = sha256(plan_original.encode("utf-8")).hexdigest()
    expected_plan_local = f"/content/invlectrooms/{expected_plan_hash}.png"
    assert image_mappings[plan_original] == expected_plan_local
    problem = refresh["problems"][0]
    original_problem_img = "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/media/uploads/dcc4d6941ce0d5df3b4bb68fe4ef8a54596a3eda1d96334cdf61a7543221d357.jpg"
    expected_problem_hash = sha256(original_problem_img.encode("utf-8")).hexdigest()
    expected_problem_local = f"/content/invlectrooms/{expected_problem_hash}.jpg"
    assert image_mappings[original_problem_img] == expected_problem_local
    assert problem["img"]["original"] == original_problem_img
    assert problem["img"]["local"] == expected_problem_local
    original_body_img = "https://hpi.de/friedrich/docs/InvLectRooms/mathe2/media/uploads/body.png"
    expected_body_hash = sha256(original_body_img.encode("utf-8")).hexdigest()
    expected_body_local = f"/content/invlectrooms/{expected_body_hash}.png"
    assert image_mappings[original_body_img] == expected_body_local
    assert f'data-original-src="{original_body_img}"' in problem["body"]
    assert f'src="{expected_body_local}"' in problem["body"]
    content_dir = _test_content_dir() / "invlectrooms"
    cached_problem_path = content_dir / f"{expected_problem_hash}.jpg"
    cached_body_path = content_dir / f"{expected_body_hash}.png"
    cached_plan_path = content_dir / f"{expected_plan_hash}.png"
    assert cached_problem_path.exists()
    assert cached_body_path.exists()
    assert cached_plan_path.exists()


def test_scrape_invlectrooms_static_page(client: TestClient, monkeypatch):
    html_path = Path(__file__).resolve().parents[4] / "tutorium"
    html_content = html_path.read_text(encoding="utf-8")
    target_url = "https://hpi.de/friedrich/docs/InvLectRooms/mathe1/riddlegroups/course/4/Ableiten-ONotation/tutorium"

    class DummyResponse:
        def __init__(
            self,
            *,
            text: Optional[str] = None,
            content: Optional[bytes] = None,
        ):
            self.text = text or ""
            self._content = content
            self.status_code = 200

        def raise_for_status(self) -> None:
            return None

        @property
        def content(self) -> bytes:
            if self._content is not None:
                return self._content
            return self.text.encode("utf-8")

    def fake_get(url: str, timeout: float, headers: dict):
        assert "User-Agent" in headers
        if url == target_url:
            return DummyResponse(text=html_content)
        if url.startswith("https://hpi.de/friedrich/docs/InvLectRooms/mathe1"):
            return DummyResponse(content=b"image-bytes")
        raise AssertionError(f"Unexpected URL requested: {url}")

    monkeypatch.setattr("src.services.invlectrooms.scraper.requests.get", fake_get)

    response = client.post("/api/v1/invlectrooms", json={"url": target_url})
    assert response.status_code == 200
    payload = response.json()

    assert payload["refresh_url"] is None
    refresh = payload["refresh"]
    assert refresh is not None
    problems = refresh["problems"]
    assert len(problems) >= 1

    first_problem = problems[0]
    assert first_problem["id"] == 603
    assert first_problem["title"].startswith("1. Folgen Ordnen I")
    assert "Ordne die folgenden Terme" in first_problem["body"]

    checkpoints = {
        problem["id"]: problem.get("checkpointLevel")
        for problem in problems
        if problem.get("checkpointLevel")
    }
    assert checkpoints.get(323) == "bronze"
    assert checkpoints.get(324) == "silver"
    assert checkpoints.get(325) == "gold"

    emoji_problem = next(problem for problem in problems if problem["id"] == 732)
    assert emoji_problem["img"]["original"].endswith("BiOEmoji_oDrqHh6.jpg")
    assert emoji_problem["img"]["local"].startswith("/content/invlectrooms/")

    image_mappings = {entry["original"]: entry["local"] for entry in refresh["_images"]}
    assert (
        "https://hpi.de/friedrich/docs/InvLectRooms/mathe1/media/uploads/BiOEmoji_oDrqHh6.jpg"
        in image_mappings
    )


def test_apply_invlectrooms_creates_activities(
    client: TestClient,
    session: Session,
):
    course, tab_uuid, public_user = _prepare_course_with_author(session)

    async def override_current_user():
        return public_user

    client.app.dependency_overrides[get_current_user] = override_current_user

    try:
        payload = {
            "url": "https://hpi.de/friedrich/docs/InvLectRooms/example/tutorium",
            "course_uuid": course.course_uuid,
            "tab_uuid": tab_uuid,
            "xp_reward": 12,
            "coin_reward": 3,
            "problems": [
                {
                    "id": 603,
                    "title": "Follow sequences",
                    "status": "UNSOLVED",
                    "html": "<p>Arrange the following terms by growth.</p>",
                    "plain_text": "Arrange the following terms by growth.",
                    "image": {
                        "original": "https://example.com/image.jpg",
                        "local": "/content/invlectrooms/sample.jpg",
                    },
                    "chapter_name": "Tutorium — Follow sequences",
                },
                {
                    "id": 732,
                    "title": "Emoji challenge",
                    "status": "SOLVED",
                    "plain_text": "Consider the emoji puzzle.",
                    "image": None,
                    "chapter_name": "Tutorium — Emoji challenge",
                },
            ],
        }

        response = client.post("/api/v1/invlectrooms/apply", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert len(data["chapters"]) == 2
        chapter_names = [chapter["name"] for chapter in data["chapters"]]
        for chapter in data["chapters"]:
            assert len(chapter.get("activities", [])) == 1
        assert chapter_names == [
            "Tutorium — Follow sequences",
            "Tutorium — Emoji challenge",
        ]
        assert all(chapter["xp_reward"] == 12 for chapter in data["chapters"])
        assert all(chapter["coin_reward"] == 3 for chapter in data["chapters"])
        assert len(data["activities"]) == 2
        first_activity = data["activities"][0]
        assert first_activity["name"] == "Follow sequences"
        assert first_activity["activity_type"] == "TYPE_DYNAMIC"
        assert first_activity["content"]["meta"]["source"]["provider"] == "invlectrooms"
        assert first_activity["published"] is True

        activity_records = session.exec(
            select(Activity).where(Activity.course_id == course.id)
        ).all()
        assert len(activity_records) == 2

        session.refresh(course)
        map_state = course.map_state
        assert isinstance(map_state, dict)
        objects = map_state.get("objects") or []
        chapter_nodes = [
            obj
            for obj in objects
            if isinstance(obj, dict)
            and obj.get("file") == "Stein_Moos.webp"
            and (obj.get("type") or {}).get("kind") == "chapter"
        ]
        assert len(chapter_nodes) == len(payload["problems"])
        assert all(node.get("label") == "cool" for node in chapter_nodes)
        assert all((node.get("type") or {}).get("associatedChapterID") for node in chapter_nodes)

        remaining_placeholders = [
            obj for obj in objects if isinstance(obj, dict) and obj.get("file") == "Placeholder.webp"
        ]
        assert not remaining_placeholders

        image_assets = [
            obj
            for obj in objects
            if isinstance(obj, dict)
            and obj.get("file") == "https://example.com/image.jpg"
        ]
        assert len(image_assets) == 1
        assert image_assets[0]["anchor"] == 0.5
        assert image_assets[0].get("sourceUrl") == "https://example.com/image.jpg"
        assert image_assets[0].get("type", {}).get("kind") == "default"

        boundaries = map_state.get("boundaries")
        assert boundaries == {"left": -1800, "right": 1800, "top": -1400, "bottom": 1400}

        tab_map = course.tab_store.get(tab_uuid)
        assert isinstance(tab_map, dict)
        assert tab_map == map_state
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_apply_invlectrooms_skips_image_only_problem(
    client: TestClient,
    session: Session,
):
    course, tab_uuid, public_user = _prepare_course_with_author(session)

    async def override_current_user():
        return public_user

    client.app.dependency_overrides[get_current_user] = override_current_user

    try:
        payload = {
            "url": "https://hpi.de/friedrich/docs/InvLectRooms/example/tutorium",
            "course_uuid": course.course_uuid,
            "tab_uuid": tab_uuid,
            "problems": [
                {
                    "id": 701,
                    "title": "Image-only",
                    "status": "UNSOLVED",
                    "html": "",
                    "plain_text": "",
                    "image": {
                        "original": "https://example.com/image-only.jpg",
                        "local": "/content/invlectrooms/image-only.jpg",
                    },
                    "chapter_name": "Tutorium — Image-only",
                },
                {
                    "id": 702,
                    "title": "Text problem",
                    "status": "UNSOLVED",
                    "html": "<p>Answer the question.</p>",
                    "plain_text": "Answer the question.",
                    "image": None,
                    "chapter_name": "Tutorium — Text problem",
                },
            ],
        }

        response = client.post("/api/v1/invlectrooms/apply", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert len(data["chapters"]) == 1
        assert len(data["activities"]) == 1

        session.refresh(course)
        map_state = course.map_state
        assert isinstance(map_state, dict)
        objects = map_state.get("objects") or []

        image_assets = [
            obj
            for obj in objects
            if isinstance(obj, dict)
            and obj.get("file") == "https://example.com/image-only.jpg"
        ]
        assert len(image_assets) == 1

        chapter_nodes = [
            obj
            for obj in objects
            if isinstance(obj, dict)
            and (obj.get("type") or {}).get("kind") == "chapter"
        ]
        assert len(chapter_nodes) == 1
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_apply_invlectrooms_creates_standalone_checkpoint_marker(
    client: TestClient,
    session: Session,
):
    course, tab_uuid, public_user = _prepare_course_with_author(session)

    async def override_current_user():
        return public_user

    client.app.dependency_overrides[get_current_user] = override_current_user

    try:
        payload = {
            "url": "https://hpi.de/friedrich/docs/InvLectRooms/example/tutorium",
            "course_uuid": course.course_uuid,
            "tab_uuid": tab_uuid,
            "problems": [
                {
                    "id": 999,
                    "title": "Schnabeltierchen Bronze",
                    "status": "UNSOLVED",
                    "html": "<p>Schnabeltierchen Bronze checkpoint</p>",
                    "plain_text": "Schnabeltierchen Bronze checkpoint",
                    "image": {
                        "original": "https://example.com/PlatypusBronze.jpg",
                        "local": "/content/invlectrooms/platypus-bronze.jpg",
                    },
                    "chapter_name": "Tutorium — Bronze checkpoint",
                    "checkpoint_level": "bronze",
                },
            ],
        }

        response = client.post("/api/v1/invlectrooms/apply", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["chapters"] == []
        assert data["activities"] == []

        session.refresh(course)
        map_state = course.map_state
        assert isinstance(map_state, dict)
        checkpoint_markers = [
            obj
            for obj in map_state.get("objects", [])
            if isinstance(obj, dict)
            and (obj.get("metadata") or {}).get("checkpointLevel") == "bronze"
        ]
        assert len(checkpoint_markers) == 1
        marker = checkpoint_markers[0]
        assert marker["type"]["kind"] == "default"
        assert marker["type"]["associatedChapterID"] is None
        assert marker["anchor"] == 0.5
        assert marker["file"] == "Bronze.webp"
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_apply_invlectrooms_keeps_checkpoint_out_of_chapter_sequence(
    client: TestClient,
    session: Session,
):
    course, tab_uuid, public_user = _prepare_course_with_author(session)

    async def override_current_user():
        return public_user

    client.app.dependency_overrides[get_current_user] = override_current_user

    try:
        response = client.post(
            "/api/v1/invlectrooms/apply",
            json={
                "url": "https://hpi.de/friedrich/docs/InvLectRooms/example/tutorium",
                "course_uuid": course.course_uuid,
                "tab_uuid": tab_uuid,
                "problems": [
                    {
                        "id": 1,
                        "title": "A normal problem",
                        "html": "<p>Content</p>",
                        "plain_text": "Content",
                        "chapter_name": "Normal chapter",
                    },
                    {
                        "id": 2,
                        "title": "Schnabeltierchen in Silber",
                        "image": {
                            "original": "https://example.com/PlatypusSilver.jpg",
                        },
                        "chapter_name": None,
                    },
                    {
                        "id": 3,
                        "title": "Another normal problem",
                        "html": "<p>More content</p>",
                        "plain_text": "More content",
                        "chapter_name": "Another chapter",
                    },
                ],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["chapters"]) == 2
        assert len(data["activities"]) == 2

        session.refresh(course)
        objects = course.map_state["objects"]
        checkpoint_markers = [
            obj
            for obj in objects
            if obj.get("file") == "Silber.webp"
            and obj.get("metadata", {}).get("checkpointLevel") == "silver"
        ]
        assert len(checkpoint_markers) == 1
        assert checkpoint_markers[0]["type"]["kind"] == "default"
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_scrape_invlectrooms_failure(client: TestClient, monkeypatch):
    class DummyResponse:
        status_code = 503

        def raise_for_status(self) -> None:
            raise requests.HTTPError(response=self)

    def failing_get(url: str, timeout: float, headers: dict):
        return DummyResponse()

    monkeypatch.setattr("src.services.invlectrooms.scraper.requests.get", failing_get)

    response = client.post(
        "/api/v1/invlectrooms",
        json={"url": "https://rooms.test/down"},
    )

    assert response.status_code == 503
    assert "detail" in response.json()
