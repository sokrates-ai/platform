from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from redis.asyncio import Redis


@dataclass
class Job:
    id: str
    type: str
    userId: str
    workspaceId: str
    status: str
    createdAt: str
    updatedAt: str
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None


class JobsService:
    def __init__(self, redis: Redis):
        self.redis = redis

    def _job_key(self, job_id: str) -> str:
        return f"workspace:job:{job_id}"

    async def create_job(
        self,
        job_type: str,
        user_id: str,
        workspace_id: str,
        payload: Dict[str, Any],
        *,
        job_id: Optional[str] = None,
    ) -> Job:
        job_id = job_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        job = Job(
            id=job_id,
            type=job_type,
            userId=user_id,
            workspaceId=workspace_id,
            status="queued",
            createdAt=now,
            updatedAt=now,
            payload=payload,
            result=None,
        )
        await self.redis.set(self._job_key(job_id), json.dumps(asdict(job)))
        return job

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        raw = await self.redis.get(self._job_key(job_id))
        return json.loads(raw) if raw else None

    async def update_job(
        self,
        job_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
    ) -> None:
        job = await self.get_job(job_id)
        if not job:
            return
        job["status"] = status
        job["updatedAt"] = datetime.now(timezone.utc).isoformat()
        if result is not None:
            job["result"] = result
        await self.redis.set(self._job_key(job_id), json.dumps(job))

    async def recover_interrupted_jobs(self) -> int:
        """Mark in-flight jobs as failed after an API process restart."""
        recovered = 0
        async for key in self.redis.scan_iter(match="workspace:job:*"):
            raw = await self.redis.get(key)
            if not raw:
                continue
            try:
                job = json.loads(raw)
            except (TypeError, json.JSONDecodeError):
                continue
            if job.get("status") not in {"queued", "running"}:
                continue
            job["status"] = "error"
            job["updatedAt"] = datetime.now(timezone.utc).isoformat()
            job["result"] = {
                "message": "This evaluation was interrupted by a server restart. Please try again."
            }
            await self.redis.set(key, json.dumps(job))
            recovered += 1
        return recovered
