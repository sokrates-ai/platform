from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import ForeignKey, JSON, Column, Integer, String


class TrailStepTypeEnum(str, Enum):
    STEP_TYPE_READABLE_ACTIVITY = "STEP_TYPE_READABLE_ACTIVITY"
    STEP_TYPE_ASSIGNMENT_ACTIVITY = "STEP_TYPE_ASSIGNMENT_ACTIVITY"
    STEP_TYPE_CUSTOM_ACTIVITY = "STEP_TYPE_CUSTOM_ACTIVITY"


class TrailStepVerificationEnum(str, Enum):
    NONE = "NONE"
    CORRECT = "CORRECT"
    INCORRECT = "INCORRECT"

#
# TODO: make trailstep more atomic!
#


class TrailStep(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    complete: bool
    tutor_verified: TrailStepVerificationEnum = Field(
        default=TrailStepVerificationEnum.NONE, sa_column=Column(String)
    )
    ai_verified: TrailStepVerificationEnum = Field(
        default=TrailStepVerificationEnum.NONE, sa_column=Column(String)
    )
    grade: str
    data: dict = Field(default={}, sa_column=Column(JSON))
    # foreign keys
    trailrun_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trailrun.id", ondelete="CASCADE"))
    )
    trail_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trail.id", ondelete="CASCADE"))
    )
    activity_uuid: str = Field(
        sa_column=Column(String)
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    # timestamps
    creation_date: str
    update_date: str


# note : prepare assignments support
# an assignment object will be linked to a trail step object in the future


class Assignment_Task_Complete(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    complete: bool
    task_id: int = Field(
        sa_column=Column(Integer, ForeignKey("task.id", ondelete="CASCADE"))
    )
    activity_uuid: str = Field(
        sa_column=Column(String)
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
