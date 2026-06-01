from __future__ import annotations

from dataclasses import dataclass

from redis.asyncio import Redis


@dataclass
class Limit:
    max: int
    windowSec: int


@dataclass
class RateLimitStatus:
    remaining: int
    resetSec: int
    limit: Limit
    consumed: bool


class RateLimiter:
    def __init__(self, redis: Redis):
        self.redis = redis

    def _key(self, kind: str, user_id: str, workspace_id: str) -> str:
        return f"workspace:rl:{kind}:{user_id}:{workspace_id}"

    async def check_and_consume(
        self,
        kind: str,
        user_id: str,
        workspace_id: str,
        limit: Limit,
    ) -> RateLimitStatus:
        key = self._key(kind, user_id, workspace_id)
        ttl = await self.redis.ttl(key)
        current = await self.redis.get(key)
        current_val = int(current) if current else 0
        if current_val >= limit.max:
            reset_sec = ttl if ttl > 0 else limit.windowSec
            return RateLimitStatus(
                remaining=0,
                resetSec=reset_sec,
                limit=limit,
                consumed=False,
            )
        pipe = self.redis.pipeline()
        pipe.incr(key)
        if ttl in (-2, -1):
            pipe.expire(key, limit.windowSec)
        await pipe.execute()
        remaining = max(0, limit.max - (current_val + 1))
        ttl2 = await self.redis.ttl(key)
        reset_sec = ttl2 if ttl2 > 0 else limit.windowSec
        return RateLimitStatus(
            remaining=remaining,
            resetSec=reset_sec,
            limit=limit,
            consumed=True,
        )

    async def status(
        self,
        kind: str,
        user_id: str,
        workspace_id: str,
        limit: Limit,
    ) -> RateLimitStatus:
        key = self._key(kind, user_id, workspace_id)
        ttl = await self.redis.ttl(key)
        current = await self.redis.get(key)
        current_val = int(current) if current else 0
        remaining = max(0, limit.max - current_val)
        reset_sec = ttl if ttl > 0 else 0
        return RateLimitStatus(
            remaining=remaining,
            resetSec=reset_sec,
            limit=limit,
            consumed=False,
        )
