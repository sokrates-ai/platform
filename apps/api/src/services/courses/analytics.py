from datetime import datetime
from typing import Any

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter_Graph
from src.db.courses.course_rooms import CourseRoom, CourseRoomMember, RoomRoleEnum
from src.db.courses.course_tabs import CourseTab
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep, TrailStepVerificationEnum
from src.db.users import AnonymousUser, PublicUser, User
from src.services.courses.tutor_room_selection import get_course_and_role_flags


LOW_COMPLETION_THRESHOLD = 50
SLOW_TASK_MS = 7 * 24 * 60 * 60 * 1000
SLOW_RESPONSE_MS = 48 * 60 * 60 * 1000


def _normalize_activity_uuid(uuid: str) -> str:
    return uuid if uuid.startswith("activity_") else f"activity_{uuid}"


def _parse_timestamp(value: str | None) -> int | None:
    if not value:
        return None
    normalized = value if "T" in value else value.replace(" ", "T")
    try:
        return int(datetime.fromisoformat(normalized).timestamp() * 1000)
    except ValueError:
        return None


def _average_delta_ms(
    steps: list[TrailStep],
    from_field: str,
    to_field: str,
) -> float | None:
    total = 0
    count = 0
    for step in steps:
        start = _parse_timestamp(getattr(step, from_field, None))
        end = _parse_timestamp(getattr(step, to_field, None))
        if start is None or end is None:
            continue
        delta = end - start
        if delta < 0:
            continue
        total += delta
        count += 1
    return total / count if count else None


def _latest_timestamp(steps: list[TrailStep]) -> str | None:
    values = [
        value
        for step in steps
        for value in [step.verified_date, step.completed_date, step.update_date, step.creation_date]
        if value
    ]
    if not values:
        return None
    return max(values)


def _percent(value: int, total: int) -> int:
    return round((value / total) * 100) if total > 0 else 0


def _name_for_user(user: User) -> str:
    name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
    return name or user.username or user.email or f"User {user.id}"


def _activities_from_tab_store(course: Course, tabs: list[CourseTab]) -> list[dict[str, Any]]:
    tab_name_by_id = {tab.tab_uuid: tab.name for tab in tabs}
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    tab_store = course.tab_store or {}

    for tab in tabs:
        tab_id = tab.tab_uuid
        chapters = tab_store.get(tab_id, {}).get("content", {}).get("chapters", [])
        if not isinstance(chapters, list):
            continue
        for chapter_index, chapter in enumerate(chapters):
            chapter_name = chapter.get("name") or "Unnamed chapter"
            activities = chapter.get("activities") or []
            if not isinstance(activities, list):
                continue
            for activity_index, activity in enumerate(activities):
                uuid = (
                    activity.get("activity_uuid")
                    or activity.get("activityUuid")
                    or activity.get("uuid")
                )
                if not uuid:
                    continue
                activity_uuid = _normalize_activity_uuid(str(uuid))
                if activity_uuid in seen:
                    continue
                seen.add(activity_uuid)
                items.append(
                    {
                        "activity_uuid": activity_uuid,
                        "name": activity.get("name") or "Unnamed",
                        "chapter_name": chapter_name,
                        "tab_id": tab_id,
                        "tab_name": tab_name_by_id.get(tab_id, tab_id),
                        "tab_position": tab.position,
                        "chapter_position": chapter_index,
                        "activity_position": activity_index,
                    }
                )
    return items


def _activities_from_graph(course: Course, tabs: list[CourseTab], db_session: Session) -> list[dict[str, Any]]:
    tab_name_by_id = {tab.tab_uuid: tab.name for tab in tabs}
    tab_position_by_id = {tab.tab_uuid: tab.position for tab in tabs}
    chapter_by_id = {
        chapter.id: chapter
        for chapter in db_session.exec(
            select(Chapter).where(Chapter.course_id == course.id)
        ).all()
        if chapter.id is not None
    }
    activity_by_id = {
        activity.id: activity
        for activity in db_session.exec(
            select(Activity).where(Activity.course_id == course.id)
        ).all()
        if activity.id is not None
    }
    graph_rows = db_session.exec(
        select(CourseChapter_Graph).where(CourseChapter_Graph.course_id == course.id)
    ).all()
    tab_by_chapter_id = {row.chapter_id: row.tab_uuid for row in graph_rows}
    chapter_order = {row.chapter_id: index for index, row in enumerate(graph_rows)}
    chapter_activities = db_session.exec(
        select(ChapterActivity).where(ChapterActivity.course_id == course.id)
    ).all()

    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for relation in sorted(
        chapter_activities,
        key=lambda item: (
            tab_position_by_id.get(tab_by_chapter_id.get(item.chapter_id, ""), 0),
            chapter_order.get(item.chapter_id, 0),
            item.order,
            item.id or 0,
        ),
    ):
        activity = activity_by_id.get(relation.activity_id)
        chapter = chapter_by_id.get(relation.chapter_id)
        if not activity or not chapter:
            continue
        activity_uuid = _normalize_activity_uuid(activity.activity_uuid)
        if activity_uuid in seen:
            continue
        seen.add(activity_uuid)
        tab_id = tab_by_chapter_id.get(relation.chapter_id) or tabs[0].tab_uuid
        items.append(
            {
                "activity_uuid": activity_uuid,
                "name": activity.name,
                "chapter_name": chapter.name,
                "tab_id": tab_id,
                "tab_name": tab_name_by_id.get(tab_id, tab_id),
                "tab_position": tab_position_by_id.get(tab_id, 0),
                "chapter_position": chapter_order.get(relation.chapter_id, 0),
                "activity_position": relation.order,
            }
        )
    return items


