import hashlib
import logging
from typing import Optional

import httpx
import redis
from fastapi import APIRouter, HTTPException, Query, Response

from config.config import get_learnhouse_config

router = APIRouter()

LOGGER = logging.getLogger(__name__)

CACHE_NAMESPACE = "course-map-proxy"
CACHE_TTL_SECONDS = 60 * 60  # 1 hour
HTTP_TIMEOUT = httpx.Timeout(20.0, connect=5.0, read=20.0)

_redis_client: Optional[redis.Redis] = None
_redis_unavailable = False


def _get_redis_client() -> Optional[redis.Redis]:
    global _redis_client, _redis_unavailable
    if _redis_client is not None:
        return _redis_client
    if _redis_unavailable:
        return None

    conn_string = get_learnhouse_config().redis_config.redis_connection_string
    if not conn_string:
        if not _redis_unavailable:
            LOGGER.warning("Map proxy requested but Redis connection string is not configured.")
        _redis_unavailable = True
        return None

    try:
        _redis_client = redis.Redis.from_url(conn_string)
    except redis.RedisError:
        LOGGER.exception("Failed to connect to Redis for map proxy caching.")
        _redis_client = None
        _redis_unavailable = True
    return _redis_client


def _cache_key_for_url(url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return f"{CACHE_NAMESPACE}:{digest}"


@router.get("")
async def proxy_course_map_asset(
    url: str = Query(..., description="Publicly accessible image URL to proxy for the course map."),
):
    sanitized_url = url.strip()
    if not sanitized_url:
        raise HTTPException(status_code=400, detail="Query parameter 'url' is required.")

    if not sanitized_url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Only http(s) URLs can be proxied.")

    cache_key = _cache_key_for_url(sanitized_url)
    redis_client = _get_redis_client()

    if redis_client:
        try:
            cached_entry = redis_client.hgetall(cache_key)
        except redis.RedisError:
            LOGGER.exception("Unable to read cached course map asset for key %s.", cache_key)
            cached_entry = {}

        if cached_entry and b"body" in cached_entry:
            body = cached_entry.get(b"body", b"")
            content_type_value = cached_entry.get(b"content_type", b"application/octet-stream")
            content_type = (
                content_type_value.decode("utf-8") if isinstance(content_type_value, bytes) else content_type_value
            )
            response = Response(content=body, media_type=content_type or "application/octet-stream")
            response.headers["X-Proxy-Cache"] = "HIT"
            return response

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=HTTP_TIMEOUT) as client:
            upstream_response = await client.get(sanitized_url)
    except httpx.HTTPError as exc:
        LOGGER.warning("Failed to fetch upstream asset for %s: %s", sanitized_url, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch asset from remote server.") from exc

    if upstream_response.status_code >= 400:
        raise HTTPException(
            status_code=upstream_response.status_code,
            detail=f"Upstream server returned status {upstream_response.status_code}.",
        )

    body = upstream_response.content
    content_type = upstream_response.headers.get("content-type") or "application/octet-stream"

    if redis_client and body:
        try:
            redis_client.hset(
                cache_key,
                mapping={
                    "body": body,
                    "content_type": content_type,
                },
            )
            redis_client.expire(cache_key, CACHE_TTL_SECONDS)
        except redis.RedisError:
            LOGGER.exception("Unable to cache course map asset for key %s.", cache_key)

    response = Response(content=body, media_type=content_type)
    response.headers["X-Proxy-Cache"] = "MISS"
    return response
