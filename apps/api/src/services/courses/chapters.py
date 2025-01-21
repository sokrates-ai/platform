from datetime import datetime
from typing import List, Dict, Literal
from uuid import uuid4
from sqlmodel import Session, select
from src.db.users import AnonymousUser
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_element_is_public,
    authorization_verify_if_user_is_anon,
)
from src.db.courses.course_chapters import CourseChapter, CourseChapter_Graph
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import (
    Chapter,
    ChapterCreate,
    ChapterRead,
    ChapterUpdate,
    ChapterEdge,
)
from src.services.courses.courses import Course
from src.services.users.users import PublicUser
from fastapi import HTTPException, status, Request


####################################################
# CRUD
####################################################


async def create_chapter(
    request: Request,
    chapter_object: ChapterCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    chapter = Chapter.model_validate(chapter_object)

    # Get Course
    statement = select(Course).where(Course.id == chapter_object.course_id)

    course = db_session.exec(statement).one()

    # RBAC check
    await rbac_check(request, "chapter_x", current_user, "create", db_session)

    # complete chapter object
    chapter.course_id = chapter_object.course_id
    chapter.chapter_uuid = f"chapter_{uuid4()}"
    chapter.creation_date = str(datetime.now())
    chapter.update_date = str(datetime.now())
    chapter.org_id = course.org_id

    # Add chapter to database.
    db_session.add(chapter)
    db_session.commit()
    db_session.refresh(chapter)

    chapter = ChapterRead(**chapter.model_dump(), activities=[], predecessors=[])

    # Check if CourseChapter link exists
    statement = (
        select(CourseChapter)
        .where(CourseChapter.chapter_id == chapter.id)
        .where(CourseChapter.course_id == chapter.course_id)
        # .where(CourseChapter.order == to_be_used_order)
    )
    course_chapter = db_session.exec(statement).first()

    if not course_chapter:
        # Add CourseChapter link
        course_chapter = CourseChapter(
            course_id=chapter.course_id,
            chapter_id=chapter.id,
            org_id=chapter.org_id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
            # order=to_be_used_order,
        )

        # Insert CourseChapter link in DB
        db_session.add(course_chapter)
        db_session.commit()

    # NOTE: all of this code is only used to determine the last course chapter.
    # Find the last chapter in the course.
    # This is required so that we can add it as an automatic predecessor.
    # TODO: this will not work right now, we need to do a graph traversal (in a nutshell)
    statement = (
        select(CourseChapter)
        .where(CourseChapter.course_id == chapter.course_id)
        .where(CourseChapter.chapter_id != chapter.id)
        # .order_by(CourseChapter.order)
    )
    course_chapters = db_session.exec(statement).all()
    print(f"COURSE_CHAPTERS={course_chapters}")

    if course_chapters:
        print("NOTE: previous chapters exist, adding an edge...")

        predecessor_id = course_chapters[-1].chapter_id
        chapter.predecessors = [predecessor_id]

        course_chapter_graph_edge = CourseChapter_Graph(
                course_id=chapter.course_id,
                chapter_id=chapter.id,
                predecessor_id=predecessor_id,
        )

        db_session.add(course_chapter_graph_edge)
        db_session.commit()

    return chapter


async def get_chapter(
    request: Request,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Chapter does not exist"
        )

    # get COurse
    statement = select(Course).where(Course.id == chapter.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
        )

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "read", db_session)

    # Get activities for this chapter
    statement = (
        select(Activity)
        .join(ChapterActivity, Activity.id == ChapterActivity.activity_id)
        .where(ChapterActivity.chapter_id == chapter_id)
        .distinct(Activity.id)
    )

    activities = db_session.exec(statement).all()

    chapter = ChapterRead(
        **chapter.model_dump(),
        activities=[ActivityRead(**activity.model_dump()) for activity in activities],
    )

    return chapter


