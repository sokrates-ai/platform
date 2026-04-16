from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlmodel import Session, select

from src.core.events.database import engine
from src.db.users import User
from src.security.security import ALGORITHM, SECRET_KEY
from src.services.notifications.models import build_system_event
from src.services.notifications.service import manager


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

    await manager.connect(user.id, websocket)
    await manager.send_direct(
        websocket,
        build_system_event(
            event="connected",
            data={"user_id": user.id, "user_uuid": user.user_uuid},
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
    except WebSocketDisconnect:
        await manager.disconnect(user.id, websocket)
    except Exception:
        await manager.disconnect(user.id, websocket)
        raise
