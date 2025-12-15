from fastapi.testclient import TestClient
from sqlmodel import Session


def test_create_default_elements(client: TestClient, session: Session):
    response = client.get(
        "/api/v1/orgs/slug/wayne",
    )

    assert response.status_code == 200
