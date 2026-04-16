from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import WebSocket


class NotificationManager:
    def __init__(self, ping_interval_seconds: int = 25) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._send_locks: dict[WebSocket, asyncio.Lock] = {}
        self._lock = asyncio.Lock()
        self._ping_interval_seconds = ping_interval_seconds
        self._ping_task: asyncio.Task | None = None
        self._logger = logging.getLogger(__name__)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)
            self._send_locks.setdefault(websocket, asyncio.Lock())
        self._logger.info("WebSocket connected", extra={"user_id": user_id})

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(user_id)
            if sockets and websocket in sockets:
                sockets.remove(websocket)
                if not sockets:
                    self._connections.pop(user_id, None)
            self._send_locks.pop(websocket, None)
        try:
            await websocket.close()
        except Exception:
            pass
        self._logger.info("WebSocket disconnected", extra={"user_id": user_id})

    async def send_to_user(self, user_id: int, message: Dict[str, Any]) -> None:
        sockets = await self._get_sockets(user_id)
        for socket in sockets:
            await self._safe_send(user_id, socket, message)

    async def send_direct(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        lock = self._send_locks.get(websocket)
        if lock is None:
            return
        try:
            async with lock:
                await websocket.send_json(message)
        except Exception:
            pass

    async def broadcast(self, message: Dict[str, Any]) -> None:
        async with self._lock:
            items = [(user_id, list(sockets)) for user_id, sockets in self._connections.items()]
        for user_id, sockets in items:
            for socket in sockets:
                await self._safe_send(user_id, socket, message)

    def start(self) -> None:
        if self._ping_task is None:
            self._ping_task = asyncio.create_task(self._ping_loop())

    async def stop(self) -> None:
        if self._ping_task is not None:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
            self._ping_task = None

    async def _get_sockets(self, user_id: int) -> list[WebSocket]:
        async with self._lock:
            return list(self._connections.get(user_id, set()))

    async def _safe_send(
        self,
        user_id: int,
        websocket: WebSocket,
        message: Dict[str, Any],
    ) -> None:
        lock = self._send_locks.get(websocket)
        if lock is None:
            return
        try:
            async with lock:
                await websocket.send_json(message)
        except Exception as exc:
            self._logger.warning(
                "WebSocket send failed",
                extra={"user_id": user_id, "error": str(exc)},
            )
            await self.disconnect(user_id, websocket)

    async def _ping_loop(self) -> None:
        while True:
            await asyncio.sleep(self._ping_interval_seconds)
            async with self._lock:
                has_connections = bool(self._connections)
            if not has_connections:
                continue
            message = {
                "type": "ping",
                "timestamp": f"{datetime.utcnow().isoformat()}Z",
            }
            await self.broadcast(message)
