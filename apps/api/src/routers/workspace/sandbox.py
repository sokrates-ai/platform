from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.workspace.rate_limit import Limit, RateLimiter
from src.services.workspace.state import get_workspace_runtime
from src.services.workspace.text_eval import (
    TextEvaluationUnavailable,
    evaluate_sandbox_submission,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sandbox", tags=["workspace-sandbox"])


class SandboxCheckRequest(BaseModel):
    problem: str = Field(default="")
    solution: str = Field(default="")
    rubric: str = Field(default="")


@router.post("/check")
async def check_sandbox_submission(
    body: SandboxCheckRequest,
    current_user: PublicUser | AnonymousUser = Depends(get_current_user),
):
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required.")

    if not body.problem.strip() or not body.solution.strip():
        raise HTTPException(
            status_code=422,
            detail="Both a problem statement and a solution are required.",
        )

    runtime = get_workspace_runtime()
    redis = runtime.redis_client
    if redis is not None:
        limiter = RateLimiter(redis)
        limit = Limit(
            max=runtime.settings.rate_limit_text_eval_max,
            windowSec=runtime.settings.rate_limit_text_eval_window_sec,
        )
        status_obj = await limiter.check_and_consume(
            "sandbox.check",
            str(current_user.user_uuid),
            "sandbox",
            limit,
        )
        if not status_obj.consumed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Please wait {status_obj.resetSec} seconds.",
                headers={"Retry-After": str(status_obj.resetSec)},
            )

    try:
        feedback = await evaluate_sandbox_submission(
            problem=body.problem,
            solution=body.solution,
            rubric=body.rubric,
            model=runtime.settings.text_eval_model,
        )
    except TextEvaluationUnavailable as exc:
        logger.warning("sandbox_evaluation_unavailable", exc_info=True)
        raise HTTPException(status_code=503, detail=exc.user_message) from exc

    return feedback
