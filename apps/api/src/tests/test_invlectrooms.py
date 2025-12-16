import requests
from fastapi.testclient import TestClient
from hashlib import sha256
from pathlib import Path
from typing import Optional


def _test_content_dir() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "content"
        if candidate.exists():
            return candidate
    raise RuntimeError("Content directory not found for tests")


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
