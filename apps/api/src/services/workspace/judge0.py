from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import httpx
from redis.asyncio import Redis

from src.services.workspace.state import get_workspace_runtime


async def _headers() -> Dict[str, str]:
    runtime = get_workspace_runtime()
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if runtime.settings.judge0_token:
        headers["X-Auth-Token"] = runtime.settings.judge0_token
    return headers


def _base_url() -> str | None:
    runtime = get_workspace_runtime()
    return runtime.settings.judge0_base_url


async def fetch_languages(redis: Redis, ttl_sec: int = 3600) -> List[Any]:
    cache_key = "workspace:judge0:languages"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
    base_url = _base_url()
    if not base_url:
        return []
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/languages",
            headers=await _headers(),
            timeout=15,
        )
        response.raise_for_status()
        languages = response.json()
    await redis.set(cache_key, json.dumps(languages), ex=ttl_sec)
    return languages


async def submit_single(payload: Dict[str, Any]) -> Optional[str]:
    base_url = _base_url()
    if not base_url:
        return None
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/submissions?base64_encoded=false&wait=false",
            headers=await _headers(),
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("token")


async def get_submission(token: str) -> Dict[str, Any]:
    base_url = _base_url()
    if not base_url:
        raise RuntimeError("Judge0 is not configured")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/submissions/{token}?base64_encoded=false",
            headers=await _headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


async def get_submissions_batch(tokens: List[str]) -> List[Dict[str, Any]]:
    base_url = _base_url()
    if not base_url:
        raise RuntimeError("Judge0 is not configured")
    if not tokens:
        return []
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/submissions/batch?base64_encoded=false",
            headers=await _headers(),
            params={"tokens": ",".join(tokens)},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json() or {}
    if isinstance(data, dict):
        submissions = data.get("submissions")
        if isinstance(submissions, list):
            return [item for item in submissions if isinstance(item, dict)]
    return []


async def submit_batch(payloads: List[Dict[str, Any]]) -> List[str]:
    base_url = _base_url()
    if not base_url or not payloads:
        return []
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/submissions/batch?base64_encoded=false&wait=false",
            headers=await _headers(),
            json={"submissions": payloads},
            timeout=60,
        )
        response.raise_for_status()
        data = response.json() or {}
    tokens: List[str] = []
    if isinstance(data, dict):
        submissions = data.get("submissions")
        if isinstance(submissions, list):
            for item in submissions:
                if isinstance(item, dict) and isinstance(item.get("token"), str):
                    tokens.append(item["token"])
        raw_tokens = data.get("tokens")
        if isinstance(raw_tokens, list):
            for token in raw_tokens:
                if isinstance(token, str):
                    tokens.append(token)
    return tokens
