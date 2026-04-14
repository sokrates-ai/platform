#!/usr/bin/env python3
import argparse
import csv
import json
import random
import string
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests


def random_name(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_lowercase, k=length))

GERMAN_FIRST_NAMES = [
    "Anna",
    "Ben",
    "Clara",
    "Christoph",
    "David",
    "Emilia",
    "Felix",
    "Greta",
    "Hannah",
    "Jonas",
    "Lilly",
    "Lukas",
    "Marie",
    "Mia",
    "Noah",
    "Paul",
    "Sophie",
    "Lea",
    "Lena",
    "Leon",
    "Luis",
    "Tim",
]

GERMAN_LAST_NAMES = [
    "Mueller",
    "Schmidt",
    "Schneider",
    "Fischer",
    "Weber",
    "Meyer",
    "Wagner",
    "Becker",
    "Schulz",
    "Hoffmann",
    "Schaefer",
    "Koch",
    "Bauer",
    "Richter",
    "Klein",
    "Wolf",
    "Schroeder",
    "Neumann",
    "Schwarz",
    "Zimmermann",
]

DEFAULT_TUTOR_ROLE_UUID = "role_global_tutor"

EXTRA_TUTORS = [
    {"first_name": "Lilly", "last_name": "Freytag"},
    {"first_name": "Christoph", "last_name": "Reh"},
]


def normalize_username(value: str) -> str:
    normalized = value.lower()
    normalized = (
        normalized.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    return "".join(ch for ch in normalized if ch.isalnum() or ch in {".", "_", "-"})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bulk-create users via the Sokrates API."
    )
    parser.add_argument("--api-base", default="http://localhost:1338/api/v1")
    parser.add_argument("--org-id", type=int, default=1)
    parser.add_argument("--invite-code", default="")
    parser.add_argument("--no-org", action="store_true", help="Use /users without org.")
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--prefix", default="")
    parser.add_argument("--email-domain", default="example.com")
    parser.add_argument("--password", default="testpassword123")
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument(
        "--csv",
        type=Path,
        help="CSV with username,email,first_name,last_name,password,role_uuid",
    )
    parser.add_argument("--output", type=Path, help="Write created users to JSON file.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--auth-email", default="", help="Optional admin/user email for auth.")
    parser.add_argument("--auth-password", default="", help="Password for auth-email.")
    return parser.parse_args()


def build_create_url(api_base: str, org_id: int, invite_code: str, no_org: bool) -> str:
    if no_org:
        return f"{api_base}/users"
    if invite_code:
        return f"{api_base}/users/{org_id}/invite/{invite_code}"
    return f"{api_base}/users/{org_id}"


def load_users_from_csv(csv_path: Path, email_domain: str, default_password: str) -> List[Dict[str, str]]:
    users: List[Dict[str, str]] = []
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            username = (row.get("username") or "").strip()
            if not username:
                raise ValueError("CSV row missing username.")
            email = (row.get("email") or "").strip() or f"{username}@{email_domain}"
            user: Dict[str, str] = {
                "username": username,
                "email": email,
                "first_name": (row.get("first_name") or "").strip(),
                "last_name": (row.get("last_name") or "").strip(),
                "password": (row.get("password") or "").strip() or default_password,
            }
            role_uuid = (row.get("role_uuid") or "").strip()
            if role_uuid:
                user["role_uuid"] = role_uuid
            users.append({**user})
    return users


def generate_users(
    count: int,
    start: int,
    prefix: str,
    email_domain: str,
    default_password: str,
) -> List[Dict[str, str]]:
    users: List[Dict[str, str]] = []
    prefix_value = normalize_username(prefix)
    if prefix_value and not prefix_value.endswith((".", "_", "-")):
        prefix_value = f"{prefix_value}."
    for idx in range(start, start + count):
        first_name = random.choice(GERMAN_FIRST_NAMES)
        last_name = random.choice(GERMAN_LAST_NAMES)
        base_username = f"{first_name}.{last_name}"
        username = normalize_username(f"{prefix_value}{base_username}{idx}")
        users.append(
            {
                "username": username,
                "email": f"{username}@{email_domain}",
                "first_name": first_name,
                "last_name": last_name,
                "password": default_password,
            }
        )
    return users


def add_extra_tutors(users: List[Dict[str, str]], email_domain: str, default_password: str) -> None:
    existing_usernames = {user["username"] for user in users}
    for tutor in EXTRA_TUTORS:
        base_username = normalize_username(f"{tutor['first_name']}.{tutor['last_name']}")
        if base_username in existing_usernames:
            continue
        users.append(
            {
                "username": base_username,
                "email": f"{base_username}@{email_domain}",
                "first_name": tutor["first_name"],
                "last_name": tutor["last_name"],
                "password": default_password,
                "role_uuid": DEFAULT_TUTOR_ROLE_UUID,
            }
        )
        existing_usernames.add(base_username)


def get_auth_token(api_base: str, email: str, password: str) -> Optional[str]:
    if not email or not password:
        return None
    response = requests.post(
        f"{api_base}/auth/login",
        data={"username": email, "password": password},
        timeout=20,
    )
    if response.status_code != 200:
        print(f"Auth failed: {response.status_code} {response.text}")
        return None
    try:
        return response.json()["tokens"]["access_token"]
    except Exception:
        print("Auth response missing access token:", response.text)
        return None


