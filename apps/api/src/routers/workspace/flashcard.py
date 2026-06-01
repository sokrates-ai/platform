from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.services.workspace.progression import record_workspace_solution
from src.services.workspace.rate_limit import Limit, RateLimiter
from src.services.workspace.sessions import get_session_from_redis
from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flashcard", tags=["workspace-flashcard"])


@router.post("/{workspaceId}/steps/{stepId}/validate")
async def validate_step(
    workspaceId: str,
    stepId: str,
    body: dict,
    request: Request,
    db_session: Session = Depends(get_db_session),
):
    runtime = get_workspace_runtime()
    redis = runtime.redis_client
    if redis is None:
        raise HTTPException(status_code=500, detail="Workspace Redis is not configured.")

    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")

    limiter = RateLimiter(redis)
    limit = Limit(
        max=runtime.settings.rate_limit_flashcard_validate_max,
        windowSec=runtime.settings.rate_limit_flashcard_validate_window_sec,
    )

    user_id = str(session_data.get("user_uuid", "u"))
    bypass_key = f"workspace:rl:flashcard:bypass:{user_id}:{workspaceId}"
    bypass = await redis.get(bypass_key)
    status = None
    if not bypass:
        status = await limiter.check_and_consume(
            "flashcard.validate",
            user_id,
            workspaceId,
            limit,
        )
        if not status.consumed:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded.",
                headers={"Retry-After": str(status.resetSec)},
            )
    else:
        await redis.delete(bypass_key)

    spec = session_data.get("workspaceSpec") or {}
    questions = spec.get("questions") or []
    if not isinstance(questions, list):
        raise HTTPException(status_code=400, detail="No questions defined for this workspace.")

    item = next((question for question in questions if question.get("id") == stepId), None)
    if not item:
        raise HTTPException(status_code=404, detail="Question not found")

    item_type = item.get("type") or ("multiple_choice" if item.get("options") else "constrained_input")
    answer = (body or {}).get("answer")
    correct = False

    if item_type == "multiple_choice":
        expected = set(item.get("correct") or [])
        submitted = set(answer) if isinstance(answer, list) else {answer}
        correct = submitted == expected
    elif item_type == "constrained_input":
        input_type = item.get("inputType", "text")
        expected = item.get("correct")
        if input_type == "number":
            try:
                correct = float(answer) == float(expected)
            except Exception:
                correct = False
        else:
            correct = str(answer).strip() == str(expected).strip()
    else:
        raise HTTPException(status_code=400, detail="Unsupported question type")

    if runtime.history_manager is not None:
        await runtime.history_manager.add_quiz_attempt_history(
            token=workspaceId,
            step_id=stepId,
            answer=answer,
            correct=bool(correct),
        )

    if correct:
        await redis.setex(bypass_key, 30, "1")

    if questions and questions[-1].get("id") == stepId and correct:
        await record_workspace_solution(
            request,
            db_session,
            correct=True,
            task_id=int(session_data["exercise_id"]),
            activity_uuid=str(session_data["activity_uuid"]),
            user_uuid=str(session_data["user_uuid"]),
        )

    remaining = 1 if bypass else (status.remaining if status is not None else limit.max)
    reset_sec = 0 if correct else (status.resetSec if status is not None else limit.windowSec)
    return {
        "correct": bool(correct),
        "rateLimit": {
            "remaining": remaining,
            "resetSec": reset_sec,
            "limit": {"max": limit.max, "windowSec": limit.windowSec},
        },
    }
