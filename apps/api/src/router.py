from src.routers import metrics
from src.routers.courses import tasks
from fastapi import APIRouter, Depends
from src.routers import health
from src.routers import usergroups
from src.routers import dev, trail, users, auth, orgs, roles, invlectrooms, map_proxy, notifications
from src.routers.courses import chapters, collections, courses, assignments
from src.routers.courses.activities import activities, blocks
from src.routers.install import install
from src.routers.workspace import (
    code as workspace_code,
    flashcard as workspace_flashcard,
    images as workspace_images,
    judge0 as workspace_judge0,
    sessions as workspace_sessions,
    system as workspace_system,
    text as workspace_text,
    workspaces as workspace_workspaces,
)
from src.services.dev.dev import isDevModeEnabledOrRaise
from src.services.install.install import isInstallModeEnabled


v1_router = APIRouter(prefix="/api/v1")


# API Routes
v1_router.include_router(metrics.router, prefix="/metrics", tags=["users"])

v1_router.include_router(users.router, prefix="/users", tags=["users"])
v1_router.include_router(usergroups.router, prefix="/usergroups", tags=["usergroups"])
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
v1_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
v1_router.include_router(roles.router, prefix="/roles", tags=["roles"])
v1_router.include_router(blocks.router, prefix="/blocks", tags=["blocks"])
v1_router.include_router(courses.router, prefix="/courses", tags=["courses"])
v1_router.include_router(
    assignments.router, prefix="/assignments", tags=["assignments"]
)
v1_router.include_router(chapters.router, prefix="/chapters", tags=["chapters"])
v1_router.include_router(activities.router, prefix="/activities", tags=["activities"])
v1_router.include_router(
    collections.router, prefix="/collections", tags=["collections"]
)
v1_router.include_router(trail.router, prefix="/trail", tags=["trail"])
v1_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
v1_router.include_router(workspace_sessions.router)
v1_router.include_router(workspace_workspaces.router)
v1_router.include_router(workspace_text.router)
v1_router.include_router(workspace_flashcard.router)
v1_router.include_router(workspace_code.router)
v1_router.include_router(workspace_images.router)
v1_router.include_router(workspace_system.router)
v1_router.include_router(workspace_judge0.router)
v1_router.include_router(health.router, prefix="/health", tags=["health"])
v1_router.include_router(
    invlectrooms.router, prefix="/invlectrooms", tags=["invlectrooms"]
)
v1_router.include_router(
    map_proxy.router, prefix="/mapProxy", tags=["course-map"]
)
v1_router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"]
)

# Dev Routes
v1_router.include_router(
    dev.router,
    prefix="/dev",
    tags=["dev"],
    dependencies=[Depends(isDevModeEnabledOrRaise)],
)

# Install Routes
v1_router.include_router(
    install.router,
    prefix="/install",
    tags=["install"],
    dependencies=[Depends(isInstallModeEnabled)],
)
