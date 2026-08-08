from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.services.workspace.jobs import JobsService
from src.services.workspace.progression import record_workspace_solution
from src.services.workspace.sessions import get_session_from_redis, save_session_to_redis
from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("/{workspaceId}")
async def get_workspace(workspaceId: str):
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")

    return {
        "id": workspaceId,
        "type": session_data.get("workspaceType", "text"),
        "spec": session_data.get("workspaceSpec"),
        "exercise": session_data.get("exercise"),
    }


@router.put("/{workspaceId}/state")
async def save_workspace_state(workspaceId: str, body: dict):
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")

    session_data["workspaceContent"] = (body or {}).get("content") or (body or {}).get(
        "workspaceContentState", ""
    )
    await save_session_to_redis(workspaceId, session_data)
    return {"message": "Workspace updated"}


@router.get("/{workspaceId}/state")
async def get_workspace_state(workspaceId: str):
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")
    return {"content": session_data.get("workspaceContent", "")}


@router.get("/{workspaceId}/jobs/{jobId}")
async def get_workspace_job(workspaceId: str, jobId: str):
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")

    runtime = get_workspace_runtime()
    redis = runtime.redis_client
    if redis is None:
        raise HTTPException(status_code=500, detail="Workspace Redis is not configured.")

    job = await JobsService(redis).get_job(jobId)
    if not job or str(job.get("workspaceId") or "") != workspaceId:
        raise HTTPException(status_code=404, detail="Job not found.")

    return job


@router.post("/{workspaceId}/complete")
async def complete_workspace(
    workspaceId: str,
    request: Request,
    body: dict | None = None,
    db_session: Session = Depends(get_db_session),
):
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")

    correct = bool((body or {}).get("correct", True))
    try:
        await record_workspace_solution(
            request,
            db_session,
            correct=correct,
            task_id=int(session_data["exercise_id"]),
            activity_uuid=str(session_data["activity_uuid"]),
            user_uuid=str(session_data["user_uuid"]),
        )
        session_data["lastCompletionAt"] = datetime.now(timezone.utc).isoformat()
        await save_session_to_redis(workspaceId, session_data)
    except Exception as exc:
        logger.warning("complete_workspace_failed", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Completion could not be recorded. Please try again.",
        ) from exc

    return {"message": "Completion recorded", "correct": correct}


@router.post("/{workspaceId}/token")
async def issue_collab_token(workspaceId: str):
    runtime = get_workspace_runtime()
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session token")

    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=runtime.settings.jwt_ttl_min)
    claims = {
        "sub": session_data.get("user_uuid", "unknown-user"),
        "workspaceId": workspaceId,
        "role": "editor",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    collab_jwt = jwt.encode(
        claims,
        runtime.settings.collab_jwt_secret,
        algorithm="HS256",
    )
    return {"token": collab_jwt}


@router.get("/{workspaceId}/history")
async def get_history(workspaceId: str, limit: int | None = None):
    runtime = get_workspace_runtime()
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session token not found.")
    if runtime.history_manager is None:
        return {"history": []}
    history = await runtime.history_manager.get_user_history(workspaceId, limit)
    return {"history": history}
