from typing import List, Literal, Optional
from datetime import datetime
from src.db.tasks import (
    Course_Task,
    Tags,
    Task,
    TaskCreate,
    TaskWithCourseIDAndTags,
    Tasks_Tags,
)
from src.db.task_log import TaskLogBase, TaskLog

from sqlmodel import Session, select
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_user_is_anon,
)
from src.db.users import AnonymousUser, PublicUser
from fastapi import HTTPException, status, Request
import httpx
from config.config import WorkspaceConfig


# Required cuz the workspace caches tasks per-session.
# When we change a task, we might as well re-fetch all sessions :D
async def workspace_system_reload_all_sessions(config: WorkspaceConfig):
    url = f'http://{config.workspace_api_host}:{config.workspace_api_port}/v1/sessions/refresh'

    print(f"Refreshing all WS sessions: at {url}")

    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=None)
        # print(res)

        if res.status_code != 200:
            print(f"WS_RESPONSE: {res.text}")
            raise Exception(res.text)

        parsed = res.json()
        print(parsed)


async def workspace_system_obtain_token(
    user: PublicUser, task_id: int, activity_uuid: str, config: WorkspaceConfig
) -> str:
    url = f'http://{config.workspace_api_host}:{config.workspace_api_port}/v1/sessions'
    body = {
        'activity_uuid': activity_uuid,
        'exercise_id': task_id,
        'user_uuid': user.user_uuid,
    }
    # print(f"CREATING WS SESSION FOR USER={user} and TASK={task_id}...", url, body)
    print(f'user={user.user_uuid}')
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=body)
        # print(res)

        if res.status_code != 200:
            print(f"WS_RESPONSE: {res.text}")
            raise Exception(res.text)

        parsed = res.json()

        if 'token' not in parsed:
            print(f"WS_RESPONSE: {res.text}")
            raise ('Illegal response: ' + res.text)

        token = parsed['token']

        return token


async def add_course_task_association(
    db_session: Session,
    course_id: int,
    task_id: int,
):
    # Check if it already exists
    statement = select(Course_Task).where(
        Course_Task.course_id == course_id, Course_Task.task_id == task_id
    )
    existing = db_session.exec(statement).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Course-task association already present',
        )

    association = Course_Task(course_id=course_id, task_id=task_id)
    db_session.add(association)
    db_session.commit()
    db_session.refresh(association)
    return association


async def remove_course_task_association(
    db_session: Session,
    task_id: int,
):
    statement = select(Course_Task).where(Course_Task.task_id == task_id)
    association = db_session.exec(statement).first()

    if not association:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Course-task association not found',
        )

    db_session.delete(association)
    db_session.commit()


#
# Normal tasks.
#


async def get_task(
    request: Request,
    db_session: Session,
    id: int,
) -> Optional[Task]:
    statement = select(Task).where(Task.id == id)
    task = db_session.exec(statement).first()
    return task


async def get_tags(
    db_session: Session,
) -> List[Tags]:
    statement = select(Tags)
    tags = db_session.exec(statement).all()
    return tags


async def create_tag(
    db_session: Session,
    tag_value: str,
    color: int,
):
    tag = Tags.model_validate(Tags(value=tag_value, color=color))
    db_session.add(tag)
    db_session.commit()
    db_session.refresh(tag)


async def modify_tag(
    db_session: Session,
    tag_value: str,
    new_color: int,
):
    statement = select(Tags).where((Tags.value == tag_value))
    tag = db_session.exec(statement).first()

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Tag not found',
        )

    setattr(tag, 'color', new_color)

    db_session.commit()


async def delete_tag(
    db_session: Session,
    tag_value: str,
) -> List[str]:
    statement = select(Tags).where((Tags.value == tag_value))
    tag = db_session.exec(statement).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Tag not found',
        )

    #
    # Remove associations.
    #

    statement = select(Tasks_Tags).where(Tasks_Tags.tag_value == tag_value)
    tags = db_session.exec(statement).all()
    for t in tags:
        db_session.delete(t)

    db_session.delete(tag)
    db_session.commit()


#
# Task tags
#


async def get_task_tags(
    db_session: Session,
    task_id: int,
) -> List[str]:
    statement = (
        select(Tags)
        .join(Tasks_Tags, Tags.value == Tasks_Tags.tag_value)
        .where(Tasks_Tags.task_id == task_id)
    )
    tags = db_session.exec(statement).all()
    tags = [t.value for t in tags]
    return tags


async def create_task_tag(
    db_session: Session,
    task_id: int,
    tag_value: str,
) -> List[str]:
    link = Tasks_Tags.model_validate(
        Tasks_Tags(tag_value=tag_value, task_id=task_id)
    )
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)


async def delete_task_tag(
    db_session: Session,
    task_id: int,
    tag_value: str,
) -> List[str]:
    statement = select(Tasks_Tags).where(
        (Tasks_Tags.tag_value == tag_value) & (Tasks_Tags.task_id == task_id)
    )
    link = db_session.exec(statement).first()
    if link:
        db_session.delete(link)
        db_session.commit()


