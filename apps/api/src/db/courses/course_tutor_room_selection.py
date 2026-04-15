from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class CourseTutorRoomSelection(SQLModel, table=True):
    __tablename__ = "course_tutor_room_selection"
    __table_args__ = (
        UniqueConstraint(
            "course_id", "user_id", name="uq_course_tutor_room_selection"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    room_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("course_room.id", ondelete="SET NULL")),
    )
    selected_tab_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    creation_date: str = ""
    update_date: str = ""


class CourseTutorRoomSelectionUpdate(SQLModel):
    room_id: int
    selected_tab_id: Optional[str] = None


class CourseTutorRoomSelectionRead(BaseModel):
    room_id: Optional[int] = None
    selected_tab_id: Optional[str] = None
