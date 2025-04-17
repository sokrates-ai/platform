from typing import List, Literal, Optional
from src.db.courses.courses import Course
from src.db.organizations import Organization
from sqlmodel import SQLModel, Field, col

from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import Column, JSON
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
    # tags: Optional[dict] = None
    # tags: List = Field(default={}, sa_column=Column(JSON))


class Task(TaskBase, table=True):
    id: int = Field(default=None, primary_key=True)


class TaskModify(TaskBase):
    id: int = 0
    pass


class TaskCreate(TaskBase):
    course_id: Optional[int] = None
    pass


#
# Tags
#


class Tasks_Tags(SQLModel, table=True):
    tag_value: str
    task_id: int


class Tags(SQLModel, table=True):
    value: str
    color: int


#
# Course task / tag mapping.
#


class TaskWithCourseIDAndTags(TaskBase):
    id: int
    course_id: Optional[int] = None
    tags: List[str] = []


class Course_Task(SQLModel, table=True):
    course_id: int = Field(default=None, primary_key=True)
    task_id: int = Field(default=None, primary_key=True)


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
            detail="Course-task association already present",
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
            detail="Course-task association not found",
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
    print(f"task={task}")
    return task


# async def get_tasks(
#     request: Request,
#     db_session: Session,
#     course_id: Optional[int] = None,
#     page: int = 1,
#     limit: int = 10,
# ) -> List[Task]:
#     if course_id is not None:
#         statement = (
#             select(Task)
#             .join(Course_Task, Task.id == Course_Task.task_id)
#             .where(Course_Task.course_id == course_id)
#         )
#     else:
#         statement = select(Task)

#     # Optionally add pagination
#     offset = (page - 1) * limit
#     statement = statement.offset(offset).limit(limit)

#     tasks = db_session.exec(statement).all()
#     print(f"tasks={tasks}")
#     return tasks
# from sqlmodel import col

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
        # a

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
    await rbac_check(request, "activity_x", current_user, "create", db_session)

    # create activity
    task = Task.model_validate(data)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    print("new task id: ", task.id, data)

    # Create association
    if data.course_id:
        await add_course_task_association(db_session, data.course_id, task.id)

    # Create tags.
    # statement = 

    return task


async def modify_task(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: TaskWithCourseID,
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

    # Update association.
    # Delete everything by default.
    statement = select(Course_Task).where(Course_Task.task_id == data.id)
    association = db_session.exec(statement).first()

    if association:
        db_session.delete(association)
        db_session.commit()

    if data.course_id:
        await add_course_task_association(db_session, data.course_id, data.id)

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

    statement = select(Course_Task).where(Course_Task.task_id == task.id)
    association = db_session.exec(statement).first()

    if association:
        print("Deleted task association.")
        db_session.delete(association)
        db_session.commit()

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