async def update_chapter(
    request: Request,
    chapter_object: ChapterUpdate,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Chapter does not exist"
        )

    # RBAC check
    await rbac_check(request, chapter.chapter_uuid, current_user, "update", db_session)

    # Update only the fields that were passed in
    for var, value in vars(chapter_object).items():
        if value is not None:
            setattr(chapter, var, value)

    chapter.update_date = str(datetime.now())

    db_session.commit()
    db_session.refresh(chapter)

    if chapter:
        chapter = await get_chapter(
            request, chapter.id, current_user, db_session  # type: ignore
        )

    return chapter


async def delete_chapter(
    request: Request,
    chapter_id: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Chapter does not exist"
        )

    # RBAC check
    await rbac_check(request, chapter.chapter_uuid, current_user, "delete", db_session)

    # Remove all linked chapter activities
    statement = select(ChapterActivity).where(ChapterActivity.chapter_id == chapter.id)
    chapter_activities = db_session.exec(statement).all()

    for chapter_activity in chapter_activities:
        db_session.delete(chapter_activity)

    # Delete the chapter
    db_session.delete(chapter)
    db_session.commit()

    return {"detail": "chapter deleted"}


async def get_course_chapters(
    request: Request,
    course_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    page: int = 1,
    limit: int = 10,
) -> List[ChapterRead]:

    statement = select(Course).where(Course.id == course_id)
    course = db_session.exec(statement).first()

    statement = (
        select(Chapter)
        .join(CourseChapter, Chapter.id == CourseChapter.chapter_id)
        .where(CourseChapter.course_id == course_id)
        .where(Chapter.course_id == course_id)
        # .order_by(CourseChapter.order)
        # .group_by(Chapter.id, CourseChapter.order)
    )
    chapters = db_session.exec(statement).all()

    chapters = [ChapterRead(**chapter.model_dump(), activities=[], predecessors=[]) for chapter in chapters]

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "read", db_session)  # type: ignore

    # Get activities and predecessor(s) for each chapter
    for chapter in chapters:
        #
        # Activities.
        #
        statement = (
            select(ChapterActivity)
            .where(ChapterActivity.chapter_id == chapter.id)
            .order_by(ChapterActivity.order)
            .distinct(ChapterActivity.id, ChapterActivity.order)
        )
        chapter_activities = db_session.exec(statement).all()

        for chapter_activity in chapter_activities:
            statement = (
                select(Activity)
                .where(Activity.id == chapter_activity.activity_id)
                .distinct(Activity.id)
            )
            activity = db_session.exec(statement).first()

            if activity:
                chapter.activities.append(ActivityRead(**activity.model_dump()))

        #
        # Predecessors.
        #

        statement = (
            select(CourseChapter_Graph)
            .where(CourseChapter_Graph.course_id == course_id)
            .where(CourseChapter_Graph.chapter_id == chapter.id)
        )

        incoming_edges = db_session.exec(statement).all()
        print(f"INCOMING={incoming_edges}")
        chapter.predecessors = [chapter.predecessor_id for chapter in incoming_edges if chapter.predecessor_id]

    return chapters


