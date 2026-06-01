from __future__ import annotations

import logging
import time

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.services.workspace.image_recognition import image_recognition_pipeline
from src.services.workspace.sessions import get_session_from_redis
from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["workspace-images"])


@router.post("/{workspaceId}")
async def upload_image(workspaceId: str, file: UploadFile = File(...)):
    runtime = get_workspace_runtime()
    session_data = await get_session_from_redis(workspaceId)
    if not session_data:
        raise HTTPException(status_code=401, detail="Illegal token")

    try:
        contents = await file.read()
        if len(contents) > runtime.settings.max_upload_size:
            raise HTTPException(status_code=413, detail="File too large")
        start_time = time.time()
        markdown_result = await image_recognition_pipeline(contents)
        processing_time = time.time() - start_time
        if runtime.history_manager is not None:
            await runtime.history_manager.add_image_recognition_history(
                token=workspaceId,
                image_size=len(contents),
                extracted_text=markdown_result,
                processing_time=processing_time,
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Image processing error for token %s: %s", workspaceId, exc)
        raise HTTPException(status_code=500, detail="Server error") from exc
    finally:
        await file.close()

    return {"content": markdown_result}
