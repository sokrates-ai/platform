# Sokrates

Sokrates is a learning platform with a FastAPI backend and a Next.js frontend.

## High-Level Architecture

- **Frontend (Next.js 14)**: Browser UI, session handling (NextAuth), and real-time notifications via WebSocket.
- **Backend (FastAPI)**: REST API, auth, business logic, DB access, and WebSocket notification service.
- **Database**: SQL database via SQLModel.
- **Redis (optional)**: Used for caching and cross-instance notification fanout.

### Notification System (WebSocket)

- **WebSocket endpoint**: `/api/v1/notifications/ws`
- **Auth**: JWT access token (query param `token`, Authorization header, or cookie).
- **Topics**: MQTT-style topics with `+` (single level) and `#` (multi-level) wildcards.
- **Flow**:
  1. Client connects with access token.
  2. Backend validates token and associates socket with user + topic subscriptions.
  3. Messages are pushed to connected users; Redis pubsub fans out across instances if configured.
  4. Client displays notifications as toasts and auto-reconnects on drop.

#### Topics & Subscriptions

- Notification payloads include a `topic` field (default `broadcast`).
- Admin broadcast endpoint accepts a `topic` field to target subscribers.
- The frontend subscribes to topics on connect (see `WebSocketNotifications.tsx`).
- Subscription logic is handled on the frontend; the backend only filters based on topic matches.
- To move subscription logic to the backend, ignore client subscription messages and set server-side defaults per user/session.
- Default frontend subscriptions: `broadcast` and `user/<id>`.
- You can pass initial topics via query param: `?topics=broadcast,user/123`.
- You can update subscriptions after connect by sending a JSON message:
  - `{"type": "subscribe", "topics": ["org/123"]}`
  - `{"type": "unsubscribe", "topics": ["org/123"]}`
  - `{"type": "set_subscriptions", "topics": ["broadcast", "user/123"]}`

#### Tutor Activity Notifications

- The backend emits tutor-scoped notifications when a student starts an activity and when a student completes an activity for the first time.
- These notifications are room-aware and are sent once per student room membership at the time of the state change.
- If a student is in two rooms at the same time, two notifications are emitted. This is intentional for now so the frontend can later throttle or aggregate without losing room context.
- Current topic shapes:
  - `user/<tutor_id>/courses/<course_uuid>/students/<student_uuid>/rooms/<room_uuid>/activity-started`
  - `user/<tutor_id>/courses/<course_uuid>/students/<student_uuid>/rooms/<room_uuid>/activity-completed`
- Notification payloads include `room_id` and `room_uuid` in `data`.
- `room_uuid` is currently synthetic and derived from the numeric room id as `course_room_<room_id>`, because `course_room` does not yet have a persisted UUID column.
- The backend now emits these notifications, but the frontend still needs to subscribe to the corresponding topic subtree before tutors will see them.
- Implementation lives in:
  - Backend notifier: `apps/api/src/services/notifications/service.py`
  - Emission hook: `apps/api/src/services/trail/trail.py`
  - Future tutor subscription handler: `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/tutor/page.tsx`

## Key Files and Responsibilities

### Backend (FastAPI)

- `apps/api/app.py`: App entry, middleware, static mounts.
- `apps/api/src/router.py`: API router wiring.
- `apps/api/src/core/events/events.py`: Startup/shutdown hooks.
- `apps/api/src/security/auth.py`: JWT auth helpers.
- `apps/api/src/security/security.py`: JWT secrets/algorithms.
- `apps/api/src/routers/notifications.py`: WebSocket notifications endpoint.
- `apps/api/src/services/notifications/manager.py`: Connection manager + keepalive pings.
- `apps/api/src/services/notifications/broker.py`: Redis pubsub fanout.
- `apps/api/src/services/notifications/models.py`: Notification payload schema.
- `apps/api/src/services/notifications/service.py`: Public notification helpers (`notify_user`, etc.).

### Frontend (Next.js)

- `apps/web/app/layout.tsx`: Global providers + Toaster + WebSocket client.
- `apps/web/components/Notifications/WebSocketNotifications.tsx`: WebSocket client, reconnection, toast rendering.
- `apps/web/services/config/config.ts`: API/WS URL helpers.
- `apps/web/components/ui/toaster.tsx`: Toast container.
- `apps/web/hooks/use-toast.ts`: Toast API.

### Config & Tooling

- `apps/api/config/config.py`: Backend config loading.
- `apps/api/pyproject.toml`: Backend deps.
- `apps/web/package.json`: Frontend deps.
- `dev.env`: Local environment template.

## Testing

### Backend tests

- Run the full backend test suite:

```bash
cd apps/api
PYTHONPATH=. poetry run pytest src/tests
```

- Run a single backend test file:

```bash
cd apps/api
PYTHONPATH=. poetry run pytest src/tests/test_trail_tutor_verification.py
```

- Run lint checks after larger backend/frontend changes:

```bash
make lint
```

## Default credentials (dev)

- Email: admin@school.dev
- Password: admin
