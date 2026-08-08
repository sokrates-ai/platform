import uvicorn
import asyncio
import time
from fastapi import FastAPI, Request
import logging
from config.config import LearnHouseConfig, get_learnhouse_config
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi_jwt_auth.exceptions import AuthJWTException
from fastapi.middleware.gzip import GZipMiddleware
import os
from src.services.orgs.users import (
    record_user_interaction,
)
from fastapi_jwt_auth import AuthJWT


########################
# Pre-Alpha Version 0.1.0
# Author: @swve
# (c) LearnHouse 2022
########################

# Get LearnHouse Config
learnhouse_config: LearnHouseConfig = get_learnhouse_config()

# Global Config
app = FastAPI(
    title=learnhouse_config.site_name,
    description=learnhouse_config.site_description,
    docs_url='/docs'
    if learnhouse_config.general_config.development_mode
    else None,
    redoc_url='/redoc'
    if learnhouse_config.general_config.development_mode
    else None,
    version='0.1.0',
)

logger = logging.getLogger(__name__)
slow_request_ms = float(os.getenv('SLOW_REQUEST_MS', '500'))

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=learnhouse_config.hosting_config.allowed_regexp,
    allow_methods=['*'],
    allow_credentials=True,
    allow_headers=['*'],
)

# Gzip Middleware (will add brotli later)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Events
app.add_event_handler('startup', startup_app(app))
app.add_event_handler('shutdown', shutdown_app(app))


# JWT Exception Handler
@app.exception_handler(AuthJWTException)
def authjwt_exception_handler(request: Request, exc: AuthJWTException):
    return JSONResponse(
        status_code=exc.status_code,  # type: ignore
        content={'detail': exc.message},  # type: ignore
    )


# Static Files
base_path = 'content'
path = os.path.abspath(base_path)
print(f'Mounting content directory at: {path}')
app.mount('/content', StaticFiles(directory=base_path), name='content')

# Global Routes
app.include_router(v1_router)


@app.middleware('http')
async def log_server_errors_middleware(request: Request, call_next):
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled server error",
            extra={
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else None,
            },
        )
        raise

    if response.status_code >= 500:
        logger.error(
            "Server error response",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "client": request.client.host if request.client else None,
            },
        )
    duration_ms = (time.perf_counter() - started_at) * 1000
    if duration_ms >= slow_request_ms:
        logger.warning(
            "Slow API request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )
    return response


@app.middleware('http')
async def user_interaction_middleware(request: Request, call_next):
    user_id = None
    try:
        # Try to get user id from JWT if present
        Authorize = AuthJWT(request)
        Authorize.jwt_required()
        user_id = Authorize.get_jwt_subject()
    except Exception:
        pass  # No valid JWT, skip
    response = await call_next(request)
    if user_id:
        interaction_task = asyncio.create_task(
            asyncio.to_thread(record_user_interaction, user_id, str(request.url.path))
        )
        interaction_task.add_done_callback(
            lambda task: task.exception() if not task.cancelled() else None
        )
    return response


if __name__ == '__main__':
    # Spawn data reporting thread.

    uvicorn.run(
        'app:app',
        host='0.0.0.0',
        port=learnhouse_config.hosting_config.port,
        reload=learnhouse_config.general_config.development_mode,
        forwarded_allow_ips='*',
        log_level="debug"
    )

# General Routes
@app.get('/')
async def root():
    return {'Message': 'Welcome to LearnHouse ✨'}
