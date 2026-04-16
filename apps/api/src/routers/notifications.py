from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi_jwt_auth import AuthJWT
from jose import JWTError, jwt
from sqlmodel import Session, select

from src.core.events.database import engine, get_db_session
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.security.security import ALGORITHM, SECRET_KEY
from src.services.notifications.models import NotificationLevel, build_notification, build_system_event
from src.services.notifications.service import manager, notify_all
from pydantic import BaseModel


router = APIRouter()


def _extract_token(websocket: WebSocket) -> Optional[str]:
    token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    if token:
        return token

    auth_header = websocket.headers.get("authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]

    cookie_token = websocket.cookies.get("access_token_cookie")
    if cookie_token:
        return cookie_token

    return None


def _get_user_from_token(token: str) -> Optional[User]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    email = payload.get("sub")
    if not email:
        return None

    with Session(engine) as db_session:
        statement = select(User).where(User.email == email)
        user = db_session.exec(statement).first()

    return user


def _parse_topics(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class NotificationBroadcastRequest(BaseModel):
    topic: str = "broadcast"
    title: str
    body: str
    level: NotificationLevel = "info"
    data: Optional[dict] = None


@router.post("/broadcast")
async def broadcast_notification(
    body: NotificationBroadcastRequest,
    Authorize: AuthJWT = Depends(),
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    Authorize.jwt_required()

    roles = db_session.exec(
        select(UserOrganization.role_id).where(UserOrganization.user_id == current_user.id)
    ).all()
    if not any(role_id == 1 for role_id in roles):
        raise HTTPException(status_code=403, detail="Admin privileges required.")

    message = build_notification(
        topic=body.topic.strip() or "broadcast",
        title=body.title,
        body=body.body,
        level=body.level,
        data=body.data,
    )
    await notify_all(message)
    return {"status": "sent"}


@router.websocket("/ws")
async def websocket_notifications(websocket: WebSocket):
    token = _extract_token(websocket)
    if not token:
        await websocket.close(code=4401)
        return

    user = _get_user_from_token(token)
    if not user:
        await websocket.close(code=4401)
        return

    topics = _parse_topics(websocket.query_params.get("topics"))
    initial_topics = topics or ["broadcast"]
    await manager.connect(user.id, websocket, topics=initial_topics)
    await manager.send_direct(
        websocket,
        build_system_event(
            event="connected",
            data={
                "user_id": user.id,
                "user_uuid": user.user_uuid,
                "topics": initial_topics,
            },
        ),
    )

    try:
        while True:
            message = await websocket.receive_text()
            try:
                payload = json.loads(message)
            except Exception:
                continue

            if payload.get("type") == "ping":
                await manager.send_direct(
                    websocket,
                    {
                        "type": "pong",
                        "timestamp": f"{datetime.utcnow().isoformat()}Z",
                    },
                )
            elif payload.get("type") == "subscribe":
                topics = payload.get("topics") if isinstance(payload.get("topics"), list) else []
                await manager.add_subscriptions(websocket, topics)
            elif payload.get("type") == "unsubscribe":
                topics = payload.get("topics") if isinstance(payload.get("topics"), list) else []
                await manager.remove_subscriptions(websocket, topics)
            elif payload.get("type") == "set_subscriptions":
                topics = payload.get("topics") if isinstance(payload.get("topics"), list) else []
                await manager.set_subscriptions(websocket, topics)
    except WebSocketDisconnect:
        await manager.disconnect(user.id, websocket)
    except Exception:
        await manager.disconnect(user.id, websocket)
        raise
