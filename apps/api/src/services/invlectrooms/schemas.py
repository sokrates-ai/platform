from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from pydantic import AnyUrl, BaseModel, Field

from src.db.courses.activities import ActivityRead
from src.db.courses.chapters import ChapterRead


class InvlectRoomsScrapeRequest(BaseModel):
    url: AnyUrl


class InvlectRoomsScrapeResponse(BaseModel):
    url: AnyUrl
    refresh_url: Optional[AnyUrl] = None
    refresh: Optional[Dict[str, Any]] = None


class InvlectRoomsProblemPayload(BaseModel):
    id: Optional[Union[int, str]] = None
    title: Optional[str] = None
    status: Optional[str] = None
    html: Optional[str] = None
    plain_text: Optional[str] = None
    image: Optional[Dict[str, Optional[str]]] = None
    chapter_name: Optional[str] = None
    checkpoint_level: Optional[str] = Field(default=None, alias="checkpointLevel")

    class Config:
        allow_population_by_field_name = True


class InvlectRoomsApplyRequest(BaseModel):
    url: AnyUrl
    course_uuid: str
    tab_uuid: Optional[str] = None
    chapter_name: Optional[str] = None
    problems: List[InvlectRoomsProblemPayload]


class InvlectRoomsApplyResponse(BaseModel):
    chapter: Optional[ChapterRead] = None
    chapters: List[ChapterRead]
    activities: List[ActivityRead]
