from typing import List,  Optional
from sqlmodel import SQLModel, Field
from pydantic import BaseModel

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
    tags: List[str] = []
    pass


#
# Tags
#


class Tasks_Tags(SQLModel, table=True):
    tag_value: str = Field(foreign_key="tags.value", primary_key=True)
    task_id: int = Field(foreign_key="task.id", primary_key=True)


class Tags(SQLModel, table=True):
    value: str = Field(primary_key=True)
    color: int


class DeleteTag(BaseModel):
    value: str


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