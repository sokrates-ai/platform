from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from pydantic import AnyUrl, BaseModel, Field, root_validator

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
    source_type: Literal["invlectrooms", "json"] = "invlectrooms"
    url: Optional[AnyUrl] = None
    course_uuid: str
    tab_uuid: Optional[str] = None
    chapter_name: Optional[str] = None
    xp_reward: Optional[int] = None
    coin_reward: Optional[int] = None
    problems: List[InvlectRoomsProblemPayload]

    @root_validator
    def validate_source(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        source_type = values.get("source_type")
        source_url = values.get("url")
        if source_type == "invlectrooms" and not source_url:
            raise ValueError("url is required for InvLectRooms imports")
        if source_type != "json":
            return values

        if source_url and urlsplit(str(source_url)).scheme not in {"http", "https"}:
            raise ValueError("JSON source URLs must use HTTP or HTTPS")

        problems = values.get("problems") or []
        if len(problems) > 500:
            raise ValueError("JSON imports can contain at most 500 problems")

        seen_ids = set()
        for index, problem in enumerate(problems):
            if not problem.title or not problem.title.strip():
                raise ValueError(f"problems[{index}].title is required")
            if problem.id is not None:
                id_key = (type(problem.id).__name__, str(problem.id))
                if id_key in seen_ids:
                    raise ValueError(f"problems[{index}].id is duplicated")
                seen_ids.add(id_key)

            checkpoint = (problem.checkpoint_level or "").strip().casefold()
            if checkpoint and checkpoint not in {"bronze", "silver", "gold"}:
                raise ValueError(
                    f"problems[{index}].checkpoint_level is invalid"
                )
            if checkpoint and problem.chapter_name:
                raise ValueError(
                    f"problems[{index}].chapter_name is not allowed for checkpoints"
                )

            image_url = None
            if isinstance(problem.image, dict):
                image_url = problem.image.get("original") or problem.image.get("local")
            if image_url and urlsplit(image_url).scheme not in {"http", "https"}:
                raise ValueError(
                    f"problems[{index}].image must use HTTP or HTTPS"
                )

            html_text = ""
            if problem.html:
                html_text = BeautifulSoup(problem.html, "html.parser").get_text(
                    " ", strip=True
                )
            if (
                not checkpoint
                and not (problem.plain_text or "").strip()
                and not html_text
                and not image_url
            ):
                raise ValueError(f"problems[{index}] has no importable content")
        return values


class InvlectRoomsApplyResponse(BaseModel):
    chapter: Optional[ChapterRead] = None
    chapters: List[ChapterRead]
    activities: List[ActivityRead]
