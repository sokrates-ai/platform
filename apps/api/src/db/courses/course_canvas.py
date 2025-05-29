
from sqlmodel import Field, SQLModel


class CourseCanvasBase(SQLModel):
    selected_chapter_id: int | None

class CourseCanvas(CourseCanvasBase, table=True):
    course_id: int | None = Field(
        default=None,
        foreign_key="course.id", 
        primary_key=True,
    )
    user_id: int | None = Field(
        default=None,
        foreign_key="user.id",
        primary_key=True,
    )


class CourseCanvasUpdate(CourseCanvasBase):
    selected_chapter_id: int | None

class CourseCanvasRead(CourseCanvasBase):
    course_id: int
    user_id: int
    selected_chapter_id: int | None