# Important Note : this is legacy code that has been used because
# the frontend is still not adapted for the new data structure, this implementation is absolutely not the best one
# and should not be used for future features
async def DEPRECEATED_get_course_chapters(
    request: Request,
    course_uuid: str,
    current_user: PublicUser,
    db_session: Session,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
        )

    # RBAC check
    await rbac_check(request, course.course_uuid, current_user, "read", db_session)

    chapters_in_db = await get_course_chapters(request, course.id, db_session, current_user)  # type: ignore

    # activities

    # chapters
    chapters = {}

    for chapter in chapters_in_db:
        chapter_activityIds = []

        for activity in chapter.activities:
            print("test", activity)
            chapter_activityIds.append(activity.activity_uuid)

        chapters[chapter.chapter_uuid] = {
            "uuid": chapter.chapter_uuid,
            "id": chapter.id,
            "name": chapter.name,
            "activityIds": chapter_activityIds,
        }

    # activities
    activities_list = {}
    statement = (
        select(Activity)
        .join(ChapterActivity, ChapterActivity.activity_id == Activity.id)
        .where(ChapterActivity.activity_id == Activity.id)
        .group_by(Activity.id)
    )
    activities_in_db = db_session.exec(statement).all()

    for activity in activities_in_db:
        activities_list[activity.activity_uuid] = {
            "uuid": activity.activity_uuid,
            "id": activity.id,
            "name": activity.name,
            "type": activity.activity_type,
            "content": activity.content,
        }

    # get chapter order
    statement = (
        select(Chapter)
        .join(CourseChapter, CourseChapter.chapter_id == Chapter.id)
        .where(CourseChapter.chapter_id == Chapter.id)
        .group_by(Chapter.id, CourseChapter.order)
        .order_by(CourseChapter.order)
    )
    chapters_in_db = db_session.exec(statement).all()

    chapterOrder = []

    for chapter in chapters_in_db:
        chapterOrder.append(chapter.chapter_uuid)

    final = {
        "chapters": chapters,
        "chapterOrder": chapterOrder,
        "activities": activities_list,
    }

    return final

#
#
# Graph utilities.
#
#


def is_cyclic_helper(
    adjacency_list: List[List[int]],
    current_index: int,
    visited: Dict[int, bool],
    recursion_stack: Dict[int, bool],
):
    if not visited[current_index]:
        # Mark the current node as visited.
        # and part of recursion stack.
        visited[current_index] = True
        print(f"current_index={current_index} | stack={recursion_stack}")
        recursion_stack[current_index] = True

        # Recur for all the vertices.
        # adjacent to this vertex
        for neightbour in adjacency_list[current_index]:
            if not visited[neightbour] and is_cyclic_helper(
                    adjacency_list,
                    neightbour,
                    visited,
                    recursion_stack,
            ):
                return True
            elif recursion_stack[neightbour]:
                return True

    # Remove the vertex from recursion stack
    recursion_stack[current_index] = False
    return False


def is_new_graph_cyclic_after_new_edge(
    course_id: int,
    new_edge: ChapterEdge,
    db_session: Session,
) -> bool:
    #
    # Step 1: fetch all nodes & edges of
    # this course and construct a in-memory graph.
    #

    statement_edges = select(CourseChapter_Graph).where(
            CourseChapter_Graph.course_id == course_id
    )
    edges: [CourseChapter_Graph] = db_session.exec(statement_edges).all()
    edges.append(CourseChapter_Graph(
        course_id=course_id,
        chapter_id=new_edge.to_chapter_id,
        predecessor_id=new_edge.from_chapter_id,
    ))

    statement_nodes = select(Chapter).where(Chapter.course_id == course_id)
    nodes: [Chapter] = db_session.exec(statement_nodes).all()

    #
    # Step 2: Construct adjacency list
    #

    adjacency_list = {}
    for node in nodes:
        print(f"node={node}")
        adjacency_list[node.id] = []

    for edge in edges:
        print(f"edge={edge}")
        adjacency_list[edge.chapter_id].append(edge.predecessor_id)

    print(f"adjacency_list={adjacency_list}")

    #
    # Step 3: get the initial nodes (no predecessors).
    # In case multiple elements are found in the list, we can terminate here
    # and just return `false` since no loops are possible.
    #

    initial_nodes = []
    rec_stack = {}
    visited = {}

    for node_id in adjacency_list.keys():
        visited[node_id] = False
        rec_stack[node_id] = False

        if len(adjacency_list[node_id]) == 0:
            initial_nodes.append(node_id)

    #
    # Step 4: perform DFS on the graph.
    #

    for node in nodes:
        if not visited[node.id] and is_cyclic_helper(
                adjacency_list,
                node.id,
                visited,
                rec_stack,
        ):
            return True

    return False


