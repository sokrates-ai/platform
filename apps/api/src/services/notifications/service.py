from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Dict, TypedDict

from fastapi import FastAPI

from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from src.db.users import PublicUser, User
from src.services.notifications.broker import RedisNotificationBroker
from src.services.notifications.manager import NotificationManager
from src.services.notifications.models import (
    NotificationLevel,
    build_notification,
    build_system_event,
)


manager = NotificationManager()
broker = RedisNotificationBroker()


class TutorStudentActivityCompletedNotificationTarget(TypedDict):
    tutor_user_id: int
    room_id: int
    room_uuid: str


async def start_notifications(app: FastAPI) -> None:
    manager.start()
    await broker.start(manager)
    app.notification_manager = manager  # type: ignore[attr-defined]
    app.notification_broker = broker  # type: ignore[attr-defined]


async def stop_notifications(app: FastAPI) -> None:
    await broker.stop()
    await manager.stop()
    app.notification_manager = None  # type: ignore[attr-defined]
    app.notification_broker = None  # type: ignore[attr-defined]


async def notify_user(user_id: int, message: Dict[str, Any]) -> None:
    await manager.send_to_user(user_id, message)
    await broker.publish(user_id, message)


async def notify_users(user_ids: Iterable[int], message: Dict[str, Any]) -> None:
    for user_id in user_ids:
        await notify_user(user_id, message)


async def notify_all(message: Dict[str, Any]) -> None:
    await manager.broadcast(message)
    await broker.publish("all", message)


async def send_notification(
    *,
    topic: str = "broadcast",
    title: str,
    body: str,
    level: NotificationLevel = "info",
    data: Dict[str, Any] | None = None,
    user_id: int | None = None,
    user_ids: Iterable[int] | None = None,
    broadcast: bool = False,
) -> Dict[str, Any]:
    message = build_notification(
        topic=topic,
        title=title,
        body=body,
        level=level,
        data=data,
    )

    if broadcast:
        await notify_all(message)
        return message

    if user_id is not None:
        await notify_user(user_id, message)
        return message

    if user_ids is not None:
        await notify_users(user_ids, message)
        return message

    raise ValueError(
        "send_notification requires user_id, user_ids, or broadcast=True"
    )


def build_tutor_student_activity_completed_topic(
    *,
    tutor_user_id: int,
    course_uuid: str,
    student_uuid: str,
    room_uuid: str,
) -> str:
    return (
        f"user/{tutor_user_id}/courses/{course_uuid}/students/"
        f"{student_uuid}/rooms/{room_uuid}/activity-completed"
    )


def build_tutor_student_activity_started_topic(
    *,
    tutor_user_id: int,
    course_uuid: str,
    student_uuid: str,
    room_uuid: str,
) -> str:
    return (
        f"user/{tutor_user_id}/courses/{course_uuid}/students/"
        f"{student_uuid}/rooms/{room_uuid}/activity-started"
    )


def _display_name(user: PublicUser | User) -> str:
    parts = [user.first_name.strip(), user.last_name.strip()]
    name = " ".join(part for part in parts if part)
    if name:
        return name
    return user.username


async def notify_tutors_student_activity_started(
    *,
    notification_targets: Iterable[TutorStudentActivityCompletedNotificationTarget],
    student: PublicUser | User,
    activity: Activity,
    course: Course,
) -> None:
    student_name = _display_name(student)

    # TODO: FAT FOLLOW-UP
    # Course rooms do not have a persisted UUID column yet, so `room_uuid`
    # currently comes from a synthetic identifier derived from `room_id`.
    # We also intentionally emit one notification per room membership instead
    # of deduplicating by tutor. If a student belongs to multiple rooms at the
    # same time, the same tutor can receive multiple notifications for one
    # activity state change. Keep this behavior for now so the frontend can
    # throttle or aggregate without losing room context. Revisit this once
    # course rooms have real UUIDs and deduplication rules are defined.
    for target in notification_targets:
        tutor_user_id = target["tutor_user_id"]
        if not tutor_user_id or tutor_user_id == student.id:
            continue

        await send_notification(
            topic=build_tutor_student_activity_started_topic(
                tutor_user_id=tutor_user_id,
                course_uuid=course.course_uuid,
                student_uuid=student.user_uuid,
                room_uuid=target["room_uuid"],
            ),
            title="Student started activity",
            body=f'{student_name} started "{activity.name}" in {course.name}.',
            level="info",
            data={
                "kind": "student_activity_started",
                "course_id": course.id,
                "course_uuid": course.course_uuid,
                "course_name": course.name,
                "activity_id": activity.id,
                "activity_uuid": activity.activity_uuid,
                "activity_name": activity.name,
                "student_id": student.id,
                "student_uuid": student.user_uuid,
                "student_name": student_name,
                "room_id": target["room_id"],
                "room_uuid": target["room_uuid"],
            },
            user_id=tutor_user_id,
        )


async def notify_tutors_student_activity_completed(
    *,
    notification_targets: Iterable[TutorStudentActivityCompletedNotificationTarget],
    student: PublicUser | User,
    activity: Activity,
    course: Course,
) -> None:
    student_name = _display_name(student)
    emitted = False

    # TODO: FAT FOLLOW-UP
    # Course rooms do not have a persisted UUID column yet, so `room_uuid`
    # currently comes from a synthetic identifier derived from `room_id`.
    # We also intentionally emit one notification per room membership instead
    # of deduplicating by tutor. If a student belongs to multiple rooms at the
    # same time, the same tutor can receive multiple notifications for one
    # activity completion. Keep this behavior for now so the frontend can
    # throttle or aggregate without losing room context. Revisit this once
    # course rooms have real UUIDs and deduplication rules are defined.
    for target in notification_targets:
        tutor_user_id = target["tutor_user_id"]
        if not tutor_user_id or tutor_user_id == student.id:
            continue

        emitted = True
        await send_notification(
            topic=build_tutor_student_activity_completed_topic(
                tutor_user_id=tutor_user_id,
                course_uuid=course.course_uuid,
                student_uuid=student.user_uuid,
                room_uuid=target["room_uuid"],
            ),
            title="Student completed activity",
            body=f'{student_name} completed "{activity.name}" in {course.name}.',
            level="success",
            data={
                "kind": "student_activity_completed",
                "course_id": course.id,
                "course_uuid": course.course_uuid,
                "course_name": course.name,
                "activity_id": activity.id,
                "activity_uuid": activity.activity_uuid,
                "activity_name": activity.name,
                "student_id": student.id,
                "student_uuid": student.user_uuid,
                "student_name": student_name,
                "room_id": target["room_id"],
                "room_uuid": target["room_uuid"],
            },
            user_id=tutor_user_id,
        )

    if not emitted:
        return


__all__ = [
    "build_notification",
    "build_tutor_student_activity_completed_topic",
    "build_tutor_student_activity_started_topic",
    "build_system_event",
    "notify_all",
    "notify_tutors_student_activity_started",
    "notify_tutors_student_activity_completed",
    "notify_user",
    "notify_users",
    "send_notification",
    "start_notifications",
    "stop_notifications",
]