def _activity_catalog(course: Course, tabs: list[CourseTab], db_session: Session) -> list[dict[str, Any]]:
    activities = _activities_from_tab_store(course, tabs)
    if activities:
        return activities
    return _activities_from_graph(course, tabs, db_session)


def _metric_summary(
    steps: list[TrailStep],
    student_ids: set[int],
    activity_count: int,
) -> dict[str, Any]:
    scoped_steps = [step for step in steps if step.user_id in student_ids]
    completed = sum(1 for step in scoped_steps if step.complete)
    pending = sum(
        1
        for step in scoped_steps
        if step.complete and step.tutor_verified == TrailStepVerificationEnum.NONE
    )
    incorrect = sum(
        1
        for step in scoped_steps
        if step.tutor_verified == TrailStepVerificationEnum.INCORRECT
    )
    correct = sum(
        1
        for step in scoped_steps
        if step.tutor_verified == TrailStepVerificationEnum.CORRECT
    )
    verified = sum(
        1
        for step in scoped_steps
        if step.tutor_verified != TrailStepVerificationEnum.NONE
    )
    started = len(scoped_steps)
    total_possible = len(student_ids) * activity_count
    return {
        "student_count": len(student_ids),
        "activity_count": activity_count,
        "started_count": started,
        "completed_count": completed,
        "verified_count": verified,
        "correct_count": correct,
        "incorrect_count": incorrect,
        "pending_verification_count": pending,
        "engaged_student_count": len({step.user_id for step in scoped_steps}),
        "completion_rate": _percent(completed, total_possible),
        "engagement_rate": _percent(len({step.user_id for step in scoped_steps}), len(student_ids)),
        "avg_task_duration_ms": _average_delta_ms(scoped_steps, "creation_date", "completed_date"),
        "avg_tutor_response_ms": _average_delta_ms(scoped_steps, "completed_date", "verified_date"),
    }


def _activity_metric(
    activity: dict[str, Any],
    steps: list[TrailStep],
    student_ids: set[int],
) -> dict[str, Any]:
    activity_steps = [
        step
        for step in steps
        if step.activity_uuid == activity["activity_uuid"] and step.user_id in student_ids
    ]
    metrics = _metric_summary(activity_steps, student_ids, 1)
    return {
        **activity,
        **metrics,
        "last_activity_at": _latest_timestamp(activity_steps),
    }


