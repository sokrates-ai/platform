# Allow tutors to add students to their selected room

## Context

On the tutor page (`/dash/courses/course/[courseuuid]/tutor`), a tutor selects a room and sees
count pills ("N Students" / "N Tutors") at the top of `SelectedRoomPanel`. Today a tutor has no
way to add students to their room — only the admin-side `ManageCourseRooms` can edit membership,
and that path requires course-level RBAC that tutors don't have.

This change adds a button next to the count pills that opens a dialog where a tutor can search
(fuzzy) the course's enrolled students and add one or more to their currently selected room.

**Product decisions (confirmed):**
- Candidate pool = students **enrolled in the course** (have a `TrailRun`) with the student role,
  **excluding** those already in the selected room. They may already belong to another room.
- Adding is **non-exclusive** — a student can be in multiple rooms; we just insert a membership.

## Backend (FastAPI — `apps/api`)

The existing `POST /{course_uuid}/rooms/{room_id}/members/add` uses generic course `"update"` RBAC
(`add_course_room_members` → `get_course_by_uuid(..., "update")`) which tutors do not pass. So we add
**tutor-scoped** endpoints that reuse the room-scoped auth helpers in
`src/services/courses/tutor_room_selection.py`:
`get_course_and_role_flags(...)` + `ensure_user_can_manage_room(room_id, ...)` (verifies the caller
is a tutor member of that specific room, or admin/maintainer).

Add two service functions in `src/services/courses/tutor_room_selection.py`:

1. `list_available_room_students(request, course_uuid, room_id, current_user, db_session) -> List[UserRead]`
   - `course, role_flags = get_course_and_role_flags(...)`; `room = ensure_user_can_manage_room(...)`.
   - Enrolled students: `select(User).join(TrailRun).where(TrailRun.course_id == course.id)`
     (pattern from `src/services/courses/students.py::list_course_students`).
   - Filter to student org-role by joining `UserOrganization`/`Role` on `course.org_id`
     (`role_uuid == "role_global_student"` or `id == 3`), mirroring
     `ensure_user_role_for_room` in `src/services/courses/rooms.py`.
   - Exclude user_ids already in this room:
     `select(CourseRoomMember.user_id).where(CourseRoomMember.room_id == room.id)`.
   - Return `List[UserRead]` (`from src.db.users import UserRead`).

2. `add_room_students(request, course_uuid, room_id, user_ids: str, current_user, db_session) -> str`
   - Same tutor-scoped auth as above.
   - `parse_user_ids` (import from `src.services.courses.rooms`) → for each: call
     `ensure_user_role_for_room(user_id, course, RoomRoleEnum.student, db_session)`, then upsert a
     `CourseRoomMember` with `role=student` (skip if already present) — same upsert body as
     `add_course_room_members` (`rooms.py:420-444`). Role is forced to `student`.

Add two routes in `src/routers/courses/courses.py` (next to the existing room routes ~line 583-632),
thin wrappers passing `current_user = Depends(get_current_user)`, `db_session = Depends(get_db_session)`:
- `GET  /{course_uuid}/rooms/{room_id}/available-students` → `list_available_room_students`
- `POST /{course_uuid}/rooms/{room_id}/students/add?user_ids=<csv>` → `add_room_students`

## Frontend (`apps/web`)

### Service functions — `services/courses/rooms.ts`
Add two functions mirroring the existing `getCourseRoomMembers` / `addCourseRoomMembers` style:
- `getAvailableRoomStudents(course_uuid, room_id, access_token)` → GET `.../rooms/{room_id}/available-students`.
- `addRoomStudents(course_uuid, room_id, user_ids, access_token)` → POST
  `.../rooms/{room_id}/students/add?user_ids=<ids>` (reuse the `RoomMemberIds` join pattern).
(The dialog fetches the candidate list via SWR with `swrFetcher`; `addRoomStudents` is used for the write.)

### Fuzzy search util — new `services/utils/ts/fuzzySearch.ts`
No fuzzy lib exists in the repo. Add a small dependency-free matcher: subsequence match + score
(exact/prefix/word-boundary boosts) over a user's `first_name last_name username email` haystack.
Export `fuzzyFilter(query, items, getText, limit)` returning the top-`limit` matches sorted by score;
empty query returns the first `limit` items. Used with `limit = 10`.

### New component — `.../tutor/AddStudentsDialog.tsx`
Reuse the app's `Modal` wrapper (`components/Objects/StyledElements/Modal/Modal.tsx`) + shadcn
`Input` (`components/ui/input.tsx`), following `RoomMembersManager` in
`components/Dashboard/Pages/Course/ManageCourseRooms/ManageCourseRooms.tsx` as prior art.

Props: `courseUuid`, `roomId`, `accessToken`, `onStudentsAdded` (callback).
Behavior:
- `useSWR('courses/${courseUuid}/rooms/${roomId}/available-students', swrFetcher-with-token)` for candidates
  (data shape `UserRead[]`: `{ id, user_uuid, username, first_name?, last_name?, email? }`).
- Search `Input`; run `fuzzyFilter(query, available, textOf, 10)` → render top 10 as selectable rows
  (checkbox/toggle) tracked in a `Set<number>` of selected user ids.
- **Placeholders:** if `available.length === 0` → "No students available to add." If filtered result is
  empty (non-empty query) → "No students match your search."
- Footer "Add" button → `addRoomStudents(courseUuid, roomId, [...selected], accessToken)`; on success
  close dialog, clear selection, and call `onStudentsAdded()`.

### Wire into the pills row — `.../tutor/page.tsx` (~lines 1520-1529, `SelectedRoomPanel`)
Add an "Add students" button next to the count pills that opens `AddStudentsDialog`.
`SelectedRoomPanel` must receive `courseUuid`, `accessToken`, and the members/rooms `mutate`
functions (passed from `TutorCourseLayout`, which already holds them). `onStudentsAdded` should
`mutate` both SWR keys so pills + member list refresh:
- members: `courses/${courseUuid}/rooms/${room.id}/members`
- rooms (count pills): `courses/${courseUuid}/rooms/manageable`  ← note: the tutor page uses
  `manageable`, not `rooms`.

## Verification

1. Backend: run the API and hit
   `GET /api/v1/courses/{uuid}/rooms/{id}/available-students` as a tutor of that room — expect enrolled
   students not in the room; as a tutor of a *different* room expect 403 (`ensure_user_can_manage_room`).
   Then `POST .../rooms/{id}/students/add?user_ids=<id>` and confirm a `CourseRoomMember` (role=student)
   is inserted and the student disappears from the available list.
2. Frontend: log in as a tutor, open
   `/dash/courses/course/cbca76a9-735d-4917-ac66-e52f03971688/tutor`, select the room, click
   "Add students". Verify: fuzzy search narrows results, at most 10 shown, both placeholders appear
   (empty pool / no match), adding a student updates the "N Students" pill and the member list without reload.
3. Confirm a non-tutor / anonymous user cannot call the endpoints (403).
