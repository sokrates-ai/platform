from datetime import date
from typing import Optional
from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, UniqueConstraint
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
    visible: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default='true'),
    )
    visible_after: Optional[date] = Field(
        default=None,
        sa_column=Column(Date, nullable=True),
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
    visible: bool = True
    visible_after: Optional[date] = None
    is_visible: bool = True


class CourseTabUpsert(SQLModel):
    tab_uuid: str
    name: str
    position: int
    visible: Optional[bool] = None
    visible_after: Optional[date] = None