def _attention_items(
    activities: list[dict[str, Any]],
    tabs: list[dict[str, Any]],
    rooms: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    def add(kind: str, scope: str, ref_id: str, label: str, severity: str, metric: int, message: str) -> None:
        severity_rank = {"high": 3, "medium": 2, "low": 1}[severity]
        items.append(
            {
                "kind": kind,
                "scope": scope,
                "ref_id": ref_id,
                "label": label,
                "severity": severity,
                "metric": metric,
                "message": message,
                "_rank": severity_rank,
            }
        )

    for activity in activities:
        if activity["started_count"] > 0 and activity["completion_rate"] < LOW_COMPLETION_THRESHOLD:
            add(
                "low_completion",
                "activity",
                activity["activity_uuid"],
                activity["name"],
                "high",
                activity["completion_rate"],
                f"Only {activity['completion_rate']}% completion.",
            )
        if activity["pending_verification_count"] > 0:
            add(
                "pending_verification",
                "activity",
                activity["activity_uuid"],
                activity["name"],
                "medium",
                activity["pending_verification_count"],
                f"{activity['pending_verification_count']} completions need tutor verification.",
            )
        if activity["incorrect_count"] > 0:
            add(
                "incorrect",
                "activity",
                activity["activity_uuid"],
                activity["name"],
                "medium",
                activity["incorrect_count"],
                f"{activity['incorrect_count']} incorrect tutor verifications.",
            )
        response_ms = activity.get("avg_tutor_response_ms")
        if response_ms is not None and response_ms > SLOW_RESPONSE_MS:
            add(
                "slow_response",
                "activity",
                activity["activity_uuid"],
                activity["name"],
                "medium",
                round(response_ms),
                "Tutor response time is above 48h.",
            )

    for tab in tabs:
        if tab["pending_verification_count"] > 0:
            add(
                "pending_verification",
                "tab",
                tab["tab_id"],
                tab["name"],
                "medium",
                tab["pending_verification_count"],
                f"{tab['pending_verification_count']} pending verifications in this tab.",
            )

    for room in rooms:
        if room["student_count"] > 0 and room["completion_rate"] < LOW_COMPLETION_THRESHOLD:
            add(
                "low_completion",
                "room",
                str(room["id"]),
                room["name"],
                "high",
                room["completion_rate"],
                f"Room completion is {room['completion_rate']}%.",
            )

    return [
        {key: value for key, value in item.items() if key != "_rank"}
        for item in sorted(items, key=lambda item: (-item["_rank"], item["kind"], item["label"]))[:20]
    ]


async def get_course_analytics(
    _request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, Any]:
    course, role_flags = get_course_and_role_flags(course_uuid, current_user, db_session)
    if not (role_flags["is_admin"] or role_flags["is_maintainer"]):
        raise HTTPException(
            status_code=403,
            detail="User does not have permission to view course analytics",
        )

    tabs = db_session.exec(
        select(CourseTab)
        .where(CourseTab.course_id == course.id)
        .order_by(CourseTab.position.asc(), CourseTab.id.asc())
    ).all()
    activities = _activity_catalog(course, tabs, db_session)
    activity_uuids = {activity["activity_uuid"] for activity in activities}

    trail_runs = db_session.exec(
        select(TrailRun).where(TrailRun.course_id == course.id)
    ).all()
    student_ids = {run.user_id for run in trail_runs if run.user_id}
    users = db_session.exec(select(User).where(User.id.in_(student_ids))).all() if student_ids else []
    users_by_id = {user.id: user for user in users if user.id is not None}

    steps = (
        db_session.exec(
            select(TrailStep).where(
                TrailStep.course_id == course.id,
                TrailStep.activity_uuid.in_(activity_uuids),
            )
        ).all()
        if activity_uuids
        else []
    )

    rooms = db_session.exec(
        select(CourseRoom).where(CourseRoom.course_id == course.id)
    ).all()
    room_members = (
        db_session.exec(
            select(CourseRoomMember).where(
                CourseRoomMember.room_id.in_([room.id for room in rooms if room.id is not None])
            )
        ).all()
        if rooms
        else []
    )
    room_student_ids: dict[int, set[int]] = {}
    room_tutor_counts: dict[int, int] = {}
    for member in room_members:
        if member.room_id is None:
            continue
        if member.role == RoomRoleEnum.student:
            room_student_ids.setdefault(member.room_id, set()).add(member.user_id)
        if member.role == RoomRoleEnum.tutor:
            room_tutor_counts[member.room_id] = room_tutor_counts.get(member.room_id, 0) + 1

    activity_metrics = [_activity_metric(activity, steps, student_ids) for activity in activities]

    tabs_payload: list[dict[str, Any]] = []
    for tab in tabs:
        tab_activities = [activity for activity in activities if activity["tab_id"] == tab.tab_uuid]
        tab_steps = [step for step in steps if step.activity_uuid in {a["activity_uuid"] for a in tab_activities}]
        tabs_payload.append(
            {
                "tab_id": tab.tab_uuid,
                "name": tab.name,
                "position": tab.position,
                **_metric_summary(tab_steps, student_ids, len(tab_activities)),
            }
        )

    rooms_payload: list[dict[str, Any]] = []
    for room in rooms:
        if room.id is None:
            continue
        scoped_student_ids = room_student_ids.get(room.id, set()) & student_ids
        room_steps = [step for step in steps if step.user_id in scoped_student_ids]
        rooms_payload.append(
            {
                "id": room.id,
                "name": room.name,
                "tutor_count": room_tutor_counts.get(room.id, 0),
                "student_ids": sorted(scoped_student_ids),
                "activities": [
                    _activity_metric(activity, room_steps, scoped_student_ids)
                    for activity in activities
                ],
                **_metric_summary(room_steps, scoped_student_ids, len(activities)),
            }
        )

    students_payload: list[dict[str, Any]] = []
    for student_id in sorted(student_ids):
        user = users_by_id.get(student_id)
        if not user:
            continue
        student_steps = [step for step in steps if step.user_id == student_id]
        students_payload.append(
            {
                "id": student_id,
                "name": _name_for_user(user),
                "email": user.email,
                **_metric_summary(student_steps, {student_id}, len(activities)),
                "last_activity_at": _latest_timestamp(student_steps),
            }
        )

    matrix_rows: list[dict[str, Any]] = []
    for tab in tabs_payload:
        cells = [
            activity
            for activity in activity_metrics
            if activity["tab_id"] == tab["tab_id"]
        ]
        cells.sort(key=lambda item: (item["chapter_position"], item["activity_position"], item["name"]))
        matrix_rows.append({"tab_id": tab["tab_id"], "name": tab["name"], "cells": cells})

    return {
        "course_uuid": course.course_uuid,
        "summary": _metric_summary(steps, student_ids, len(activities)),
        "tabs": tabs_payload,
        "rooms": rooms_payload,
        "activities": activity_metrics,
        "students": students_payload,
        "matrix": {"rows": matrix_rows},
        "attention": _attention_items(activity_metrics, tabs_payload, rooms_payload),
        "thresholds": {
            "low_completion_rate": LOW_COMPLETION_THRESHOLD,
            "slow_task_ms": SLOW_TASK_MS,
            "slow_response_ms": SLOW_RESPONSE_MS,
        },
    }
