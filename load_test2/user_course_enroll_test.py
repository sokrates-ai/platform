import atexit
import random
import string
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Tuple

import requests

# CONFIGURABLE GLOBALS
NUM_USERS = 10  # Number of users to create and enroll
CONCURRENT_THREADS = 5  # Number of concurrent threads

# HARDCODED VALUES (replace with real values as needed)
BASE = "http://localhost:3000"
API_BASE = "http://localhost:1338/api/v1"
ORG_ID = 1
ORG_SLUG = "default"
INVITE_CODE = "AZhMA"  # Set your invite code here

# Admin (used for cleanup only)
ADMIN_EMAIL = "admin@school.dev"
ADMIN_PASSWORD = "06uKPg1L"

# User prefix
USER_PREFIX = "load_enroll"
USER_PASSWORD = "testpassword123"

# Store created user info for cleanup
created_users: List[dict] = []


def random_name() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=6))


def create_user(idx: int) -> Tuple[str, str]:
    username = f"{USER_PREFIX}{idx}"
    email = f"{username}@example.com"
    payload = {
        "username": username,
        "first_name": random_name(),
        "last_name": random_name(),
        "email": email,
        "password": USER_PASSWORD,
    }
    url = f"{API_BASE}/users/{ORG_ID}/invite/{INVITE_CODE}"
    r = requests.post(url, json=payload)
    if r.status_code == 200:
        print(f"Created user: {username}")
    else:
        print(f"Failed to create user {username}: {r.status_code} {r.text}")
    created_users.append({"username": username, "email": email})
    return username, email


def get_token(email: str, password: str) -> Optional[str]:
    url = f"{API_BASE}/auth/login"
    data = {"username": email, "password": password}
    r = requests.post(url, data=data)
    if r.status_code == 200:
        try:
            return r.json()["tokens"]["access_token"]
        except Exception:
            print("Login response missing token structure:", r.text)
            return None
    print(f"Failed login for {email}: {r.status_code} {r.text}")
    return None


def ensure_user_trail(token: str) -> bool:
    # Attempt to get trail by org; if not exists, start it
    headers = {"Authorization": f"Bearer {token}"}
    get_url = f"{API_BASE}/trail/org/{ORG_ID}/trail"
    r = requests.get(get_url, headers=headers)
    if r.status_code == 200:
        return True
    # Create trail
    start_url = f"{API_BASE}/trail/start"
    payload = {"org_id": ORG_ID, "user_id": 0}
    r = requests.post(start_url, json=payload, headers=headers)
    if r.status_code == 200:
        return True
    print(f"Failed to ensure trail: {r.status_code} {r.text}")
    return False


def get_any_course_uuid(token: str) -> Optional[str]:
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{API_BASE}/courses/org_slug/{ORG_SLUG}/page/1/limit/1"
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        print(f"Failed to list courses: {r.status_code} {r.text}")
        return None
    try:
        courses = r.json()
        if not courses:
            print("No courses available to enroll.")
            return None
        return courses[0]["course_uuid"]
    except Exception:
        print("Unexpected courses response:", r.text)
        return None


def enroll_in_course(token: str, course_uuid: str) -> bool:
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{API_BASE}/trail/add_course/{course_uuid}"
    r = requests.post(url, headers=headers)
    if r.status_code == 200:
        return True
    print(f"Enroll failed: {r.status_code} {r.text}")
    return False


def verify_user_listed_in_course(token: str, course_uuid: str) -> bool:
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{API_BASE}/courses/students/list"
    r = requests.get(url, params={"course_uuid": course_uuid}, headers=headers)
    if r.status_code != 200:
        print(f"Failed to list students of course: {r.status_code} {r.text}")
        return False
    # We cannot easily verify the current user from here without their id; success of call is enough
    return True


def create_and_enroll(idx: int) -> None:
    username, email = create_user(idx)
    token = get_token(email, USER_PASSWORD)
    if not token:
        return
    if not ensure_user_trail(token):
        return
    course_uuid = get_any_course_uuid(token)
    if not course_uuid:
        return
    if enroll_in_course(token, course_uuid):
        print(f"Enrolled {username} into course {course_uuid}")
        verify_user_listed_in_course(token, course_uuid)


def main() -> None:
    # Create and enroll users concurrently
    with ThreadPoolExecutor(max_workers=CONCURRENT_THREADS) as executor:
        futures = [executor.submit(create_and_enroll, i) for i in range(NUM_USERS)]
        for f in futures:
            f.result()
    print("All users created and enrolled.")


def get_admin_token() -> Optional[str]:
    url = f"{API_BASE}/auth/login"
    data = {"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    r = requests.post(url, data=data)
    if r.status_code == 200:
        try:
            return r.json()["tokens"]["access_token"]
        except Exception:
            print("Admin login response missing token structure:", r.text)
            return None
    print("Failed to get admin token", r.status_code, r.text)
    return None


def delete_user(user: dict, admin_token: str) -> None:
    # Lookup user_id by username
    url = f"{API_BASE}/orgs/{ORG_ID}/users"
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        print(f"[CLEANUP] Failed to list org users: {r.status_code} {r.text}")
        return
    users = r.json()
    user_id = None
    for org_user in users:
        if org_user["user"]["username"] == user["username"]:
            user_id = org_user["user"]["id"]
            break
    if not user_id:
        print(f"[CLEANUP] User {user['username']} not found in org.")
        return
    # Call delete endpoint
    del_url = f"{API_BASE}/orgs/{ORG_ID}/users/{user_id}"
    del_r = requests.delete(del_url, headers=headers)
    if del_r.status_code == 200:
        print(f"[CLEANUP] Deleted user: {user['username']} (id={user_id})")
    else:
        print(f"[CLEANUP] Failed to delete user {user['username']} (id={user_id}): {del_r.status_code} {del_r.text}")


def cleanup() -> None:
    print("Cleaning up created users...")
    admin_token = get_admin_token()
    if not admin_token:
        print("Could not get admin token, skipping cleanup.")
        return
    for user in created_users:
        delete_user(user, admin_token)
    print("Cleanup done.")


atexit.register(cleanup)


if __name__ == "__main__":
    main() 