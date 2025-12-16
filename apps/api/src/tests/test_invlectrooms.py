import requests
from fastapi.testclient import TestClient


def test_scrape_invlectrooms_success(client: TestClient, monkeypatch):
    class DummyResponse:
        status_code = 200

        def __init__(self, text: str):
            self.text = text

        def raise_for_status(self) -> None:
            return None

    def fake_get(url: str, timeout: float, headers: dict):
        assert url == "https://rooms.test/example"
        assert "User-Agent" in headers
        return DummyResponse("<html><body><h1>Room</h1><p>Available</p></body></html>")

    monkeypatch.setattr("src.services.invlectrooms.scraper.requests.get", fake_get)

    response = client.post(
        "/api/v1/invlectrooms",
        json={"url": "https://rooms.test/example"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["url"] == "https://rooms.test/example"
    assert payload["structure"]["tag"] == "body"
    h1 = payload["structure"]["children"][0]
    assert h1["tag"] == "h1"
    assert h1["children"][0]["text"] == "Room"


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
