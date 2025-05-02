import httpx
from typing import List, Optional
from config.config import WorkspaceConfig
from src.db.courses.activities import Activity, ActivityTypeEnum
from src.services.courses.activities.activities import get_activity
from src.services.courses.activities.workspaces import (
    DeleteTag,
    Tags,
    Task,
    TaskCreate,
    TaskWithCourseIDAndTags,
    create_tag,
    create_task,
    delete_tag,
    delete_task,
    get_tags,
    get_task,
    get_tasks,
    modify_tag,
    modify_task,
)
from fastapi import (
    APIRouter,
    Depends,
    Request,
    HTTPException,
    status,
    Query,
)
from sqlmodel import Session
from pydantic import BaseModel
from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user


router = APIRouter()


class SessionCreate(BaseModel):
    activity_uuid: str


class SessionResponse(BaseModel):
    token: str
    workspace_url: str


async def workspace_system_obtain_token(
    user: PublicUser, task_id: int, activity_uuid: str, config: WorkspaceConfig
) -> str:
    url = f"http://{config.workspace_api_host}:{config.workspace_api_port}/api/createSession"
    body = {
        "activity_uuid": activity_uuid,
        "exercise_id": task_id,
        "user_uuid": user.user_uuid,
    }
    # print(f"CREATING WS SESSION FOR USER={user} and TASK={task_id}...", url, body)
    print(f"user={user.user_uuid}")
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=body)
        # print(res)

        if res.status_code != 200:
            raise Exception(res.text)

        parsed = res.json()

        if "token" not in parsed:
            raise ("Illegal response: " + res.text)

        token = parsed["token"]

        return token


@router.post("/session")
async def api_create_session(
    request: Request,
    session_obj: SessionCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> SessionResponse:
    """
    Create new exercise session
    """

    print(f"create new session: {current_user} | {session_obj}")

    # Get task-id based on the activity.
    activity: Activity = await get_activity(
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

    task_id = activity.content["task_id"]
    print(f"task ID={task_id}")

    print(f"LEARNHOUSE={request.app.learnhouse_config.workspace_config}")

    workspace_config: WorkspaceConfig = request.app.learnhouse_config.workspace_config
    token = await workspace_system_obtain_token(
        user=current_user,
        task_id=task_id,
        activity_uuid=activity.activity_uuid,
        config=workspace_config,
    )

    print(f"token={token}")

    return SessionResponse(
        token=token,
        workspace_url=workspace_config.workspace_external_base_url,
    )


@router.post("/")
async def api_create_task(
    request: Request,
    task_obj: TaskCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> Task:
    """
    Create new task
    """
    return await create_task(request, current_user, task_obj, db_session)


@router.put("/")
async def api_modify_task(
    request: Request,
    task_obj: TaskWithCourseIDAndTags,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> Task:
    """
    Modify task
    """
    return await modify_task(request, current_user, task_obj, db_session)


@router.get("/id/{id}")
async def api_get_task_single(
    request: Request,
    id: int,
    db_session: Session = Depends(get_db_session),
) -> Task:
    """
    Get tasks based on ID
    """
    task = await get_task(request, db_session, id)

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
    course_id: Optional[int] = Query(default=None),
    db_session: Session = Depends(get_db_session),
) -> List[TaskWithCourseIDAndTags]:
    """
    Get tasks based on page and limit
    """
    return await get_tasks(request, db_session, course_id, page, limit)


@router.delete("/id/{id}")
async def api_delete_task(
    request: Request,
    id: int,
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


#
# Tags
#


@router.get("/tag")
async def api_get_tags_list(
    db_session: Session = Depends(get_db_session),
) -> List[Tags]:
    """
    Get task tags
    """
    return await get_tags(db_session)


@router.post("/tag")
async def api_create_tag(
    request: Request,
    tag: Tags,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> None:
    """
    Create new task tag
    """
    return await create_tag(db_session=db_session, tag_value=tag.value, color=tag.color)


@router.put("/tag")
async def api_modify_tag(
    request: Request,
    tag: Tags,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> None:
    """
    Modify task tag
    """
    return await modify_tag(
        db_session=db_session, tag_value=tag.value, new_color=tag.color
    )


@router.delete("/tag")
async def api_delete_tag(
    request: Request,
    tag: DeleteTag,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> None:
    """
    Modify task tag
    """
    return await delete_tag(db_session=db_session, tag_value=tag.value)
    # return await modify_task(request, current_user, task_obj, db_session)
