from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

from src.db.courses.course_canvas import CourseCanvas, CourseCanvasUpdate
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser


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
    if canvas:
        canvas.selected_chapter_id = course_canvas_update.selected_chapter_id
    else:
        canvas = CourseCanvas(
            selected_chapter_id=course_canvas_update.selected_chapter_id,
            course_id=course.id,
            user_id=user.id,
        )
        db_session.add(canvas)
    
    print(f"ID: {course_canvas_update.selected_chapter_id}")
    db_session.commit()
    
    return canvas