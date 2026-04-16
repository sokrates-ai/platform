from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional
from uuid import uuid4

from redis.asyncio import Redis

from config.config import get_learnhouse_config
from src.services.notifications.manager import NotificationManager


class RedisNotificationBroker:
    def __init__(self, channel: str = "notifications") -> None:
        self._channel = channel
        self._instance_id = uuid4().hex
        self._redis: Optional[Redis] = None
        self._pubsub = None
        self._task: asyncio.Task | None = None
        self._logger = logging.getLogger(__name__)

    @property
    def enabled(self) -> bool:
        return self._redis is not None

    async def start(self, manager: NotificationManager) -> None:
        conn_string = get_learnhouse_config().redis_config.redis_connection_string
        if not conn_string:
            self._logger.info("Redis not configured; notifications will be local-only")
            return

        try:
            self._redis = Redis.from_url(conn_string, decode_responses=True)
            self._pubsub = self._redis.pubsub()
            await self._pubsub.subscribe(self._channel)
            self._task = asyncio.create_task(self._reader(manager))
            self._logger.info("Redis notification broker started")
        except Exception as exc:
            self._logger.warning(
                "Failed to start Redis notification broker",
                extra={"error": str(exc)},
            )
            self._redis = None
            self._pubsub = None

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self._pubsub is not None:
            try:
                await self._pubsub.unsubscribe(self._channel)
                await self._pubsub.close()
            except Exception:
                pass
            self._pubsub = None

        if self._redis is not None:
            try:
                await self._redis.close()
            except Exception:
                pass
            self._redis = None

    async def publish(self, user_id: int | str | None, message: Dict[str, Any]) -> None:
        if not self._redis:
            return

        payload = {
            "instance_id": self._instance_id,
            "user_id": user_id,
            "message": message,
        }
        try:
            await self._redis.publish(self._channel, json.dumps(payload))
        except Exception as exc:
            self._logger.warning(
                "Failed to publish notification",
                extra={"error": str(exc)},
            )

    async def _reader(self, manager: NotificationManager) -> None:
        if not self._pubsub:
            return

        async for raw in self._pubsub.listen():
            if raw is None or raw.get("type") != "message":
                continue

            data = raw.get("data")
            try:
                payload = json.loads(data)
            except Exception:
                continue

            if payload.get("instance_id") == self._instance_id:
                continue

            message = payload.get("message")
            if not isinstance(message, dict):
                continue

            user_id = payload.get("user_id")
            if user_id == "all":
                await manager.broadcast(message)
            elif user_id is None:
                continue
            else:
                try:
                    await manager.send_to_user(int(user_id), message)
                except Exception:
                    continue
