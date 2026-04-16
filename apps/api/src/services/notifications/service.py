from __future__ import annotations

from typing import Any, Dict, Iterable

from fastapi import FastAPI

from src.services.notifications.broker import RedisNotificationBroker
from src.services.notifications.manager import NotificationManager
from src.services.notifications.models import build_notification, build_system_event


manager = NotificationManager()
broker = RedisNotificationBroker()


async def start_notifications(app: FastAPI) -> None:
    manager.start()
    await broker.start(manager)
    app.notification_manager = manager  # type: ignore[attr-defined]
    app.notification_broker = broker  # type: ignore[attr-defined]


async def stop_notifications(app: FastAPI) -> None:
    await broker.stop()
    await manager.stop()
    app.notification_manager = None  # type: ignore[attr-defined]
    app.notification_broker = None  # type: ignore[attr-defined]


async def notify_user(user_id: int, message: Dict[str, Any]) -> None:
    await manager.send_to_user(user_id, message)
    await broker.publish(user_id, message)


async def notify_users(user_ids: Iterable[int], message: Dict[str, Any]) -> None:
    for user_id in user_ids:
        await notify_user(user_id, message)


async def notify_all(message: Dict[str, Any]) -> None:
    await manager.broadcast(message)
    await broker.publish("all", message)


__all__ = [
    "build_notification",
    "build_system_event",
    "notify_all",
    "notify_user",
    "notify_users",
    "start_notifications",
    "stop_notifications",
]
