from typing import Literal, List
from sqlmodel import Session, select
from src.db.trail_runs import TrailRun
from src.db.users import PublicUser, AnonymousUser, User

from src.services.courses.activities.workspaces import (
    get_task_log_of_user,
    TaskLog,
)
from src.db.courses.courses import (
    Course,
)
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_element_is_public,
    authorization_verify_if_user_is_anon,
)
from fastapi import HTTPException, Request
from sqlalchemy.dialects import postgresql


class CourseStudent(PublicUser):
    log: List[TaskLog]


async def list_course_students(
    request: Request,
    course_uuid: str,
    current_user: PublicUser,
    db_session: Session,
) -> List[CourseStudent]:
    """
    List students who are enrolled in the selected course.
    """

    course_id = await get_course_id_by_uuid(
        request, course_uuid, current_user, db_session
    )

    print(f'CID={course_id}')

    statement = (
        select(User).join(TrailRun)
        # .on(TrailStep.user_id == User.id)
        .where(TrailRun.course_id == course_id)
    )

    print(str(statement.compile(dialect=postgresql.dialect())))

    students = db_session.exec(statement).all()

    students_new = []
    for student in students:
        log = await get_task_log_of_user(db_session, student.user_uuid)
        stud = CourseStudent(**student.dict(), log=log)
        students_new.append(stud)

    print('STUD = ', students_new)

    # Get task log for each user

    # RBAC check
    # TODO: RBAC is totally FUCKED!!!
    # await rbac_check(
    #     request, students, current_user, 'read', db_session
    # )

    # Get course authors
    # authors_statement = (
    #     select(User)
    #     .join(ResourceAuthor)
    #     .where(ResourceAuthor.resource_uuid == course.course_uuid)
    # )
    # authors = db_session.exec(authors_statement).all()
    #
    # # convert from User to UserRead
    # authors = [UserRead.model_validate(author) for author in authors]
    #
    # course = CourseRead(**course.model_dump(), authors=authors)

    return students_new

    # return await (request, course_uuid, current_user, db_session)


async def get_course_id_by_uuid(
    request: Request,
    uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> int:
    print(f'GET COURSE UUID: {uuid}')
    statement = select(Course).where(Course.course_uuid == uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail='Course not found',
        )

    # RBAC check
    await rbac_check(
        request, course.course_uuid, current_user, 'read', db_session
    )
    return course.id


## 🔒 RBAC Utils ##


async def rbac_check(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal['create', 'read', 'update', 'delete'],
    db_session: Session,
):
    if action == 'read':
        if current_user.id == 0:  # Anonymous user
            res = await authorization_verify_if_element_is_public(
                request, course_uuid, action, db_session
            )
            return res
        else:
            res = await authorization_verify_based_on_roles_and_authorship(
                request, current_user.id, action, course_uuid, db_session
            )
            return res
    else:
        await authorization_verify_if_user_is_anon(current_user.id)

        await authorization_verify_based_on_roles_and_authorship(
            request,
            current_user.id,
            action,
            course_uuid,
            db_session,
        )


## 🔒 RBAC Utils ##