def find_user_id_by_username(api_base: str, org_id: int, username: str, headers: Dict[str, str]) -> Optional[int]:
    response = requests.get(f"{api_base}/orgs/{org_id}/users", headers=headers, timeout=30)
    if response.status_code != 200:
        return None
    try:
        users = response.json()
    except Exception:
        return None
    for org_user in users:
        user = org_user.get("user") if isinstance(org_user, dict) else None
        if not user:
            continue
        if user.get("username") == username:
            return user.get("id")
    return None


def update_user_role_by_id(
    api_base: str,
    org_id: int,
    user_id: int,
    role_uuid: str,
    headers: Dict[str, str],
) -> Dict[str, str | bool]:
    role_url = f"{api_base}/orgs/{org_id}/users/{user_id}/role/{role_uuid}"
    role_response = requests.put(role_url, headers=headers, timeout=30)
    if role_response.status_code == 200:
        return {"ok": True, "detail": ""}
    return {"ok": False, "detail": f"{role_response.status_code} {role_response.text}"}


def create_user(
    url: str,
    user: Dict[str, str],
    headers: Dict[str, str],
    dry_run: bool,
    api_base: str,
    org_id: int,
    no_org: bool,
) -> Dict[str, str]:
    if dry_run:
        return {"username": user["username"], "status": "dry-run", "detail": ""}
    payload = {
        key: value
        for key, value in user.items()
        if key in {"username", "email", "first_name", "last_name", "password"}
    }
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    if response.status_code == 200:
        role_uuid = user.get("role_uuid")
        if role_uuid:
            if no_org:
                return {
                    "username": user["username"],
                    "status": "failed",
                    "detail": "Created but role update failed: role updates require org context.",
                }
            if not headers.get("Authorization"):
                return {
                    "username": user["username"],
                    "status": "failed",
                    "detail": "Created but role update failed: missing auth token.",
                }
            try:
                payload = response.json()
            except Exception:
                payload = {}
            user_id = payload.get("id")
            if not user_id:
                return {
                    "username": user["username"],
                    "status": "failed",
                    "detail": "Created but role update failed: missing user id in response.",
                }
            role_update = update_user_role_by_id(api_base, org_id, user_id, role_uuid, headers)
            if not role_update["ok"]:
                return {
                    "username": user["username"],
                    "status": "failed",
                    "detail": f"Created but role update failed: {role_update['detail']}",
                }
        return {"username": user["username"], "status": "created", "detail": ""}
    role_uuid = user.get("role_uuid")
    if role_uuid and not no_org:
        if not headers.get("Authorization"):
            return {
                "username": user["username"],
                "status": "failed",
                "detail": "Role update failed: missing auth token.",
            }
        existing_user_id = find_user_id_by_username(api_base, org_id, user["username"], headers)
        if existing_user_id:
            role_update = update_user_role_by_id(api_base, org_id, existing_user_id, role_uuid, headers)
            if role_update["ok"]:
                return {
                    "username": user["username"],
                    "status": "role-updated",
                    "detail": "Role updated for existing user.",
                }
            return {
                "username": user["username"],
                "status": "failed",
                "detail": f"Role update failed for existing user: {role_update['detail']}",
            }
    return {
        "username": user["username"],
        "status": "failed",
        "detail": f"{response.status_code} {response.text}",
    }


def run_bulk_create(
    users: Iterable[Dict[str, str]],
    url: str,
    headers: Dict[str, str],
    concurrency: int,
    dry_run: bool,
    api_base: str,
    org_id: int,
    no_org: bool,
) -> List[Dict[str, str]]:
    results: List[Dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(create_user, url, user, headers, dry_run, api_base, org_id, no_org)
            for user in users
        ]
        for future in as_completed(futures):
            results.append(future.result())
    return results


def main() -> int:
    args = parse_args()
    if args.concurrency < 1:
        print("Concurrency must be >= 1.")
        return 2

    if args.csv:
        users = load_users_from_csv(args.csv, args.email_domain, args.password)
    else:
        users = generate_users(args.count, args.start, args.prefix, args.email_domain, args.password)

    add_extra_tutors(users, args.email_domain, args.password)

    if args.no_org and any("role_uuid" in user for user in users):
        print("Role updates require org context. Remove --no-org or remove role_uuid users.")
        return 2

    url = build_create_url(args.api_base, args.org_id, args.invite_code, args.no_org)
    token = get_auth_token(args.api_base, args.auth_email, args.auth_password)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    if any("role_uuid" in user for user in users) and not headers:
        print("Warning: role updates require auth. Pass --auth-email/--auth-password to update tutor roles.")

    results = run_bulk_create(
        users,
        url,
        headers,
        args.concurrency,
        args.dry_run,
        args.api_base,
        args.org_id,
        args.no_org,
    )

    created = [r for r in results if r["status"] == "created"]
    role_updated = [r for r in results if r["status"] == "role-updated"]
    failed = [r for r in results if r["status"] == "failed"]
    dry = [r for r in results if r["status"] == "dry-run"]

    print(f"Users total: {len(results)}")
    print(f"Created: {len(created)}")
    print(f"Role-updated: {len(role_updated)}")
    print(f"Failed: {len(failed)}")
    print(f"Dry-run: {len(dry)}")

    if failed:
        print("Failures:")
        for entry in failed:
            print(f"- {entry['username']}: {entry['detail']}")

    if args.output:
        args.output.write_text(json.dumps(results, indent=2), encoding="utf-8")

    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
