from datetime import datetime
from uuid import uuid4

from sqlmodel import Session, select

from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter, CourseChapter_Graph
from src.db.courses.course_tabs import CourseTab, CourseTabUpsert
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.services.courses.courses import upsert_course_tabs


def _now() -> str:
    return datetime.utcnow().isoformat()


def test_deleting_course_tab_deletes_tab_chapters(session: Session):
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None

    now = _now()
    course_uuid = f"course_{uuid4()}"
    tab_one_uuid = f"tab-1{course_uuid}"
    tab_two_uuid = f"tab-2{course_uuid}"
    course = Course(
        name=f"Tabs {uuid4()}",
        description="",
        about="",
        learnings="",
        tags="",
        thumbnail_image="",
        public=False,
        org_id=org.id or 0,
        course_uuid=course_uuid,
        creation_date=now,
        update_date=now,
    )
    session.add(course)
    session.commit()
    session.refresh(course)

    tabs = [
        CourseTab(
            tab_uuid=tab_one_uuid,
            course_id=course.id or 0,
            course_uuid=course_uuid,
            name="Week 3",
            position=0,
            visible=True,
            visible_after=None,
            creation_date=now,
            update_date=now,
        ),
        CourseTab(
            tab_uuid=tab_two_uuid,
            course_id=course.id or 0,
            course_uuid=course_uuid,
            name="Week 4",
            position=1,
            visible=True,
            visible_after=None,
            creation_date=now,
            update_date=now,
        ),
    ]
    session.add_all(tabs)
    session.commit()

    deleted_tab_chapter = Chapter(
        name="Should be deleted",
        org_id=org.id or 0,
        course_id=course.id or 0,
        chapter_uuid=f"chapter_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    remaining_tab_chapter = Chapter(
        name="Should remain",
        org_id=org.id or 0,
        course_id=course.id or 0,
        chapter_uuid=f"chapter_{uuid4()}",
        creation_date=now,
        update_date=now,
    )
    session.add_all([deleted_tab_chapter, remaining_tab_chapter])
    session.commit()
    session.refresh(deleted_tab_chapter)
    session.refresh(remaining_tab_chapter)

    session.add_all(
        [
            CourseChapter(
                course_id=course.id or 0,
                chapter_id=deleted_tab_chapter.id or 0,
                org_id=org.id or 0,
                creation_date=now,
                update_date=now,
            ),
            CourseChapter(
                course_id=course.id or 0,
                chapter_id=remaining_tab_chapter.id or 0,
                org_id=org.id or 0,
                creation_date=now,
                update_date=now,
            ),
            CourseChapter_Graph(
                course_id=course.id or 0,
                chapter_id=deleted_tab_chapter.id or 0,
                predecessor_id=None,
                tab_uuid=tab_one_uuid,
            ),
            CourseChapter_Graph(
                course_id=course.id or 0,
                chapter_id=remaining_tab_chapter.id or 0,
                predecessor_id=None,
                tab_uuid=tab_two_uuid,
            ),
        ]
    )
    session.commit()

    tabs_after_delete = upsert_course_tabs(
        course,
        [
            CourseTabUpsert(
                tab_uuid=tab_two_uuid,
                name="Week 4",
                position=0,
                visible=True,
                visible_after=None,
            )
        ],
        session,
    )

    assert [tab.tab_uuid for tab in tabs_after_delete] == [tab_two_uuid]
    assert session.get(Chapter, deleted_tab_chapter.id) is None
    assert session.get(Chapter, remaining_tab_chapter.id) is not None

    remaining_edges = session.exec(
        select(CourseChapter_Graph).where(CourseChapter_Graph.course_id == course.id)
    ).all()
    assert [(edge.chapter_id, edge.tab_uuid) for edge in remaining_edges] == [
        (remaining_tab_chapter.id, tab_two_uuid)
    ]
