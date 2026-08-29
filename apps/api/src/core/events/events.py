from typing import Callable
import os
from fastapi import FastAPI
from config.config import LearnHouseConfig, get_learnhouse_config
from src.core.events.autoinstall import auto_install
from src.core.events.content import check_content_directory
from src.core.events.database import close_database, connect_to_db
from src.core.events.logs import init_logging
from src.services.courses.meta_cache import register_cache_invalidation
from src.services.notifications.service import start_notifications, stop_notifications
from src.services.workspace.runtime import (
    init_workspace_runtime,
    shutdown_workspace_runtime,
)


def startup_app(app: FastAPI) -> Callable:
    async def start_app() -> None:
        print("[APP] Start handler")
        # Get LearnHouse Config
        learnhouse_config: LearnHouseConfig = get_learnhouse_config()
        app.learnhouse_config = learnhouse_config  # type: ignore

        if os.environ.get("LEARNHOUSE_TESTING") == "1":
            await init_logging()
            await check_content_directory()
            return

        # Connect to database
        await connect_to_db(app)

        # Initialize logging (creates logs directory)
        await init_logging()

        # Create content directory
        await check_content_directory()

        # Check if auto-installation is needed
        auto_install()

        # Initialize merged workspace runtime state
        await init_workspace_runtime(app)

        # Start notification system (websockets + optional Redis pubsub)
        await start_notifications(app)

        # Drop the cached course payloads whenever course content is committed.
        register_cache_invalidation()

    return start_app


def shutdown_app(app: FastAPI) -> Callable:
    async def close_app() -> None:
        if os.environ.get("LEARNHOUSE_TESTING") == "1":
            return

        await stop_notifications(app)
        await shutdown_workspace_runtime(app)
        await close_database(app)

    return close_app
