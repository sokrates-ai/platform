from enum import Enum
from typing import Optional
from sqlalchemy import Column, ForeignKey, Index, Integer
from sqlmodel import Field, SQLModel


class ResourceAuthorshipEnum(str, Enum):
    CREATOR = "CREATOR"
    MAINTAINER = "MAINTAINER"
    REPORTER = "REPORTER"


class ResourceAuthor(SQLModel, table=True):
    __table_args__ = (
        Index("ix_resourceauthor_resource_uuid", "resource_uuid"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    resource_uuid: str
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    authorship: ResourceAuthorshipEnum = ResourceAuthorshipEnum.CREATOR
    creation_date: str = ""
    update_date: str = ""
