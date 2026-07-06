#!/usr/bin/env python3
"""
Simulate fake user interaction for the course analytics feature.

Flow (all via the real API):
  1. Log in as admin.
  2. Ensure the course has chapters + activities to complete ("tasks").
  3. For each fake user: log in, ensure a trail, enroll in the course, then
     complete a random subset of the activities (POST /trail/add_activity).
  4. Admin adds the fake users to course rooms as students so their
     completions show up in the room activity-status endpoint the analytics
     dashboard reads from.

This is meant for a local dev instance and seeds throw-away data.
"""
import argparse
import random
from typing import Dict, List, Optional

import requests

API_BASE = "http://localhost:1338/api/v1"
ORG_ID = 1
ORG_SLUG = "default"

ADMIN_EMAIL = "admin@school.dev"
ADMIN_PASSWORD = "AdminFake123!"  # reset in dev DB

USER_PASSWORD = "testpassword123"

# Content to create if the course has no activities. Each tuple is
# (chapter name, [activity names]). Chapters alternate across course tabs.
CONTENT = [
    ("Introduction", ["Welcome quiz", "Read syllabus", "Intro exercise"]),
    ("Fundamentals", ["Variables task", "Loops task", "Functions task"]),
]


def login(email: str, password: str) -> Optional[str]:
    r = requests.post(
        f"{API_BASE}/auth/login",
        data={"username": email, "password": password},
        timeout=20,
    )
    if r.status_code != 200:
        print(f"Login failed for {email}: {r.status_code} {r.text}")
        return None
    return r.json()["tokens"]["access_token"]


def h(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def get_course(token: str) -> Optional[dict]:
    r = requests.get(
        f"{API_BASE}/courses/org_slug/{ORG_SLUG}/page/1/limit/1", headers=h(token)
    )
    r.raise_for_status()
    courses = r.json()
    return courses[0] if courses else None


def get_course_meta(token: str, course_uuid: str) -> dict:
    r = requests.get(f"{API_BASE}/courses/{course_uuid}/meta", headers=h(token))
    r.raise_for_status()
    return r.json()


def list_activities(token: str, course_uuid: str) -> List[dict]:
    """Return [{activity_uuid, name, chapter_name}] for every activity."""
    meta = get_course_meta(token, course_uuid)
    out: List[dict] = []
    for chapter in meta.get("chapters", []):
        cname = chapter.get("name", "")
        for act in chapter.get("activities", []):
            out.append(
                {
                    "activity_uuid": act["activity_uuid"],
                    "name": act.get("name", ""),
                    "chapter_name": cname,
                }
            )
    return out


def ensure_content(token: str, course: dict) -> List[dict]:
    course_uuid = course["course_uuid"]
    course_id = course["id"]
    existing = list_activities(token, course_uuid)
    if existing:
        print(f"Course already has {len(existing)} activities; reusing them.")
        return existing

    tabs = [t["tab_uuid"] for t in get_course_meta(token, course_uuid).get("tabMetadata", [])]
    print(f"No activities found. Creating content across {len(tabs) or 1} tab(s).")

    for i, (chapter_name, activity_names) in enumerate(CONTENT):
        tab_uuid = tabs[i % len(tabs)] if tabs else None
        payload = {
            "name": chapter_name,
            "org_id": ORG_ID,
            "course_id": course_id,
        }
        if tab_uuid:
            payload["tab_uuid"] = tab_uuid
        r = requests.post(f"{API_BASE}/chapters/", json=payload, headers=h(token))
        if r.status_code != 200:
            print(f"  chapter '{chapter_name}' failed: {r.status_code} {r.text}")
            continue
        chapter_id = r.json()["id"]
        print(f"  chapter '{chapter_name}' (id={chapter_id})")
        for act_name in activity_names:
            ar = requests.post(
                f"{API_BASE}/activities/",
                json={
                    "name": act_name,
                    "chapter_id": chapter_id,
                    "org_id": ORG_ID,
                    "course_id": course_id,
                    "activity_type": "TYPE_DYNAMIC",
                    "activity_sub_type": "SUBTYPE_DYNAMIC_PAGE",
                    "published": True,
                    "content": {},
                },
                headers=h(token),
            )
            if ar.status_code != 200:
                print(f"    activity '{act_name}' failed: {ar.status_code} {ar.text}")
            else:
                print(f"    activity '{act_name}' ({ar.json()['activity_uuid']})")
    return list_activities(token, course_uuid)


def ensure_trail(token: str) -> None:
    r = requests.get(f"{API_BASE}/trail/org/{ORG_ID}/trail", headers=h(token))
    if r.status_code == 200:
        return
    requests.post(
        f"{API_BASE}/trail/start", json={"org_id": ORG_ID, "user_id": 0}, headers=h(token)
    )


def enroll(token: str, course_uuid: str) -> None:
    requests.post(f"{API_BASE}/trail/add_course/{course_uuid}", headers=h(token))


def complete_activity(token: str, activity_uuid: str) -> bool:
    r = requests.post(f"{API_BASE}/trail/add_activity/{activity_uuid}", headers=h(token))
    return r.status_code == 200


def org_user_id_by_email(admin_token: str, email: str) -> Optional[int]:
    r = requests.get(f"{API_BASE}/orgs/{ORG_ID}/users", headers=h(admin_token))
    r.raise_for_status()
    for ou in r.json():
        user = ou.get("user") or {}
        if user.get("email") == email:
            return user.get("id")
    return None


def list_rooms(token: str, course_uuid: str) -> List[dict]:
    r = requests.get(f"{API_BASE}/courses/{course_uuid}/rooms", headers=h(token))
    r.raise_for_status()
    return r.json()


def add_room_member(admin_token: str, course_uuid: str, room_id: int, user_id: int) -> bool:
    r = requests.post(
        f"{API_BASE}/courses/{course_uuid}/rooms/{room_id}/members/add",
        params={"user_ids": str(user_id), "role": "student"},
        headers=h(admin_token),
    )
    return r.status_code == 200


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--emails", nargs="+", required=True, help="Fake user emails.")
    parser.add_argument("--min-tasks", type=int, default=2)
    parser.add_argument("--max-tasks", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    random.seed(args.seed)

    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        return 1

    course = get_course(admin_token)
    if not course:
        print("No course found in org.")
        return 1
    course_uuid = course["course_uuid"]
    print(f"Course: {course.get('name')} ({course_uuid})")

    activities = ensure_content(admin_token, course)
    if not activities:
        print("No activities available to complete.")
        return 1
    print(f"Total activities available: {len(activities)}")

    rooms = list_rooms(admin_token, course_uuid)
    print(f"Rooms: {[(r['id'], r['name']) for r in rooms]}")

    total_completions = 0
    for idx, email in enumerate(args.emails):
        token = login(email, USER_PASSWORD)
        if not token:
            continue
        ensure_trail(token)
        enroll(token, course_uuid)

        # Put user in a room (round-robin) so analytics picks them up.
        uid = org_user_id_by_email(admin_token, email)
        room = rooms[idx % len(rooms)] if rooms else None
        if uid and room:
            add_room_member(admin_token, course_uuid, room["id"], uid)

        k = random.randint(args.min_tasks, min(args.max_tasks, len(activities)))
        chosen = random.sample(activities, k)
        done = [a["name"] for a in chosen if complete_activity(token, a["activity_uuid"])]
        total_completions += len(done)
        room_label = room["name"] if room else "-"
        print(f"{email} (id={uid}, room={room_label}): completed {len(done)} -> {done}")

    print(f"\nDone. {total_completions} total activity completions recorded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
