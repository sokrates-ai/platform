from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from src.services.workspace.judge0 import fetch_languages
from src.services.workspace.rate_limit import Limit, RateLimiter
from src.services.workspace.sessions import get_session_from_redis
from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

router = APIRouter(tags=["workspace-system"])


@router.get("/analytics")
async def get_analytics_config():
    runtime = get_workspace_runtime()
    return {
        "host": runtime.settings.analytics_host,
        "token": runtime.settings.analytics_api_key,
        "api_token": runtime.settings.analytics_api_key,
    }


@router.get("/rate-limit")
async def get_rate_limit(kind: str, workspaceId: str):
    runtime = get_workspace_runtime()
    redis = runtime.redis_client
    if redis is None:
        raise HTTPException(status_code=500, detail="Workspace Redis is not configured.")

    session = await get_session_from_redis(workspaceId)
    if not session:
        raise HTTPException(status_code=401, detail="Session token not found.")

    limiter = RateLimiter(redis)
    if kind == "text.eval":
        limit = Limit(
            max=runtime.settings.rate_limit_text_eval_max,
            windowSec=runtime.settings.rate_limit_text_eval_window_sec,
        )
    elif kind == "code.run":
        limit = Limit(
            max=runtime.settings.rate_limit_code_run_max,
            windowSec=runtime.settings.rate_limit_code_run_window_sec,
        )
    elif kind == "code.judge":
        limit = Limit(
            max=runtime.settings.rate_limit_code_judge_max,
            windowSec=runtime.settings.rate_limit_code_judge_window_sec,
        )
    elif kind == "flashcard.validate":
        limit = Limit(
            max=runtime.settings.rate_limit_flashcard_validate_max,
            windowSec=runtime.settings.rate_limit_flashcard_validate_window_sec,
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported rate limit kind")

    user_id = str(session.get("user_uuid", "u"))
    if kind == "flashcard.validate":
        bypass_key = f"workspace:rl:flashcard:bypass:{user_id}:{workspaceId}"
        bypass = await redis.get(bypass_key)
        if bypass:
            return {
                "remaining": 0,
                "resetSec": 0,
                "limit": {"max": limit.max, "windowSec": limit.windowSec},
            }

    status = await limiter.status(kind, user_id, workspaceId, limit)
    return {
        "remaining": status.remaining,
        "resetSec": status.resetSec,
        "limit": {"max": limit.max, "windowSec": limit.windowSec},
    }


@router.get("/languages")
async def get_languages():
    runtime = get_workspace_runtime()
    if runtime.redis_client is None:
        return []
    return await fetch_languages(runtime.redis_client)
