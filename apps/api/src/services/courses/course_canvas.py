from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from src.db.courses.course_canvas import CourseCanvas, CourseCanvasRead, CourseCanvasUpdate
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser


def get_canvas(
    _request: Request,
    course_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: Session,
):  
    statement = select(Course).where(
        Course.course_uuid == course_uuid
    )
    course = db_session.exec(statement).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Course {course_uuid} does not exist."
        )
    
    if user is AnonymousUser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Anonymous User cannot update the course canvas."
        )
    
    statement = select(CourseCanvas).where(
        CourseCanvas.course_id == course.id,
        CourseCanvas.user_id == user.id,
    )
    canvas = db_session.exec(statement).first()
    
    if not canvas:
        return CourseCanvasRead(
            selected_chapter_id= None,
            selected_tab_id= None,
            course_id=course.id,
            user_id=user.id,
        )
    return CourseCanvasRead(
        course_id=canvas.course_id,
        user_id=canvas.user_id,
        selected_chapter_id=canvas.selected_chapter_id,
        selected_tab_id=canvas.selected_tab_id,
    )


def put_update(
    _request: Request,
    course_uuid: str,
    course_canvas_update: CourseCanvasUpdate,
    user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Course).where(
        Course.course_uuid == course_uuid
    )
    course = db_session.exec(statement).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Course {course_uuid} does not exist."
        )
    
    if user is AnonymousUser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Anonymous User cannot update the course canvas."
        )
    
    statement = select(CourseCanvas).where(
        CourseCanvas.course_id == course.id,
        CourseCanvas.user_id == user.id,
    )
    canvas = db_session.exec(statement).first()
    fields_set = getattr(course_canvas_update, "model_fields_set", None)
    if not fields_set:
        fields_set = getattr(course_canvas_update, "__fields_set__", set())
    if not fields_set:
        fields_set = {"selected_chapter_id", "selected_tab_id"}
    if canvas:
        if "selected_chapter_id" in fields_set:
            canvas.selected_chapter_id = course_canvas_update.selected_chapter_id
        if "selected_tab_id" in fields_set:
            canvas.selected_tab_id = course_canvas_update.selected_tab_id
    else:
        canvas = CourseCanvas(
            selected_chapter_id=course_canvas_update.selected_chapter_id,
            selected_tab_id=course_canvas_update.selected_tab_id,
            course_id=course.id,
            user_id=user.id,
        )
        db_session.add(canvas)

    db_session.commit()
    
    return CourseCanvasRead(
        course_id=canvas.course_id,
        user_id=canvas.user_id,
        selected_chapter_id=canvas.selected_chapter_id,
        selected_tab_id=canvas.selected_tab_id,
    )
