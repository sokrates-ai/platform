from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class CourseTab(SQLModel, table=True):
    __tablename__ = 'course_tab'
    __table_args__ = (
        UniqueConstraint('course_id', 'tab_uuid', name='uq_course_tab_per_course'),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    tab_uuid: str = Field(
        sa_column=Column(String, nullable=False, unique=True),
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey('course.id', ondelete='CASCADE'), nullable=False),
    )
    course_uuid: str = Field(
        sa_column=Column(String, nullable=False),
    )
    name: str = Field(
        sa_column=Column(String, nullable=False),
    )
    position: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, default=0),
    )
    creation_date: str = Field(
        sa_column=Column(String, nullable=False),
    )
    update_date: str = Field(
        sa_column=Column(String, nullable=False),
    )


class CourseTabRead(SQLModel):
    tab_uuid: str
    course_uuid: str
    name: str
    position: int


class CourseTabUpsert(SQLModel):
    tab_uuid: str
    name: str
    position: int
