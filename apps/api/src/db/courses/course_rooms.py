from enum import Enum
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.db.users import UserRead


class RoomRoleEnum(str, Enum):
    student = "student"
    tutor = "tutor"


class CourseRoomBase(SQLModel):
    name: str
    description: Optional[str] = None


class CourseRoom(CourseRoomBase, table=True):
    __tablename__ = "course_room"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    creation_date: str = ""
    update_date: str = ""


class CourseRoomCreate(CourseRoomBase):
    pass


class CourseRoomUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CourseRoomRead(CourseRoomBase):
    id: int
    course_id: int
    creation_date: str
    update_date: str
    student_count: int = 0
    tutor_count: int = 0


class CourseRoomMember(SQLModel, table=True):
    __tablename__ = "course_room_member"
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_course_room_member"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    room_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course_room.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    role: RoomRoleEnum = RoomRoleEnum.student
    creation_date: str = ""
    update_date: str = ""


class CourseRoomMemberRead(BaseModel):
    user: UserRead
    role: RoomRoleEnum
