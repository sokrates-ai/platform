from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.db.users import UserRead


class CourseMemberGroupInviteStatusEnum(str, Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    cancelled = "cancelled"


class CourseMemberGroup(SQLModel, table=True):
    __tablename__ = "course_member_group"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    creation_date: str = ""
    update_date: str = ""


class CourseMemberGroupMember(SQLModel, table=True):
    __tablename__ = "course_member_group_member"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_course_member_group_member"),
        UniqueConstraint(
            "course_id",
            "user_id",
            name="uq_course_member_group_member_per_course",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    group_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("course_member_group.id", ondelete="CASCADE")
        )
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    creation_date: str = ""
    update_date: str = ""


class CourseMemberGroupInvite(SQLModel, table=True):
    __tablename__ = "course_member_group_invite"

    id: Optional[int] = Field(default=None, primary_key=True)
    group_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("course_member_group.id", ondelete="CASCADE")
        )
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    sender_user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    recipient_user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    status: CourseMemberGroupInviteStatusEnum = Field(
        default=CourseMemberGroupInviteStatusEnum.pending,
        sa_column=Column(String),
    )
    creation_date: str = ""
    update_date: str = ""


class CourseMemberGroupPendingCompletion(SQLModel, table=True):
    __tablename__ = "course_member_group_pending_completion"
    __table_args__ = (
        UniqueConstraint(
            "course_id",
            "user_id",
            "activity_uuid",
            name="uq_course_member_group_pending_completion",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    group_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("course_member_group.id", ondelete="CASCADE")
        )
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    source_user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    activity_uuid: str = Field(sa_column=Column(String))
    creation_date: str = ""
    update_date: str = ""


class CourseMemberGroupInviteCreate(SQLModel):
    recipient_user_ids: list[int]


class CourseMemberGroupMemberRead(BaseModel):
    user: UserRead
    room_ids: list[int] = []


class CourseMemberGroupInviteRead(BaseModel):
    id: int
    status: CourseMemberGroupInviteStatusEnum
    sender: UserRead
    recipient: UserRead
    creation_date: str
    update_date: str


class CourseMemberGroupRead(BaseModel):
    id: int
    member_count: int
    members: list[CourseMemberGroupMemberRead]
    creation_date: str
    update_date: str


class CourseMemberGroupMeRead(BaseModel):
    group: CourseMemberGroupRead | None
    sent_invites: list[CourseMemberGroupInviteRead]
    received_invites: list[CourseMemberGroupInviteRead]


class CourseMemberGroupRosterStudentRead(BaseModel):
    user: UserRead
    room_ids: list[int] = []
    group_id: int | None = None
    has_pending_invite_from_me: bool = False
    has_pending_invite_to_me: bool = False


class CourseMemberGroupBulkDeleteResult(BaseModel):
    deleted_group_ids: list[int]
    deleted_count: int
