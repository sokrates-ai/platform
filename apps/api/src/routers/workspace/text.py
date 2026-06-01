from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.services.workspace.collab_bridge import try_post_workspace_result
from src.services.workspace.idempotency import Idempotency
from src.services.workspace.jobs import JobsService
from src.services.workspace.progression import record_workspace_solution
from src.services.workspace.rate_limit import Limit, RateLimiter
from src.services.workspace.sessions import get_session_from_redis
from src.services.workspace.state import get_workspace_runtime
from src.services.workspace.text_eval import (
    TextEvaluationUnavailable,
    evaluate_text_submission,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/text", tags=["workspace-text"])


def _text_error_payload(message: str) -> dict:
    return {
        "status": "error",
        "summary": "AI feedback is temporarily unavailable.",
        "message": message,
        "is_valid": False,
        "comments": [],
    }


@router.post("/{workspaceId}/jobs")
async def create_text_job(
    workspaceId: str,
    body: dict,
    request: Request,
    db_session: Session = Depends(get_db_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    runtime = get_workspace_runtime()
    redis = runtime.redis_client
    history = runtime.history_manager
    if redis is None:
        raise HTTPException(status_code=500, detail="Workspace Redis is not configured.")

    idem = Idempotency(redis) if idempotency_key else None
    if idem is not None:
        cached = await idem.get_response(idempotency_key)  # type: ignore[arg-type]
        if cached:
            return cached

    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")

    limiter = RateLimiter(redis)
    limit = Limit(
        max=runtime.settings.rate_limit_text_eval_max,
        windowSec=runtime.settings.rate_limit_text_eval_window_sec,
    )
    status = await limiter.check_and_consume(
        "text.eval",
        str(session_data.get("user_uuid", "u")),
        workspaceId,
        limit,
    )
    if not status.consumed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Please wait {status.resetSec} seconds.",
            headers={"Retry-After": str(status.resetSec)},
        )

    jobs = JobsService(redis)
    payload = {"submission": (body or {}).get("submission", "")}
    job = await jobs.create_job(
        "text_eval",
        str(session_data.get("user_uuid", "u")),
        workspaceId,
        payload,
        job_id=(body or {}).get("jobId"),
    )

    async def run() -> None:
        await try_post_workspace_result(
            workspaceId,
            {"jobId": job.id, "progressText": "Evaluation started"},
            context="text_progress",
        )
        start_time = time.time()
        try:
            exercise = session_data.get("exercise") or {}
            feedback = await evaluate_text_submission(
                exercise,
                payload["submission"],
                runtime.settings.text_eval_model,
            )
            processing_time = time.time() - start_time

            try:
                await record_workspace_solution(
                    request,
                    db_session,
                    correct=bool(feedback.get("is_valid")),
                    task_id=int(session_data["exercise_id"]),
                    activity_uuid=str(session_data["activity_uuid"]),
                    user_uuid=str(session_data["user_uuid"]),
                )
            except Exception:
                logger.warning("record_solution_failed", exc_info=True)

            await jobs.update_job(job.id, "done", result=feedback)
            if history is not None:
                await history.add_evaluation_history(
                    token=workspaceId,
                    submission=payload["submission"],
                    exercise_id=str(exercise.get("id") or session_data["exercise_id"]),
                    feedback=feedback,
                    processing_time=processing_time,
                )
            await try_post_workspace_result(
                workspaceId,
                {
                    "jobId": job.id,
                    "cellId": "text:feedback",
                    "value": feedback,
                },
                context="text_result",
            )
        except TextEvaluationUnavailable as exc:
            logger.warning(
                "text_job_evaluation_unavailable",
                extra={"workspaceId": workspaceId, "jobId": job.id},
            )
            error_payload = _text_error_payload(exc.user_message)
            await jobs.update_job(job.id, "error", result=error_payload)
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": exc.user_message},
                context="text_error",
            )
            await try_post_workspace_result(
                workspaceId,
                {
                    "jobId": job.id,
                    "cellId": "text:feedback",
                    "value": error_payload,
                },
                context="text_error_result",
            )
        except Exception:
            logger.exception("text_job_failed", extra={"workspaceId": workspaceId, "jobId": job.id})
            learner_message = (
                "Feedback could not be generated right now. Your draft is still saved. Please try again in a moment."
            )
            error_payload = _text_error_payload(learner_message)
            await jobs.update_job(job.id, "error", result=error_payload)
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": learner_message},
                context="text_error",
            )
            await try_post_workspace_result(
                workspaceId,
                {
                    "jobId": job.id,
                    "cellId": "text:feedback",
                    "value": error_payload,
                },
                context="text_error_result",
            )

    asyncio.create_task(run())
    response = {"jobId": job.id, "streamUrl": None, "rateLimit": status.__dict__}
    if idem is not None:
        await idem.set_response(idempotency_key, response)  # type: ignore[arg-type]
    return response
