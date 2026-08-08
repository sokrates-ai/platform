from typing import Any, List, Optional
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel
from src.db.courses.activities import ActivityRead


class ChapterBase(SQLModel):
    name: str
    description: Optional[str] = ""
    thumbnail_image: Optional[str] = ""
    org_id: int = Field(
        sa_column=Column("org_id", Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_id: int = Field(
        sa_column=Column("course_id", Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    xp_reward: int = 0
    coin_reward: int = 0


class Chapter(ChapterBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chapter_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class ChapterCreate(ChapterBase):
    # referenced order here will be ignored and just used for validation
    # used order will be the next available.
    tab_uuid: Optional[str] = None


class ChapterUpdate(ChapterBase):
    name: Optional[str]
    description: Optional[str] = ""
    thumbnail_image: Optional[str] = ""
    course_id: Optional[int]
    org_id: Optional[int] # type: ignore
    tab_uuid: Optional[str] = None


class ChapterRead(ChapterBase):
    id: int
    activities: List[ActivityRead]
    chapter_uuid: str
    creation_date: str
    update_date: str
    predecessors: List[int]
    tab_uuid: Optional[str]
    pass


class ActivityOrder(BaseModel):
    activity_id: int


class ChapterOrder(BaseModel):
    chapter_id: int
    activities_order_by_ids: List[ActivityOrder] = PydanticField(default_factory=list)


class ChapterUpdateOrder(BaseModel):
    chapter_order_by_ids: List[ChapterOrder]

class ChapterEdge(BaseModel):
    from_chapter_id: int
    to_chapter_id: int
    delete: bool


class DepreceatedChaptersRead(BaseModel):
    chapterOrder: Any
    chapters: Any
    activities: Any
    pass
