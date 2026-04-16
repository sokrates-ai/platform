from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

NotificationLevel = Literal["info", "success", "warning", "error"]


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    topic: str = "broadcast"
    title: str
    body: str
    level: NotificationLevel = "info"
    data: Optional[Dict[str, Any]] = None
    timestamp: str = Field(
        default_factory=lambda: f"{datetime.utcnow().isoformat()}Z"
    )


class NotificationEnvelope(BaseModel):
    type: Literal["notification"] = "notification"
    notification: Notification


class SystemEnvelope(BaseModel):
    type: Literal["system"] = "system"
    event: str
    timestamp: str = Field(
        default_factory=lambda: f"{datetime.utcnow().isoformat()}Z"
    )
    data: Optional[Dict[str, Any]] = None


def build_notification(
    *,
    topic: str = "broadcast",
    title: str,
    body: str,
    level: NotificationLevel = "info",
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    notification = Notification(
        topic=topic,
        title=title,
        body=body,
        level=level,
        data=data,
    )
    return NotificationEnvelope(notification=notification).dict()


def build_system_event(
    *,
    event: str,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return SystemEnvelope(event=event, data=data).dict()
