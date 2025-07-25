from typing import Literal, List
from uuid import uuid4
from src.db.courses.chapters import Chapter
from sqlmodel import Session, select, or_, and_
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.organizations import Organization
from src.db.trail_runs import TrailRun
from src.security.features_utils.usage import (
    check_limits_with_usage,
    decrease_feature_usage,
    increase_feature_usage,
)
from src.services.trail.trail import get_user_trail_with_orgid
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum
from src.db.users import PublicUser, AnonymousUser, User, UserRead
from src.db.courses.courses import (
    Course,
    CourseCreate,
    CourseRead,
    CourseUpdate,
    FullCourseReadWithTrail,
)
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_element_is_public,
    authorization_verify_if_user_is_anon,
)
from src.services.courses.thumbnails import upload_thumbnail
from fastapi import HTTPException, Request, UploadFile
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, Form, Request
from sqlalchemy.dialects import postgresql


async def list_course_students(
    request: Request,
    course_uuid: str,
    current_user: PublicUser,
    db_session: Session,
) -> List[PublicUser]:
    """
    List students who are enrolled in the selected course.
    """

    course_id = await get_course_id_by_uuid(
        request, course_uuid, current_user, db_session
    )

    print(f"CID={course_id}")

    statement = (
        select(User)
        .join(TrailRun)
        # .on(TrailStep.user_id == User.id)
        .where(TrailRun.course_id == course_id)
    )

    print(str(statement.compile(dialect=postgresql.dialect())))

    students = db_session.exec(statement).all()

    print("STUD = ", students)

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

    return students

    # return await (request, course_uuid, current_user, db_session)


async def get_course_id_by_uuid(
    request: Request,
    uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> int:
    print(f"GET COURSE UUID: {uuid}")
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
