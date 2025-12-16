from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, String
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
    id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, primary_key=True, autoincrement=True),
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"), nullable=False)
    )
    chapter_id: int = Field(
        sa_column=Column(Integer,  ForeignKey("chapter.id", ondelete="CASCADE"), nullable=False)
    )
    predecessor_id: Optional[int] = Field(
        sa_column=Column(Integer, ForeignKey("chapter.id", ondelete="CASCADE"), nullable=True)
    )
    tab_uuid: str = Field(
        sa_column=Column("tab_uuid", String, ForeignKey("course_tab.tab_uuid", ondelete="CASCADE"), nullable=False)
    )