async def modify_chapter_edge(
    request: Request,
    course_uuid: str,
    edge_param: ChapterEdge,
    current_user: PublicUser,
    db_session: Session,
):
    statement = select(CourseChapter_Graph).where(
            CourseChapter_Graph.chapter_id == edge_param.to_chapter_id
            and CourseChapter_Graph.predecessor_id == edge_param.from_chapter_id
    )
    selected_edge = db_session.exec(statement).first()

    if edge_param.delete:
        # RBAC check
        await rbac_check(request, course_uuid, current_user, "update", db_session)

        if not selected_edge:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Edge does not exist"
            )

        db_session.delete(selected_edge)
        db_session.commit()
    else:
        # RBAC check
        await rbac_check(request, course_uuid, current_user, "update", db_session)

        if selected_edge:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Edge already exists"
            )


        # Get course from DB in order to get its ID, not UUID.
        statement = select(Course).where(Course.course_uuid == course_uuid)
        course = db_session.exec(statement).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
            )

        #
        # Check the integrity of the new graph: is the new graph cyclic?
        #

        if is_new_graph_cyclic_after_new_edge(course.id, edge_param, db_session):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cyclic course structure"
            )

        new_edge = CourseChapter_Graph(
            course_id=course.id,
            chapter_id=edge_param.to_chapter_id,
            predecessor_id=edge_param.from_chapter_id,
        )

        # Insert ChapterEdge link in DB
        db_session.add(new_edge)
        db_session.commit()

    return


