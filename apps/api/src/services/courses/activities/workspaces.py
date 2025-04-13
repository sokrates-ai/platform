from typing import List, Literal, Optional
from src.db.courses.courses import Course
from src.db.organizations import Organization
from sqlmodel import SQLModel, Field

from pydantic import BaseModel
from sqlmodel import Session, select
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_user_is_anon,
)
from src.db.courses.chapters import Chapter
from src.db.courses.activities import (
    Activity,
    ActivityRead,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.course_chapters import CourseChapter
from src.db.users import AnonymousUser, PublicUser
from src.services.courses.activities.uploads.videos import upload_video
from fastapi import HTTPException, status, UploadFile, Request
from uuid import uuid4
from datetime import datetime


class TaskBase(SQLModel):
    title: str = ""
    description: str = ""
    task: str = ""
    solution: Optional[str] = None

class Task(TaskBase, table=True):
    id: int = Field(default=None, primary_key=True)

class TaskModify(TaskBase):
    id: int = 0
    pass

class TaskCreate(TaskBase):
    pass
#
async def get_task(
    request: Request,
    db_session: Session,
    id: int,
) -> Optional[Task]:
    statement = select(Task).where(Task.id == id)
    task = db_session.exec(statement).first()
    print(f"task={task}")
    return task


async def get_tasks(
    request: Request,
    db_session: Session,
    page: int = 1,
    limit: int = 10,
) -> List[Task]:
    statement = select(Task)
    tasks = db_session.exec(statement).all()
    print(f"tasks={tasks}")
    return tasks


async def create_task(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: TaskCreate,
    db_session: Session,
):
    # RBAC check
    await rbac_check(request, "activity_x", current_user, "create", db_session)

    # create activity
    task = Task.model_validate(data)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    return task


async def modify_task(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: TaskModify,
    db_session: Session,
):
    # RBAC check
    await rbac_check(request, "activity_x", current_user, "update", db_session)

    # create activity
    task = Task.model_validate(data)

    statement = select(Task).where(Task.id == data.id)
    task = db_session.exec(statement).first()
    print(f"task={task}")

    if not task:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unprocessable entity: task does not exist",
        )

    # Update fields
    for key, value in data.dict(exclude_unset=True).items():
        if key == "id":
            continue
        setattr(task, key, value)

    db_session.commit()
    db_session.refresh(task)

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
            detail="Unprocessable entity: task does not exist",
        )

    print(f"task={task}")

    # TODO: protect this route a bit.
    # await rbac_check(request, course.course_uuid, current_user, "delete", db_session)

    # Feature usage
    # decrease_feature_usage("assignments", course.org_id, db_session)

    # Delete Assignment
    db_session.delete(task)
    db_session.commit()


async def rbac_check(
    request: Request,
    course_id: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
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