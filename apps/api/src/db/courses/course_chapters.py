from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class CourseChapter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # NOTE: order was removed in newest migration.
    # order: int
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    chapter_id: int = Field(
        sa_column=Column(Integer, ForeignKey("chapter.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    creation_date: str
    update_date: str


class CourseChapter_Graph(SQLModel, table=True):
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"), primary_key=True, )
    )
    chapter_id: int = Field(
        sa_column=Column(Integer,  ForeignKey("chapter.id", ondelete="CASCADE"), primary_key=True,)
    )
    predecessor_id: int = Field(
        sa_column=Column(Integer, ForeignKey("chapter.id", ondelete="CASCADE"))
    )
