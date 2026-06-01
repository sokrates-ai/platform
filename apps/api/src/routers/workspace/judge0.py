from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Request

from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/judge0", tags=["workspace-judge0"])


@router.post("/callback")
async def judge0_callback(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    runtime = get_workspace_runtime()
    secret = runtime.settings.judge0_webhook_secret or ""
    if secret and (not x_webhook_secret or x_webhook_secret != secret):
        raise HTTPException(status_code=401, detail="Unauthorized webhook")

    try:
        payload = await request.json()
        logger.info(
            "judge0_callback",
            extra={
                "has_secret": bool(secret),
                "payload_keys": list(payload.keys()) if isinstance(payload, dict) else None,
            },
        )
    except Exception:
        logger.warning("judge0_callback_parse_failed", exc_info=True)
    return {"ok": True}
