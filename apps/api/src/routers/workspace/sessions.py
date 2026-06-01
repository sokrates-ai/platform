from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.workspace.sessions import (
    create_or_get_session,
    get_session_from_redis,
    get_user_stats,
    refresh_all_sessions,
)


router = APIRouter(tags=["workspace-sessions"])


class SessionRequest(BaseModel):
    activity_uuid: str
    exercise_id: int
    workspace_type: Optional[Literal["text", "flashcard", "code", "qa", "mcq"]] = None
    workspace_spec: Optional[Dict[str, Any]] = None


@router.post("/sessions")
async def create_workspace_session(
    body: SessionRequest,
    current_user: PublicUser | AnonymousUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = await create_or_get_session(
        db_session,
        user_uuid=current_user.user_uuid,
        activity_uuid=body.activity_uuid,
        exercise_id=body.exercise_id,
        workspace_type=body.workspace_type,
        workspace_spec=body.workspace_spec,
    )
    return {"token": token}


@router.post("/sessions/refresh")
async def refresh_workspace_sessions(
    current_user: PublicUser | AnonymousUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await refresh_all_sessions(db_session)


@router.get("/sessions/{token}/stats")
async def get_workspace_user_stats(
    request: Request,
    token: str,
    db_session: Session = Depends(get_db_session),
):
    session = await get_session_from_redis(token)
    if not session:
        raise HTTPException(status_code=404, detail="Session token not found.")

    stats = await get_user_stats(request, db_session, token)
    if not stats:
        raise HTTPException(status_code=404, detail="User stats unavailable.")
    return stats
