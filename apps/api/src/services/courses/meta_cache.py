"""
Redis cache for the course meta payload.

/courses/{uuid}/meta is the most expensive read in the API: it returns the whole
course, every chapter and every activity, which for a real course is over a
megabyte. Building it costs a pydantic dump of that whole structure plus the
JSON decode of the map_state and activity content columns.

Everything in that payload except `trail` is the same for every user - chapters
and activities are not filtered per user, only authorized - so the expensive
part is cached once per course and the per-user trail is spliced in afterwards.
Authorization still runs on every request; only the payload is shared.

Correctness relies on invalidation rather than a short TTL: any commit that
touches course content clears the cache (see register_cache_invalidation). The
TTL is only a backstop for a missed invalidation, and it also bounds how long a
time-based tab reveal (`visible_after`) can be late.
"""

from __future__ import annotations

import logging
from typing import Optional

import orjson
from redis.asyncio import Redis

from config.config import get_learnhouse_config

_KEY_PREFIX = "course_meta:v1:"
_TTL_SECONDS = 300

_logger = logging.getLogger(__name__)
_redis_client: Optional[Redis] = None
_redis_unavailable = False


async def _get_redis() -> Optional[Redis]:
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is not None:
        return _redis_client

    conn_string = get_learnhouse_config().redis_config.redis_connection_string
    if not conn_string:
        _redis_unavailable = True
        _logger.info("Redis not configured; course meta caching disabled")
        return None

    try:
        # Bytes, not str: the cached value is a pre-encoded JSON body.
        _redis_client = Redis.from_url(conn_string, decode_responses=False)
    except Exception:
        _logger.exception("Failed to connect to Redis for course meta caching")
        _redis_unavailable = True
        _redis_client = None
        return None

    return _redis_client


def _key(course_uuid: str) -> str:
    return f"{_KEY_PREFIX}{course_uuid}"


async def get_cached_shared_payload(course_uuid: str) -> Optional[bytes]:
    """The course payload as JSON bytes, without the per-user `trail` key."""
    redis = await _get_redis()
    if redis is None:
        return None
    try:
        return await redis.get(_key(course_uuid))
    except Exception:
        _logger.warning("Course meta cache read failed", exc_info=True)
        return None


async def set_cached_shared_payload(course_uuid: str, payload: bytes) -> None:
    redis = await _get_redis()
    if redis is None:
        return
    try:
        await redis.set(_key(course_uuid), payload, ex=_TTL_SECONDS)
    except Exception:
        _logger.warning("Course meta cache write failed", exc_info=True)


async def invalidate(course_uuid: Optional[str] = None) -> None:
    """Drop one course, or every course when the change cannot be attributed."""
    redis = await _get_redis()
    if redis is None:
        return
    try:
        if course_uuid is not None:
            await redis.delete(_key(course_uuid))
            return
        keys = [key async for key in redis.scan_iter(match=f"{_KEY_PREFIX}*")]
        if keys:
            await redis.delete(*keys)
    except Exception:
        _logger.warning("Course meta cache invalidation failed", exc_info=True)


def splice_trail(shared_payload: bytes, trail: object) -> bytes:
    """
    Insert the per-user `trail` into a cached course payload.

    Concatenating bytes keeps the megabyte of cached JSON untouched; re-parsing
    it to add one key would give back most of the cost the cache just saved.
    """
    trail_json = orjson.dumps(trail)
    if len(shared_payload) <= 2:  # b"{}" or shorter: nothing to append to
        return b'{"trail":' + trail_json + b"}"
    # shared_payload starts with "{"; splice after it.
    return b'{"trail":' + trail_json + b"," + shared_payload[1:]


# --- invalidation -----------------------------------------------------------
#
# Invalidation has to run from SQLAlchemy's commit hook, which is synchronous
# and may be on a worker thread, so it uses a separate blocking client rather
# than trying to drive the async one.

_sync_redis = None
_sync_unavailable = False

# Committing any of these means some course's meta payload may have changed.
# Attributing a change to a single course would mean walking relationships for
# every write, so the whole (small) namespace is dropped instead.
_WATCHED_MODELS = frozenset(
    {
        "Course",
        "CourseTab",
        "Chapter",
        "CourseChapter",
        "CourseChapter_Graph",
        "Activity",
        "ChapterActivity",
        "ResourceAuthor",
    }
)

_DIRTY_FLAG = "_course_meta_cache_dirty"


def _get_sync_redis():
    global _sync_redis, _sync_unavailable
    if _sync_unavailable:
        return None
    if _sync_redis is not None:
        return _sync_redis

    conn_string = get_learnhouse_config().redis_config.redis_connection_string
    if not conn_string:
        _sync_unavailable = True
        return None

    try:
        from redis import Redis as SyncRedis

        _sync_redis = SyncRedis.from_url(conn_string, decode_responses=False)
    except Exception:
        _logger.exception("Failed to connect to Redis for cache invalidation")
        _sync_unavailable = True
        _sync_redis = None

    return _sync_redis


def invalidate_sync() -> None:
    redis = _get_sync_redis()
    if redis is None:
        return
    try:
        keys = list(redis.scan_iter(match=f"{_KEY_PREFIX}*"))
        if keys:
            redis.delete(*keys)
    except Exception:
        _logger.warning("Course meta cache invalidation failed", exc_info=True)


def register_cache_invalidation() -> None:
    """
    Clear the cache whenever course content is committed.

    Hooking the session rather than each mutating service means a new write path
    cannot silently start serving stale courses.
    """
    from itertools import chain

    from sqlalchemy import event
    from sqlalchemy.orm import Session as SASession

    @event.listens_for(SASession, "after_flush")
    def _note_course_writes(session, flush_context):  # noqa: ANN001
        if session.info.get(_DIRTY_FLAG):
            return
        for obj in chain(session.new, session.dirty, session.deleted):
            if type(obj).__name__ in _WATCHED_MODELS:
                session.info[_DIRTY_FLAG] = True
                return

    @event.listens_for(SASession, "after_commit")
    def _invalidate_after_commit(session):  # noqa: ANN001
        if session.info.pop(_DIRTY_FLAG, False):
            invalidate_sync()
