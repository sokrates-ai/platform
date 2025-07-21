import asyncio
import atexit
import random
import string
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import List

import requests
from playwright.sync_api import sync_playwright

# CONFIGURABLE GLOBALS
NUM_USERS = 10  # Number of users to create
CONCURRENT_THREADS = 5  # Number of concurrent threads for creation/login

# HARDCODED VALUES (replace with real values as needed)
BASE="http://localhost:3000"
API_BASE = "http://localhost:1338/api/v1"
ORG_ID = 'default'  # Set your org id here
INVITE_CODE = "0gnUj"  # Set your invite code here
ADMIN_EMAIL = "admin@school.dev"
ADMIN_PASSWORD = "06uKPg1L"  # Set your admin password here

# User prefix
USER_PREFIX = "load_test"
USER_PASSWORD = "testpassword123"

# Store created user info for cleanup
created_users = []


def random_name():
    return ''.join(random.choices(string.ascii_lowercase, k=6))


def create_user(idx):
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
        print(f"Failed to create user {username}: {r.text}")
    created_users.append({"username": username, "email": email})
    return username, email


def delete_user(user, admin_token):
    # Lookup user_id by username
    url = f"{API_BASE}/orgs/{ORG_ID}/users"
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        print(f"[CLEANUP] Failed to list org users: {r.text}")
        return
    users = r.json()
    user_id = None
    for org_user in users:
        # org_user['user']['username']
        if org_user['user']['username'] == user['username']:
            user_id = org_user['user']['id']
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
        print(f"[CLEANUP] Failed to delete user {user['username']} (id={user_id}): {del_r.text}")


def get_admin_token():
    url = f"{API_BASE}/auth/login"
    data = {"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    r = requests.post(url, data=data)
    if r.status_code == 200:
        return r.json()["tokens"]["access_token"]
    else:
        print(r.text)
        print("Failed to get admin token", r.text)
        return None


def login_with_playwright(username, password):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        # browser = playwright.firefox.launch(headless=False)  # Set headless=True for headless mode

        page = browser.new_page()
        # Adjust login URL and selectors as needed
        page.goto(f"{BASE}/login?orgslug=default")
        page.fill('input[name="email"]', username + "@example.com")
        page.fill('input[name="password"]', password)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2000)  # Wait for login to process
        print(f"Logged in with {username}")
        browser.close()


def main():
    # Create users concurrently
    with ThreadPoolExecutor(max_workers=CONCURRENT_THREADS) as executor:
        futures = [executor.submit(create_user, i) for i in range(NUM_USERS)]
        for f in futures:
            f.result()

    # Login with each user using Playwright
    with ThreadPoolExecutor(max_workers=CONCURRENT_THREADS) as executor:
        futures = [executor.submit(login_with_playwright, u["username"], USER_PASSWORD) for u in created_users]
        for f in futures:
            f.result()

    print("All users created and logged in.")


def cleanup():
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