from typing import Any, Dict, List, Optional
from sqlalchemy import Column, ForeignKey, Index, Integer, JSON
from sqlmodel import Field, SQLModel
from src.db.users import UserRead
from src.db.trails import TrailRead
from src.db.courses.chapters import ChapterRead
from src.db.courses.course_tabs import CourseTabRead, CourseTabUpsert


def default_map_state() -> Dict[str, Any]:
    return {
        'objects': [],
        'boundaries': {
            'left': -1000,
            'right': 1000,
            'top': -1000,
            'bottom': 1000,
        },
    }


def default_tab_store() -> Dict[str, Any]:
    return {}


class CourseBase(SQLModel):
    class Config:
        allow_population_by_field_name = True

    name: str
    description: Optional[str]
    about: Optional[str]
    learnings: Optional[str]
    tags: Optional[str]
    thumbnail_image: Optional[str]
    map_state: Dict[str, Any] = Field(
        default_factory=default_map_state,
        sa_column=Column(JSON),
    )
    tab_store: Dict[str, Any] = Field(
        default_factory=default_tab_store,
        sa_column=Column(JSON),
        alias='tabStore',
    )
    public: bool


class Course(CourseBase, table=True):
    __table_args__ = (Index("ix_course_course_uuid", "course_uuid"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey('organization.id', ondelete='CASCADE')
        )
    )
    course_uuid: str = ''
    creation_date: str = ''
    update_date: str = ''


class CourseCreate(CourseBase):
    org_id: int = Field(default=None, foreign_key='organization.id')
    pass


class CourseUpdate(SQLModel):
    class Config:
        allow_population_by_field_name = True

    name: Optional[str] = None
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_image: Optional[str] = None
    map_state: Optional[Dict[str, Any]] = None
    tab_store: Optional[Dict[str, Any]] = Field(default=None, alias='tabStore')
    tabs: Optional[List[CourseTabUpsert]] = Field(default=None, alias='tabs')
    public: Optional[bool]


class CourseRead(CourseBase):
    id: int
    org_id: int = Field(default=None, foreign_key='organization.id')
    authors: Optional[List[UserRead]]
    course_uuid: str
    creation_date: str
    update_date: str
    tab_metadata: Optional[List[CourseTabRead]] = Field(default=None, alias='tabMetadata')
    pass


class FullCourseRead(CourseBase):
    id: int
    course_uuid: Optional[str]
    creation_date: Optional[str]
    update_date: Optional[str]
    # Chapters, Activities
    chapters: List[ChapterRead]
    authors: List[UserRead]
    tab_metadata: Optional[List[CourseTabRead]] = Field(default=None, alias='tabMetadata')
    pass


class FullCourseReadWithTrail(CourseBase):
    id: int
    course_uuid: Optional[str]
    creation_date: Optional[str]
    update_date: Optional[str]
    org_id: int = Field(default=None, foreign_key='organization.id')
    authors: List[UserRead]
    # Chapters, Activities
    chapters: List[ChapterRead]
    tab_metadata: Optional[List[CourseTabRead]] = Field(default=None, alias='tabMetadata')
    # Trail
    trail: TrailRead | None
    pass
