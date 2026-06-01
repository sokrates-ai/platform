from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Header, HTTPException

from src.services.workspace import judge0 as j0
from src.services.workspace.collab_bridge import try_post_workspace_result
from src.services.workspace.idempotency import Idempotency
from src.services.workspace.jobs import JobsService
from src.services.workspace.rate_limit import Limit, RateLimiter
from src.services.workspace.sessions import get_session_from_redis
from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/code", tags=["workspace-code"])


@router.post("/{workspaceId}/runs")
async def create_quick_run(
    workspaceId: str,
    body: dict,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    runtime = get_workspace_runtime()
    redis = runtime.redis_client
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
        max=runtime.settings.rate_limit_code_run_max,
        windowSec=runtime.settings.rate_limit_code_run_window_sec,
    )
    status = await limiter.check_and_consume(
        "code.run",
        str(session_data.get("user_uuid", "u")),
        workspaceId,
        limit,
    )
    if not status.consumed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded.",
            headers={"Retry-After": str(status.resetSec)},
        )

    jobs = JobsService(redis)
    job = await jobs.create_job(
        "code_run",
        str(session_data.get("user_uuid", "u")),
        workspaceId,
        body or {},
        job_id=(body or {}).get("jobId"),
    )

    async def run() -> None:
        await try_post_workspace_result(
            workspaceId,
            {"jobId": job.id, "progressText": "Starting code run…"},
            context="code_run_progress",
        )

        language_id = body.get("languageId")
        source_code = body.get("source")
        stdin = body.get("stdin")
        if not language_id or source_code is None:
            await jobs.update_job(job.id, "error")
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": "Missing languageId or source"},
                context="code_run_error",
            )
            return

        payload = {
            "language_id": language_id,
            "source_code": source_code,
        }
        if stdin is not None:
            payload["stdin"] = stdin

        try:
            token = await j0.submit_single(payload)
            if not token:
                raise RuntimeError("Judge0 not configured")
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "progressText": "Submitted to Judge0; waiting for result…"},
                context="code_run_progress",
            )
            for _ in range(60):
                await asyncio.sleep(0.5)
                submission = await j0.get_submission(token)
                status_desc = (submission.get("status") or {}).get("description")
                if status_desc and status_desc not in ("In Queue", "Processing"):
                    result = {
                        "token": token,
                        "stdout": submission.get("stdout") or "",
                        "stderr": submission.get("stderr") or "",
                        "compileOutput": submission.get("compile_output"),
                        "time": float(submission.get("time") or 0),
                        "memory": int(submission.get("memory") or 0),
                        "exitCode": int(submission.get("exit_code") or 0),
                        "status": status_desc,
                    }
                    await jobs.update_job(job.id, "done", result)
                    await try_post_workspace_result(
                        workspaceId,
                        {"jobId": job.id, "cellId": "code:run", "value": result},
                        context="code_run_result",
                    )
                    return

            await jobs.update_job(job.id, "error")
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": "Judge0 timeout"},
                context="code_run_error",
            )
        except Exception as exc:
            logger.exception("code_run_failed", extra={"workspaceId": workspaceId, "jobId": job.id})
            await jobs.update_job(job.id, "error")
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": str(exc)},
                context="code_run_error",
            )

    asyncio.create_task(run())
    response = {"jobId": job.id, "streamUrl": None, "rateLimit": status.__dict__}
    if idem is not None:
        await idem.set_response(idempotency_key, response)  # type: ignore[arg-type]
    return response


@router.post("/{workspaceId}/judgements")
async def create_judgement(
    workspaceId: str,
    body: dict,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    runtime = get_workspace_runtime()
    redis = runtime.redis_client
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
        max=runtime.settings.rate_limit_code_judge_max,
        windowSec=runtime.settings.rate_limit_code_judge_window_sec,
    )
    status = await limiter.check_and_consume(
        "code.judge",
        str(session_data.get("user_uuid", "u")),
        workspaceId,
        limit,
    )
    if not status.consumed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded.",
            headers={"Retry-After": str(status.resetSec)},
        )

    jobs = JobsService(redis)
    job = await jobs.create_job(
        "code_judge",
        str(session_data.get("user_uuid", "u")),
        workspaceId,
        body or {},
        job_id=(body or {}).get("jobId"),
    )

    async def run() -> None:
        await try_post_workspace_result(
            workspaceId,
            {"jobId": job.id, "progressText": "Preparing test submissions…"},
            context="code_judge_progress",
        )

        language_id = body.get("languageId")
        source_code = body.get("source")
        tests = body.get("tests") or []
        if not language_id or source_code is None or not isinstance(tests, list) or not tests:
            await jobs.update_job(job.id, "error")
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": "Missing languageId, source, or tests"},
                context="code_judge_error",
            )
            return

        submissions = []
        for test in tests:
            payload = {
                "language_id": language_id,
                "source_code": source_code,
            }
            if test.get("stdin") is not None:
                payload["stdin"] = str(test.get("stdin"))
            if test.get("expected") is not None:
                payload["expected_output"] = str(test.get("expected"))
            submissions.append(payload)

        try:
            tokens = await j0.submit_batch(submissions)
            if not tokens:
                singles: list[str] = []
                for payload in submissions:
                    token = await j0.submit_single(payload)
                    if token:
                        singles.append(token)
                tokens = singles
            if not tokens:
                raise RuntimeError("Judge0 not configured or batch submit failed")

            remaining = set(tokens)
            cases: list[dict] = []

            for _ in range(120):
                await asyncio.sleep(0.5)
                done_now: list[str] = []
                for token in list(remaining):
                    submission = await j0.get_submission(token)
                    status_desc = (submission.get("status") or {}).get("description")
                    if status_desc and status_desc not in ("In Queue", "Processing"):
                        case = {
                            "token": token,
                            "stdout": submission.get("stdout") or "",
                            "stderr": submission.get("stderr") or "",
                            "compileOutput": submission.get("compile_output"),
                            "time": float(submission.get("time") or 0),
                            "memory": int(submission.get("memory") or 0),
                            "exitCode": int(submission.get("exit_code") or 0),
                            "status": status_desc,
                        }
                        expected_output = submission.get("expected_output")
                        if expected_output is not None:
                            case["passed"] = (submission.get("stdout") or "") == expected_output
                        cases.append(case)
                        done_now.append(token)
                for token in done_now:
                    remaining.discard(token)
                if not remaining:
                    break

            result = {
                "cases": cases,
                "aggregate": {
                    "passedCount": sum(1 for case in cases if case.get("passed")),
                    "total": len(cases),
                },
            }
            await jobs.update_job(job.id, "done", result)
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "cellId": "code:judge", "value": result},
                context="code_judge_result",
            )
        except Exception as exc:
            logger.exception("code_judge_failed", extra={"workspaceId": workspaceId, "jobId": job.id})
            await jobs.update_job(job.id, "error")
            await try_post_workspace_result(
                workspaceId,
                {"jobId": job.id, "error": str(exc)},
                context="code_judge_error",
            )

    asyncio.create_task(run())
    response = {"jobId": job.id, "streamUrl": None, "rateLimit": status.__dict__}
    if idem is not None:
        await idem.set_response(idempotency_key, response)  # type: ignore[arg-type]
    return response
