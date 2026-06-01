from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI
from redis.asyncio import Redis

from src.services.workspace.config import WorkspaceSettings, build_workspace_settings
from src.services.workspace.history import HistoryManager
from src.services.workspace.state import set_app_instance


@dataclass
class WorkspaceRuntimeState:
    settings: WorkspaceSettings
    redis_client: Redis | None
    history_manager: HistoryManager | None


async def init_workspace_runtime(app: FastAPI) -> None:
    settings = build_workspace_settings(app.learnhouse_config)  # type: ignore[arg-type]
    redis_client = (
        Redis.from_url(settings.redis_url, decode_responses=True)
        if settings.redis_url
        else None
    )
    history_manager = HistoryManager(redis_client) if redis_client is not None else None
    app.state.workspace_runtime = WorkspaceRuntimeState(
        settings=settings,
        redis_client=redis_client,
        history_manager=history_manager,
    )
    set_app_instance(app)


async def shutdown_workspace_runtime(app: FastAPI) -> None:
    runtime = getattr(app.state, "workspace_runtime", None)
    redis_client = getattr(runtime, "redis_client", None)
    if redis_client is not None:
        close_fn = getattr(redis_client, "aclose", None)
        if close_fn is None:
            close_fn = getattr(redis_client, "close", None)
        if close_fn is not None:
            result = close_fn()
            if result is not None:
                await result
    set_app_instance(None)