# async def reorder_chapters_and_activities(
#     request: Request,
#     course_uuid: str,
#     chapters_order: ChapterUpdateOrder,
#     current_user: PublicUser,
#     db_session: Session,
# ):
#     statement = select(Course).where(Course.course_uuid == course_uuid)
#     course = db_session.exec(statement).first()
#
#     if not course:
#         raise HTTPException(
#             status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
#         )
#
#     # RBAC check
#     await rbac_check(request, course.course_uuid, current_user, "update", db_session)
#
#     ###########
#     # Chapters
#     ###########
#
#     # Delete CourseChapters that are not linked to chapter_id and activity_id and org_id and course_id
#     statement = (
#         select(CourseChapter)
#         .where(
#             CourseChapter.course_id == course.id, CourseChapter.org_id == course.org_id
#         )
#         .order_by(CourseChapter.order)
#     )
#     course_chapters = db_session.exec(statement).all()
#
#     chapter_ids_to_keep = [
#         chapter_order.chapter_id
#         for chapter_order in chapters_order.chapter_order_by_ids
#     ]
#     for course_chapter in course_chapters:
#         if course_chapter.chapter_id not in chapter_ids_to_keep:
#             db_session.delete(course_chapter)
#             db_session.commit()
#
#     # Delete Chapters that are not in the list of chapters_order
#     statement = select(Chapter).where(Chapter.course_id == course.id)
#     chapters = db_session.exec(statement).all()
#
#     chapter_ids_to_keep = [
#         chapter_order.chapter_id
#         for chapter_order in chapters_order.chapter_order_by_ids
#     ]
#
#     for chapter in chapters:
#         if chapter.id not in chapter_ids_to_keep:
#             db_session.delete(chapter)
#             db_session.commit()
#
#     # If links do not exists, create them
#     for chapter_order in chapters_order.chapter_order_by_ids:
#         statement = (
#             select(CourseChapter)
#             .where(
#                 CourseChapter.chapter_id == chapter_order.chapter_id,
#                 CourseChapter.course_id == course.id,
#             )
#             .order_by(CourseChapter.order)
#         )
#         course_chapter = db_session.exec(statement).first()
#
#         if not course_chapter:
#             # Add CourseChapter link
#             course_chapter = CourseChapter(
#                 chapter_id=chapter_order.chapter_id,
#                 course_id=course.id,  # type: ignore
#                 org_id=course.org_id,
#                 creation_date=str(datetime.now()),
#                 update_date=str(datetime.now()),
#                 order=chapter_order.chapter_id,
#             )
#
#             # Insert CourseChapter link in DB
#             db_session.add(course_chapter)
#             db_session.commit()
#
#     # Update order of chapters
#     for chapter_order in chapters_order.chapter_order_by_ids:
#         statement = (
#             select(CourseChapter)
#             .where(
#                 CourseChapter.chapter_id == chapter_order.chapter_id,
#                 CourseChapter.course_id == course.id,
#             )
#             .order_by(CourseChapter.order)
#         )
#         course_chapter = db_session.exec(statement).first()
#
#         if course_chapter:
#             # Get the order from the index of the chapter_order_by_ids list
#             course_chapter.order = chapters_order.chapter_order_by_ids.index(
#                 chapter_order
#             )
#             db_session.commit()
#
#     ###########
#     # Activities
#     ###########
#
#     # Delete ChapterActivities that are no longer part of the new order
#     statement = (
#         select(ChapterActivity)
#         .where(
#             ChapterActivity.course_id == course.id,
#             ChapterActivity.org_id == course.org_id,
#         )
#         .order_by(ChapterActivity.order)
#     )
#     chapter_activities = db_session.exec(statement).all()
#
#     activity_ids_to_delete = []
#     for chapter_activity in chapter_activities:
#         if (
#             chapter_activity.chapter_id not in chapter_ids_to_keep
#             or chapter_activity.activity_id not in activity_ids_to_delete
#         ):
#             activity_ids_to_delete.append(chapter_activity.activity_id)
#
#     for activity_id in activity_ids_to_delete:
#         statement = (
#             select(ChapterActivity)
#             .where(
#                 ChapterActivity.activity_id == activity_id,
#                 ChapterActivity.course_id == course.id,
#             )
#             .order_by(ChapterActivity.order)
#         )
#         chapter_activity = db_session.exec(statement).first()
#
#         db_session.delete(chapter_activity)
#         db_session.commit()
#
#     # If links do not exist, create them
#     chapter_activity_map = {}
#     for chapter_order in chapters_order.chapter_order_by_ids:
#         for activity_order in chapter_order.activities_order_by_ids:
#             if (
#                 activity_order.activity_id in chapter_activity_map
#                 and chapter_activity_map[activity_order.activity_id]
#                 != chapter_order.chapter_id
#             ):
#                 continue
#
#             statement = (
#                 select(ChapterActivity)
#                 .where(
#                     ChapterActivity.chapter_id == chapter_order.chapter_id,
#                     ChapterActivity.activity_id == activity_order.activity_id,
#                 )
#                 .order_by(ChapterActivity.order)
#             )
#             chapter_activity = db_session.exec(statement).first()
#
#             if not chapter_activity:
#                 # Add ChapterActivity link
#                 chapter_activity = ChapterActivity(
#                     chapter_id=chapter_order.chapter_id,
#                     activity_id=activity_order.activity_id,
#                     org_id=course.org_id,
#                     course_id=course.id,  # type: ignore
#                     creation_date=str(datetime.now()),
#                     update_date=str(datetime.now()),
#                     order=activity_order.activity_id,
#                 )
#
#                 # Insert ChapterActivity link in DB
#                 db_session.add(chapter_activity)
#                 db_session.commit()
#
#             chapter_activity_map[activity_order.activity_id] = chapter_order.chapter_id
#
#     # Update order of activities
#     for chapter_order in chapters_order.chapter_order_by_ids:
#         for activity_order in chapter_order.activities_order_by_ids:
#             statement = (
#                 select(ChapterActivity)
#                 .where(
#                     ChapterActivity.chapter_id == chapter_order.chapter_id,
#                     ChapterActivity.activity_id == activity_order.activity_id,
#                 )
#                 .order_by(ChapterActivity.order)
#             )
#             chapter_activity = db_session.exec(statement).first()
#
#             if chapter_activity:
#                 # Get the order from the index of the chapter_order_by_ids list
#                 chapter_activity.order = chapter_order.activities_order_by_ids.index(
#                     activity_order
#                 )
#                 db_session.commit()
#
#     return {"detail": "Chapters reordered"}


## 🔒 RBAC Utils ##


async def rbac_check(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
):
    if action == "read":
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
