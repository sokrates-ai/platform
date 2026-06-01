from __future__ import annotations

from fastapi import FastAPI

_app_instance: FastAPI | None = None


def set_app_instance(app: FastAPI | None) -> None:
    global _app_instance
    _app_instance = app


def get_app_instance() -> FastAPI:
    if _app_instance is None:
        raise RuntimeError("Workspace runtime has not been initialized")
    return _app_instance


def get_workspace_runtime():
    app = get_app_instance()
    runtime = getattr(app.state, "workspace_runtime", None)
    if runtime is None:
        raise RuntimeError("Workspace runtime state is unavailable")
    return runtime
