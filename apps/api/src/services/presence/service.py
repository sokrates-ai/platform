from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Iterable

from redis.asyncio import Redis

from config.config import get_learnhouse_config


PRESENCE_KEY_PREFIX = "presence:user:"
PRESENCE_TTL_SECONDS = 120

_redis_client: Redis | None = None
_redis_unavailable = False
_logger = logging.getLogger(__name__)


async def _get_redis() -> Redis | None:
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is not None:
        return _redis_client

    conn_string = get_learnhouse_config().redis_config.redis_connection_string
    if not conn_string:
        _redis_unavailable = True
        _logger.info("Redis not configured; presence tracking disabled")
        return None

    try:
        _redis_client = Redis.from_url(conn_string, decode_responses=True)
    except Exception:
        _logger.exception("Failed to connect to Redis for presence tracking")
        _redis_unavailable = True
        _redis_client = None
        return None

    return _redis_client


def _presence_key(user_id: int) -> str:
    return f"{PRESENCE_KEY_PREFIX}{user_id}"


async def mark_online(user_id: int) -> None:
    redis = await _get_redis()
    if redis is None:
        return
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        await redis.set(_presence_key(user_id), timestamp, ex=PRESENCE_TTL_SECONDS)
    except Exception:
        _logger.exception("Failed to update presence for user %s", user_id)


async def mark_offline(user_id: int) -> None:
    redis = await _get_redis()
    if redis is None:
        return
    try:
        await redis.delete(_presence_key(user_id))
    except Exception:
        _logger.exception("Failed to clear presence for user %s", user_id)


async def get_presence_map(user_ids: Iterable[int]) -> dict[int, bool]:
    user_list = [uid for uid in user_ids if isinstance(uid, int)]
    if not user_list:
        return {}

    redis = await _get_redis()
    if redis is None:
        return {uid: False for uid in user_list}

    keys = [_presence_key(uid) for uid in user_list]
    try:
        values = await redis.mget(keys)
    except Exception:
        _logger.exception("Failed to fetch presence map")
        return {uid: False for uid in user_list}

    presence = {}
    for uid, value in zip(user_list, values):
        presence[uid] = value is not None
    return presence
