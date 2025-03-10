import json
import time
import requests
from typing import List, Optional
from config.config import WorkspaceConfig
from src.security.rbac.rbac import authorization_verify_based_on_roles_and_authorship
from src.db.courses.activities import Activity, ActivityTypeEnum
from src.services.courses.activities.activities import get_activity, rbac_check
from src.services.courses.activities.workspaces import Task, TaskBase, TaskCreate, create_task, delete_task, get_task, get_tasks
from fastapi import APIRouter, Depends, UploadFile, Form, Request, HTTPException, status
from sqlmodel import Session
from pydantic import BaseModel
from fastapi import FastAPI
from src.core.events.database import get_db_session
from src.db.courses.course_updates import (
    CourseUpdateCreate,
    CourseUpdateRead,
    CourseUpdateUpdate,
)
from src.db.users import InternalUser, PublicUser
from src.db.courses.courses import (
    CourseCreate,
    CourseRead,
    CourseUpdate,
    FullCourseReadWithTrail,
)
from src.security.auth import get_current_user
from src.services.courses.courses import (
    create_course,
    get_course,
    get_course_by_id,
    get_course_meta,
    get_courses_orgslug,
    update_course,
    delete_course,
    update_course_thumbnail,
)
from src.services.courses.updates import (
    create_update,
    delete_update,
    get_updates_by_course_uuid,
    update_update,
)


router = APIRouter()


class SessionCreate(BaseModel):
    activity_uuid: str

class SessionResponse(BaseModel):
    token: str
    workspace_url: str

def workspace_system_obtain_token(user: PublicUser, task_id: int, config: WorkspaceConfig) -> str:
    print(f"CREATING WS SESSION FOR USER={user} and TASK={task_id}...")

    url=f"http://{config.workspace_api_host}:{config.workspace_api_port}/api/createSession"
    body={
        "workspace_id": task_id,
        "username": user.user_uuid,
    }
    res=requests.post(url, json=body)

    print(res)

    if res.status_code != 200:
        raise(res.txt())

    parsed=res.json()

    if "token" not in parsed:
        raise("Illegal response: " + res.text())

    token=parsed["token"]

    return token

@router.post("/session")
async def api_create_session(
    # app: FastAPI,
    request: Request,
    # org_id: int,
    session_obj: SessionCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    # thumbnail: UploadFile | None = None,
) -> SessionResponse:
    """
    Create new exercise session
    """

    print(f"create new session: {current_user} | {session_obj}")

    # Get task-id based on the activity.
    activity: Activity =await get_activity(
        request=request,
        activity_uuid=session_obj.activity_uuid,
        current_user=current_user,
        db_session=db_session,
    )

    # Sanity-check that the activity type is task.
    print(f"activity={activity}")
    if activity.activity_type != ActivityTypeEnum.TYPE_WORKSPACE:
        raise HTTPException(
            status_code=422,
            detail="Activity is not a exercise",
        )

    # TODO: check if the user is allowed to do this
    # if current_user.

    # TODO: mock token creation here
    if "task_id" not in activity.content:
        raise "BUG: illegal content in activity"

    task_id=activity.content["task_id"]
    print(f"task ID={task_id}")

    print(f"LEARNHOUSE={request.app.learnhouse_config.workspace_config}")

    workspace_config: WorkspaceConfig =request.app.learnhouse_config.workspace_config
    token=workspace_system_obtain_token(user=current_user, task_id=task_id, config=workspace_config)

    return SessionResponse(
        token=token,
        workspace_url=workspace_config.workspace_external_base_url,
    )

    # return await create_task(
    #     request, current_user, task_obj, db_session
    # )

@router.post("/")
async def api_create_task(
    request: Request,
    # org_id: int,
    task_obj: TaskCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    # thumbnail: UploadFile | None = None,
) -> Task:
    """
    Create new task
    """
    # task = TaskCreate(
    #     title=title,
    #     description=description,
    #     task=task,
    #     solution=solution,
    # )

    return await create_task(
        request, current_user, task_obj, db_session
    )


# @router.put("/{course_uuid}/thumbnail")
# async def api_create_course_thumbnail(
#     request: Request,
#     course_uuid: str,
#     thumbnail: UploadFile | None = None,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> CourseRead:
#     """
#     Update new Course Thumbnail
#     """
#     return await update_course_thumbnail(
#         request, course_uuid, current_user, db_session, thumbnail
#     )


