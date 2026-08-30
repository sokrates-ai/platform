import json

import orjson

from src.services.courses.meta_cache import _WATCHED_MODELS, splice_trail


def test_splice_trail_inserts_trail_into_cached_body():
    shared = orjson.dumps({"course_uuid": "course_1", "chapters": [{"id": 1}]})

    body = splice_trail(shared, {"runs": []})

    payload = json.loads(body)
    assert payload["trail"] == {"runs": []}
    assert payload["course_uuid"] == "course_1"
    assert payload["chapters"] == [{"id": 1}]


def test_splice_trail_handles_null_trail():
    shared = orjson.dumps({"course_uuid": "course_1"})

    payload = json.loads(splice_trail(shared, None))

    assert payload["trail"] is None
    assert payload["course_uuid"] == "course_1"


def test_splice_trail_handles_empty_body():
    """A degenerate cached body must not produce '{"trail":null,}'."""
    payload = json.loads(splice_trail(b"{}", None))

    assert payload == {"trail": None}


def test_splice_trail_adds_exactly_one_trail_key():
    shared = orjson.dumps({"a": 1, "b": 2})

    body = splice_trail(shared, {"runs": []})

    assert body.count(b'"trail":') == 1


def test_watched_models_cover_the_course_payload():
    """
    The cached payload is built from these tables, so a write to any of them
    has to drop the cache. If one of the models is renamed this list must move
    with it - the invalidation hook matches on class name.
    """
    from src.db.courses.activities import Activity
    from src.db.courses.chapter_activities import ChapterActivity
    from src.db.courses.chapters import Chapter
    from src.db.courses.course_chapters import CourseChapter, CourseChapter_Graph
    from src.db.courses.course_tabs import CourseTab
    from src.db.courses.courses import Course
    from src.db.resource_authors import ResourceAuthor

    for model in (
        Course,
        CourseTab,
        Chapter,
        CourseChapter,
        CourseChapter_Graph,
        Activity,
        ChapterActivity,
        ResourceAuthor,
    ):
        assert model.__name__ in _WATCHED_MODELS
