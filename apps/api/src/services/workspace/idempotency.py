from __future__ import annotations

import json
from typing import Optional

from redis.asyncio import Redis


class Idempotency:
    def __init__(self, redis: Redis, ttl_sec: int = 600):
        self.redis = redis
        self.ttl_sec = ttl_sec

    def _key(self, idem_key: str) -> str:
        return f"workspace:idempotency:{idem_key}"

    async def get_response(self, idem_key: str) -> Optional[dict]:
        raw = await self.redis.get(self._key(idem_key))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def set_response(self, idem_key: str, response: dict) -> None:
        await self.redis.set(self._key(idem_key), json.dumps(response), ex=self.ttl_sec)