# @router.get("/{course_uuid}")
# async def api_get_course(
#     request: Request,
#     course_uuid: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> CourseRead:
#     """
#     Get single Course by course_uuid
#     """
#     return await get_course(
#         request, course_uuid, current_user=current_user, db_session=db_session
#     )


# @router.get("/id/{course_id}")
# async def api_get_course_by_id(
#     request: Request,
#     course_id: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> CourseRead:
#     """
#     Get single Course by id
#     """
#     return await get_course_by_id(
#         request, course_id, current_user=current_user, db_session=db_session
#     )


# @router.get("/{course_uuid}/meta")
# async def api_get_course_meta(
#     request: Request,
#     course_uuid: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> FullCourseReadWithTrail:
#     """
#     Get single Course Metadata (chapters, activities) by course_uuid
#     """
#     return await get_course_meta(
#         request, course_uuid, current_user=current_user, db_session=db_session
#     )

@router.get("/id/{id}")
async def api_get_task_single(
    request: Request,
    id: int,
    # org_slug: str,
    db_session: Session = Depends(get_db_session),
    # current_user: PublicUser = Depends(get_current_user),
) -> Task:
    """
    Get tasks based on ID
    """
    task = await get_task(
        request, db_session, id
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task does not exist",
        )

    return task
        

@router.get("/list/page/{page}/limit/{limit}")
async def api_get_task_list(
    request: Request,
    page: int,
    limit: int,
    # org_slug: str,
    db_session: Session = Depends(get_db_session),
    # current_user: PublicUser = Depends(get_current_user),
) -> List[Task]:
    """
    Get tasks based on page and limit
    """
    return await get_tasks(
        request, db_session, page, limit
    )


@router.delete("/id/{id}")
async def api_get_task_list(
    request: Request,
    id: int,
    # org_slug: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> None:
    """
    Get tasks based on page and limit
    """
    return await delete_task(
        request,
        db_session,
        id,
        current_user,
    )


# @router.put("/{course_uuid}")
# async def api_update_course(
#     request: Request,
#     course_object: CourseUpdate,
#     course_uuid: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> CourseRead:
#     """
#     Update Course by course_uuid
#     """
#     return await update_course(
#         request, course_object, course_uuid, current_user, db_session
#     )


# @router.delete("/{course_uuid}")
# async def api_delete_course(
#     request: Request,
#     course_uuid: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ):
#     """
#     Delete Course by ID
#     """

#     return await delete_course(request, course_uuid, current_user, db_session)


# @router.get("/{course_uuid}/updates")
# async def api_get_course_updates(
#     request: Request,
#     course_uuid: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> List[CourseUpdateRead]:
#     """
#     Get Course Updates by course_uuid
#     """

#     return await get_updates_by_course_uuid(
#         request, course_uuid, current_user, db_session
#     )


# @router.post("/{course_uuid}/updates")
# async def api_create_course_update(
#     request: Request,
#     course_uuid: str,
#     update_object: CourseUpdateCreate,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> CourseUpdateRead:
#     """
#     Create new Course Update
#     """

#     return await create_update(
#         request, course_uuid, update_object, current_user, db_session
#     )


# @router.put("/{course_uuid}/update/{courseupdate_uuid}")
# async def api_update_course_update(
#     request: Request,
#     course_uuid: str,
#     courseupdate_uuid: str,
#     update_object: CourseUpdateUpdate,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ) -> CourseUpdateRead:
#     """
#     Update Course Update by courseupdate_uuid
#     """

#     return await update_update(
#         request, courseupdate_uuid, update_object, current_user, db_session
#     )


# @router.delete("/{course_uuid}/update/{courseupdate_uuid}")
# async def api_delete_course_update(
#     request: Request,
#     course_uuid: str,
#     courseupdate_uuid: str,
#     db_session: Session = Depends(get_db_session),
#     current_user: PublicUser = Depends(get_current_user),
# ):
#     """
#     Delete Course Update by courseupdate_uuid
#     """

#     return await delete_update(request, courseupdate_uuid, current_user, db_session)
