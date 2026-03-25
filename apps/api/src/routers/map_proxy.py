import hashlib
import logging
import ssl
from io import BytesIO
from typing import Optional, Tuple

import httpx
import redis
from fastapi import APIRouter, HTTPException, Query, Response

from config.config import get_learnhouse_config

try:
    from PIL import Image
except Exception:  # pragma: no cover - optional dependency
    Image = None

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


def _cache_key_for_url(url: str, format: Optional[str]) -> str:
    cache_identity = url if not format else f"{url}|format={format}"
    digest = hashlib.sha256(cache_identity.encode("utf-8")).hexdigest()
    return f"{CACHE_NAMESPACE}:{digest}"


async def _fetch_upstream(url: str, *, verify: bool) -> httpx.Response:
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=HTTP_TIMEOUT,
        verify=verify,
    ) as client:
        return await client.get(url)


def _is_ssl_error(error: httpx.HTTPError) -> bool:
    message = str(error).lower()
    if "certificate verify failed" in message or "ssl" in message:
        return True

    current: Optional[BaseException] = error
    while current:
        if isinstance(current, ssl.SSLError):
            return True
        current = current.__cause__  # type: ignore[attr-defined]
    return False


async def _handle_proxy_request(
    url: str,
    *,
    format: Optional[str] = None,
) -> Response:
    sanitized_url = url.strip()
    if not sanitized_url:
        raise HTTPException(status_code=400, detail="Query parameter 'url' is required.")

    if not sanitized_url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Only http(s) URLs can be proxied.")

    cache_key = _cache_key_for_url(sanitized_url, format)
    redis_client = _get_redis_client()

    def _convert_gif(payload: bytes, target_format: str) -> Tuple[bytes, str]:
        if Image is None:
            LOGGER.warning("GIF conversion requested but Pillow is not installed.")
            return payload, content_type
        try:
            with Image.open(BytesIO(payload)) as img:
                if getattr(img, "is_animated", False):
                    img.seek(0)
                converted = img.convert("RGBA")
                output = BytesIO()
                if target_format == "webp":
                    converted.save(output, format="WEBP")
                    return output.getvalue(), "image/webp"
                converted.save(output, format="PNG")
                return output.getvalue(), "image/png"
        except Exception:
            LOGGER.exception("Failed to convert GIF for %s.", sanitized_url)
            return payload, content_type

    requested_format = (format or "").strip().lower() or None
    is_gif_request = sanitized_url.lower().split("?")[0].endswith(".gif")

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
            cached_is_gif = "image/gif" in (content_type or "").lower() or is_gif_request
            if cached_is_gif and requested_format in (None, "png", "webp"):
                target_format = requested_format or "png"
                body, content_type = _convert_gif(body, target_format)
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
                        LOGGER.exception("Unable to update cached course map asset for key %s.", cache_key)
            response = Response(content=body, media_type=content_type or "application/octet-stream")
            response.headers["X-Proxy-Cache"] = "HIT"
            return response

    insecure_fetch_used = False

    try:
        upstream_response = await _fetch_upstream(sanitized_url, verify=True)
    except httpx.HTTPError as exc:
        if _is_ssl_error(exc):
            LOGGER.warning(
                "Failed to fetch upstream asset over HTTPS with verification for %s: %s. Retrying without verification.",
                sanitized_url,
                exc,
            )
            try:
                upstream_response = await _fetch_upstream(sanitized_url, verify=False)
                insecure_fetch_used = True
            except httpx.HTTPError as insecure_exc:
                LOGGER.warning(
                    "Failed to fetch upstream asset even without SSL verification for %s: %s",
                    sanitized_url,
                    insecure_exc,
                )
                raise HTTPException(status_code=502, detail="Failed to fetch asset from remote server.") from insecure_exc
        else:
            LOGGER.warning("Failed to fetch upstream asset for %s: %s", sanitized_url, exc)
            raise HTTPException(status_code=502, detail="Failed to fetch asset from remote server.") from exc

    if upstream_response.status_code >= 400:
        raise HTTPException(
            status_code=upstream_response.status_code,
            detail=f"Upstream server returned status {upstream_response.status_code}.",
        )

    body = upstream_response.content
    content_type = upstream_response.headers.get("content-type") or "application/octet-stream"

    is_gif = "image/gif" in content_type.lower() or is_gif_request

    if is_gif and (requested_format in (None, "png", "webp")):
        target_format = requested_format or "png"
        body, content_type = _convert_gif(body, target_format)
        if content_type in ("image/png", "image/webp"):
            LOGGER.info(
                "Converted GIF to %s for %s.",
                content_type.split("/")[-1],
                sanitized_url,
            )

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
    if insecure_fetch_used:
        response.headers["X-Proxy-Insecure-Fetch"] = "1"
    return response


@router.get("")
async def proxy_course_map_asset(
    url: str = Query(..., description="Publicly accessible image URL to proxy for the course map."),
    format: Optional[str] = Query(None, description="Optional output format (e.g. png)."),
):
    return await _handle_proxy_request(url, format=format)


@router.get("/{_filename:path}")
async def proxy_course_map_asset_with_filename(
    _filename: str,
    url: str = Query(..., description="Publicly accessible image URL to proxy for the course map."),
    format: Optional[str] = Query(None, description="Optional output format (e.g. png)."),
):
    return await _handle_proxy_request(url, format=format)
