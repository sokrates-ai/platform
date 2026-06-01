from __future__ import annotations

import logging
from urllib.parse import quote

import httpx

from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)


async def post_workspace_result(
    workspace_id: str,
    payload: dict,
    *,
    timeout: float = 5.0,
) -> None:
    runtime = get_workspace_runtime()
    base_url = runtime.settings.collab_bridge_url
    if not base_url:
        return
    target = f"{base_url.rstrip('/')}/workspaces/{quote(workspace_id, safe='')}/result"
    async with httpx.AsyncClient() as client:
        response = await client.post(target, json=payload, timeout=timeout)
        response.raise_for_status()


async def try_post_workspace_result(
    workspace_id: str,
    payload: dict,
    *,
    timeout: float = 5.0,
    context: str = "workspace_bridge",
) -> None:
    try:
        await post_workspace_result(workspace_id, payload, timeout=timeout)
    except Exception:
        logger.warning("%s_failed", context, exc_info=True, extra={"workspaceId": workspace_id})