async def get_tasks(
    request: Request,
    db_session: Session,
    course_id: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
) -> List[TaskWithCourseIDAndTags]:
    offset = (page - 1) * limit

    if course_id is not None:
        # When `course_id` is provided, filter by it and return only tasks linked to that course
        statement = (
            select(Task, Course_Task.course_id)
            .join(Course_Task, Task.id == Course_Task.task_id)
            .where(Course_Task.course_id == course_id)
            .offset(offset)
            .limit(limit)
        )
    else:
        # When no `course_id` is provided, still join to include all courses associated with tasks
        statement = (
            select(Task, Course_Task.course_id)
            .join(Course_Task, Task.id == Course_Task.task_id, isouter=True)
            .offset(offset)
            .limit(limit)
        )

    # Fetch results and return them with `course_id`
    results = db_session.exec(statement).all()
    tasks_with_course_id = []

    for task, cid in results:
        # Get tags belonging to this task.
        tags = await get_task_tags(db_session=db_session, task_id=task.id)
        # print(f'task: {task} | tags={tags}')

        tasks_with_course_id.append(
            TaskWithCourseIDAndTags(
                **task.model_dump(), course_id=cid, tags=tags
            )
        )

    return tasks_with_course_id


async def create_task(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: TaskCreate,
    db_session: Session,
):
    # RBAC check
    await rbac_check(request, 'activity_x', current_user, 'create', db_session)

    # create activity
    task = Task.model_validate(data)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    print('new task id: ', task.id, data)

    # Create course association
    if data.course_id:
        await add_course_task_association(db_session, data.course_id, task.id)

    # Create tags.
    for tag in data.tags:
        print(f'Create tag: {tag}')
        await create_task_tag(
            db_session=db_session, task_id=task.id, tag_value=tag
        )

    return task


async def modify_task(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: TaskWithCourseIDAndTags,
    db_session: Session,
    config: WorkspaceConfig
):
    # RBAC check
    await rbac_check(request, 'activity_x', current_user, 'update', db_session)

    # create activity
    task = Task.model_validate(data)

    statement = select(Task).where(Task.id == data.id)
    task = db_session.exec(statement).first()
    print('MODIFY task')

    if not task:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Unprocessable entity: task does not exist',
        )

    # Update fields
    for key, value in data.dict(exclude_unset=True).items():
        if key == 'id' or key == 'tags' or key == 'course_id':
            continue
        setattr(task, key, value)

    db_session.commit()
    db_session.refresh(task)

    # Update course association.
    # Delete everything by default.
    statement = select(Course_Task).where(Course_Task.task_id == data.id)
    association = db_session.exec(statement).first()

    if association:
        db_session.delete(association)
        db_session.commit()

    if data.course_id:
        await add_course_task_association(db_session, data.course_id, data.id)

    # Update tags.
    current_tags = await get_task_tags(db_session=db_session, task_id=task.id)

    for tag in data.tags:
        if tag not in current_tags:
            await create_task_tag(
                db_session=db_session, task_id=task.id, tag_value=tag
            )

    for tag in current_tags:
        if tag not in data.tags:
            await delete_task_tag(
                db_session=db_session, task_id=task.id, tag_value=tag
            )

    # Trigger workspace refresh.
    await workspace_system_reload_all_sessions(config)

    return task


async def delete_task(
    request: Request,
    db_session: Session,
    id: int,
    current_user: PublicUser | AnonymousUser,
) -> List[Task]:
    statement = select(Task).where(Task.id == id)
    task = db_session.exec(statement).first()
    if not Task:
        # TODO: raise an unprocessable entiry
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Unprocessable entity: task does not exist',
        )

    # TODO: protect this route a bit.
    # await rbac_check(request, course.course_uuid, current_user, "delete", db_session)

    statement = select(Course_Task).where(Course_Task.task_id == task.id)
    association = db_session.exec(statement).first()

    if association:
        print('Deleted task association.')
        db_session.delete(association)
        db_session.commit()

    # Delete Task
    db_session.delete(task)
    db_session.commit()

    # Delete all tags
    tags = await get_task_tags(db_session=db_session, task_id=task.id)
    for tag in tags:
        await delete_task_tag(
            db_session=db_session, task_id=task.id, tag_value=tag
        )


async def create_task_log(
    db_session: Session,
    task_id: int,
    user_uuid: str,
    correct: bool,
) -> None:
    print(f'Task Log: {task_id} by {user_uuid} [{correct}]')
    log_item = TaskLog.model_validate(
        TaskLogBase(
            task_id=task_id,
            user_uuid=user_uuid,
            correct=correct,
            date=str(datetime.now()),
        )
    )
    db_session.add(log_item)
    db_session.commit()
    db_session.refresh(log_item)


async def get_task_log_of_user(
    db_session: Session,
    user_uuid: str,
) -> List[TaskLog]:
    statement = select(TaskLog).where(TaskLog.user_uuid == user_uuid)
    log = db_session.exec(statement).all()
    return log


async def rbac_check(
    request: Request,
    course_id: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal['create', 'read', 'update', 'delete'],
    db_session: Session,
):
    await authorization_verify_if_user_is_anon(current_user.id)

    await authorization_verify_based_on_roles_and_authorship(
        request,
        current_user.id,
        action,
        course_id,
        db_session,
    )


## 🔒 RBAC Utils ##
