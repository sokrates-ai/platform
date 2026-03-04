# Security Review Findings (Backend)

Date: 2026-03-04
Scope: backend code under `apps/api` (RBAC/authZ focus)

## 1) Unauthenticated progress endpoint allows forging progress for any user (Critical)
**Where**
- `apps/api/src/routers/trail.py:120-229`

**What’s wrong**
- `/api/v1/trail/ws_record_solution` has the auth dependency commented out and accepts `user_uuid` in the request body.
- The handler looks up the user by UUID and then calls `get_activity`, `create_task_log`, `add_activity_to_trail`, and `mark_activity_task_complete` as that user.

**Impact**
- Anyone (including anonymous callers) can mark tasks as complete for *any* user, inflate progress/coins/xp, and manipulate trail/assignment state.
- The function also fetches activity content by impersonating the victim user, which can disclose non‑public activity/task data.

**Evidence**
- `apps/api/src/routers/trail.py:120-229` (commented `user=Depends(get_current_user)` and direct use of `body.user_uuid`).

**Suggested fix**
- Require authentication, bind `user_uuid` to `current_user`, and enforce course/activity RBAC before any writes.

---

## 2) Tasks are publicly readable; delete is missing RBAC (High)
**Where**
- Public list/get endpoints: `apps/api/src/routers/courses/tasks.py:173-204`
- Task read services have no RBAC: `apps/api/src/services/courses/activities/workspaces.py:120-279`
- Delete without RBAC: `apps/api/src/services/courses/activities/workspaces.py:378-395`

**What’s wrong**
- `GET /api/v1/tasks/id/{id}` and `GET /api/v1/tasks/list/...` do not require authentication.
- `get_task` / `get_tasks` return task content without any course or org access checks.
- `delete_task` explicitly notes “TODO: protect this route a bit.” and does not run RBAC.

**Impact**
- Anonymous users can enumerate tasks (including prompts/solutions/test data) across private courses.
- Any authenticated user can delete tasks by ID, regardless of course/org membership.

**Evidence**
- `apps/api/src/routers/courses/tasks.py:173-204`
- `apps/api/src/services/courses/activities/workspaces.py:120-279`
- `apps/api/src/services/courses/activities/workspaces.py:378-395`

**Suggested fix**
- Require authentication for reads, and enforce per‑course RBAC before returning any task content or allowing deletion.

---

## 3) Block uploads/downloads bypass RBAC (High)
**Where**
- Image blocks: `apps/api/src/services/blocks/block_types/imageBlock/imageBlock.py:13-88`
- Video blocks: `apps/api/src/services/blocks/block_types/videoBlock/videoBlock.py:14-89`
- PDF blocks: `apps/api/src/services/blocks/block_types/pdfBlock/pdfBlock.py:14-89`

**What’s wrong**
- Block creation only checks that the activity exists; it does **not** verify that the caller has edit rights on the activity/course.
- Block retrieval (`get_*_block`) returns block metadata/content by UUID with **no** RBAC check.

**Impact**
- Any authenticated user can upload content to arbitrary activities if they know the `activity_uuid`.
- Any authenticated user can fetch media blocks from other courses by guessing or learning a `block_uuid`, leaking protected content.

**Suggested fix**
- Add RBAC checks against the activity/course for both create and read operations.

---

## 4) Trail endpoints allow access to courses/activities without enrollment (High)
**Where**
- Trail operations: `apps/api/src/services/trail/trail.py:237-499`
- Activity helper without RBAC: `apps/api/src/services/courses/activities/activities.py:121-138`

**What’s wrong**
- `add_activity_to_trail` and `add_course_to_trail` accept any `activity_uuid`/`course_uuid` and never verify that the user is enrolled or authorized for the course.
- These functions also attach `Course` objects into trail responses, leaking course metadata.
- The helper `get_activity_by_id_and_course` returns activity data without RBAC and is used when computing chapter completion.

**Impact**
- A student can add any course/activity to their trail and extract activity UUIDs and course metadata for courses they should not access.

**Suggested fix**
- Enforce course‑level RBAC/enrollment checks for every trail mutation and when hydrating course/activity data.

---

## 5) RBAC roles are not scoped to the resource’s org (High)
**Where**
- `apps/api/src/security/rbac/rbac.py:94-112`

**What’s wrong**
- Role lookup only checks which orgs the user belongs to, not the org of the *target resource*.
- As a result, any role with `action_*` rights grants access to all resources of that type across **all** orgs the user does **not** belong to (if they know UUIDs), because the authorization code never compares the resource’s `org_id` with the role’s `org_id`.

**Impact**
- Users with elevated permissions in one org can access/modify resources in another org, breaking tenant isolation.

**Suggested fix**
- Resolve the resource’s org from `element_uuid` and require the role to match that org (or be a global role explicitly allowed to span orgs).

---

## 6) Open map proxy can be abused for SSRF (Medium)
**Where**
- `apps/api/src/routers/map_proxy.py:74-170`

**What’s wrong**
- `GET /api/v1/mapProxy` proxies arbitrary `http(s)` URLs without authentication or allow‑listing.
- It retries with `verify=False` on SSL errors.

**Impact**
- Enables SSRF to internal services/metadata endpoints; can leak internal data or be used as a pivot.

**Suggested fix**
- Require authentication and restrict URLs to a known allow‑list (or block private IP ranges), and avoid `verify=False` fallbacks unless strictly necessary.

---

## Notes / Unreviewed Areas
- I focused on RBAC/enforcement gaps and endpoints that bypass authorization. I did not run dynamic tests or review all model fields for sensitive data exposure.
- Additional issues may exist in other routers/services not touched above.
