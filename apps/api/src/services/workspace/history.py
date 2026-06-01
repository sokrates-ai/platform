from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis


class HistoryManager:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.history_key_prefix = "workspace:history:"
        self.max_history_items = 100

    def _history_key(self, token: str) -> str:
        return f"{self.history_key_prefix}{token}"

    async def _push(self, token: str, item: dict[str, Any]) -> None:
        history_key = self._history_key(token)
        await self.redis.lpush(history_key, json.dumps(item))
        await self.redis.ltrim(history_key, 0, self.max_history_items - 1)

    async def add_evaluation_history(
        self,
        token: str,
        submission: str,
        exercise_id: str,
        feedback: dict[str, Any],
        processing_time: float,
    ) -> None:
        await self._push(
            token,
            {
                "type": "evaluation",
                "submission": submission,
                "exercise_id": exercise_id,
                "feedback": feedback,
                "processing_time": processing_time,
            },
        )

    async def add_quiz_attempt_history(
        self,
        token: str,
        step_id: str,
        answer: Any,
        correct: bool,
    ) -> None:
        await self._push(
            token,
            {
                "type": "quiz_attempt",
                "step_id": step_id,
                "answer": answer,
                "correct": bool(correct),
            },
        )

    async def add_image_recognition_history(
        self,
        token: str,
        image_size: int,
        extracted_text: str,
        processing_time: float,
    ) -> None:
        await self._push(
            token,
            {
                "type": "image_recognition",
                "image_size": image_size,
                "extracted_text": extracted_text,
                "processing_time": processing_time,
            },
        )

    async def get_user_history(self, token: str, limit: int | None = None) -> list[dict[str, Any]]:
        fetch_limit = max(1, limit) if limit is not None else self.max_history_items
        items = await self.redis.lrange(self._history_key(token), 0, fetch_limit - 1)
        history: list[dict[str, Any]] = []
        for item in items:
            try:
                history.append(json.loads(item))
            except Exception:
                continue
        return history
