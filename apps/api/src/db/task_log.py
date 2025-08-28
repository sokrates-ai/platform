from sqlmodel import SQLModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String


class TaskLogBase(SQLModel):
    task_id: int = Field(
        sa_column=Column(Integer, ForeignKey('task.id', ondelete='CASCADE'))
    )
    user_uuid: str = Field(
        sa_column=Column(
            String, ForeignKey('user.user_uuid', ondelete='CASCADE')
        )
    )
    date: str = ''
    correct: bool = False


class TaskLog(TaskLogBase, table=True):
    id: int = Field(default=None, primary_key=True)
