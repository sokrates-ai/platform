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

class TaskCreate(TaskBase):
    pass

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

    # chapters = [ChapterRead(**chapter.model_dump(), activities=[], predecessors=[]) for chapter in chapters]

    # RBAC check
    # await rbac_check(request, course.course_uuid, current_user, "read", db_session)  # type: ignore

    # Get activities and predecessor(s) for each chapter
    # for chapter in chapters:
    #     #
    #     # Activities.
    #     #
    #     statement = (
    #         select(ChapterActivity)
    #         .where(ChapterActivity.chapter_id == chapter.id)
    #         .order_by(ChapterActivity.order)
    #         .distinct(ChapterActivity.id, ChapterActivity.order)
    #     )
    #     chapter_activities = db_session.exec(statement).all()

    #     for chapter_activity in chapter_activities:
    #         statement = (
    #             select(Activity)
    #             .where(Activity.id == chapter_activity.activity_id)
    #             .distinct(Activity.id)
    #         )
    #         activity = db_session.exec(statement).first()

    #         if activity:
    #             chapter.activities.append(ActivityRead(**activity.model_dump()))

    #     #
    #     # Predecessors.
    #     #

    #     statement = (
    #         select(CourseChapter_Graph)
    #         .where(CourseChapter_Graph.course_id == course_id)
    #         .where(CourseChapter_Graph.chapter_id == chapter.id)
    #     )

    #     incoming_edges = db_session.exec(statement).all()
    #     print(f"INCOMING of {chapter.id} = {incoming_edges}")
    #     chapter.predecessors = [ch.predecessor_id for ch in incoming_edges]

    # return chapters

# class WorkspaceData(BaseModel):
#     extra: str
#     chapter_id: str


# class WorkspaceDataInDB(BaseModel):
#     activity_id: str


async def create_task(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: TaskCreate,
    db_session: Session,
):
    # RBAC check
    await rbac_check(request, "activity_x", current_user, "create", db_session)

    # get chapter_id
    # statement = select(Chapter).where(Chapter.id == data.chapter_id)
    # chapter = db_session.exec(statement).first()

    # if not chapter:
    #     raise HTTPException(
    #         status_code=404,
    #         detail="Chapter not found",
    #     )

    # statement = select(CourseChapter).where(CourseChapter.chapter_id == data.chapter_id)
    # coursechapter = db_session.exec(statement).first()

    # if not coursechapter:
    #     raise HTTPException(
    #         status_code=404,
    #         detail="CourseChapter not found",
    #     )

    # generate activity_uuid
    # activity_uuid = str(f"activity_{uuid4()}")

    # task = TaskCreate(
        # data
        # name=data.name,
        # activity_type=ActivityTypeEnum.TYPE_WORKSPACE,
        # activity_sub_type=ActivitySubTypeEnum.SUBTYPE_WORKSPACE_ANY,
        # activity_uuid=activity_uuid,
        # course_id=coursechapter.course_id,
        # org_id=coursechapter.org_id,
        # published_version=1,
        # content={
        #     "extra": data.uri,
        #     "type": data.type,
        #     "activity_uuid": activity_uuid,
        # },
        # version=1,
        # creation_date=str(datetime.now()),
        # update_date=str(datetime.now()),
    # )

    # create activity
    task = Task.model_validate(data)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    # update chapter
    # chapter_activity_object = ChapterActivity(
    #     chapter_id=coursechapter.chapter_id,  # type: ignore
    #     activity_id=activity.id,  # type: ignore
    #     course_id=coursechapter.course_id,
    #     org_id=coursechapter.org_id,
    #     creation_date=str(datetime.now()),
    #     update_date=str(datetime.now()),
    #     order=1,
    # )

    # Insert ChapterActivity link in DB
    # db_session.add(chapter_activity_object)
    # db_session.commit()

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
        return

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
