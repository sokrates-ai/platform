import json

from sqlmodel import Field, SQLModel

from src.core.responses import orjson_response


class _Thing(SQLModel):
    id: int
    tab_store: dict = Field(default_factory=dict, alias="tabStore")


def test_single_model_is_not_treated_as_a_sequence():
    """
    pydantic v1 models implement __iter__ over their fields, so a naive
    Iterable check turns one model into a list of its own field pairs.
    """
    response = orjson_response(_Thing(id=7, tabStore={"a": 1}))

    body = json.loads(response.body)
    assert isinstance(body, dict)
    assert body["id"] == 7


def test_aliases_are_preserved():
    response = orjson_response(_Thing(id=1, tabStore={"x": 2}))

    body = json.loads(response.body)
    assert "tabStore" in body
    assert "tab_store" not in body


def test_list_of_models_stays_a_list():
    response = orjson_response([_Thing(id=1), _Thing(id=2)])

    body = json.loads(response.body)
    assert [item["id"] for item in body] == [1, 2]


def test_media_type_is_json():
    response = orjson_response(_Thing(id=1))

    assert response.media_type == "application/json"
