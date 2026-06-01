from __future__ import annotations

import io
import json
import logging

import httpx

from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)


async def image_recognition_pipeline(image: bytes) -> str:
    runtime = get_workspace_runtime()
    api_key = runtime.settings.mathpix_api_key
    app_id = runtime.settings.mathpix_app_id
    if not api_key or not app_id:
        raise RuntimeError("Missing Mathpix API credentials")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.mathpix.com/v3/text",
            files={"file": io.BytesIO(image)},
            data={
                "options_json": json.dumps(
                    {"math_inline_delimiters": ["$", "$"], "rm_spaces": True}
                )
            },
            headers={"app_id": app_id, "app_key": api_key},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()

    text = str(payload.get("text", "")).strip()
    logger.info("Mathpix OCR complete", extra={"text_length": len(text)})
    return text
