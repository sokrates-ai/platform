---
name: dev-db-state
description: Local dev Postgres state — schema drift, admin credential, and how to seed fake analytics data
metadata:
  type: project
---

The local dev Postgres (`platform-db-1`, creds learnhouse/learnhouse, db `learnhouse`, port 5432) was built from SQLModel `create_all`, **not** alembic — there is no `alembic_version` table, so it drifts from the models. Running `alembic upgrade` would try to recreate existing tables. Apply schema changes with direct `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` matching the intended migration instead.

On 2026-07-06 the `trailstep` table was missing `completed_date` and `verified_date` (added in repo migration `c9a1b2d3e4f5`); I added them by hand so `POST /trail/add_activity` stopped 500ing.

Admin `admin@school.dev` (user id 1, sole author of the one course "foofofof") password was reset in the dev DB to `AdminFake123!` (pbkdf2_sha256 via passlib). Old scripts' `06uKPg1L` no longer works.

To seed fake analytics data: `load_test2/bulk_create_users.py --org-id 1` creates users (org has open signup, no invite code needed; drop `--no-org` or the auto-added tutors with role_uuid conflict). Then `load_test2/simulate_interaction.py --emails ...` creates chapters/activities, enrolls users, adds them to course rooms as students, and completes activities → trailsteps. The analytics dashboard reads completions from `courses/{uuid}/rooms/{firstRoomId}/activity-status` (only room members with role=student show). Shell is zsh — unquoted `$VAR` is NOT word-split; use `${=VAR}`.
