# Collab Service (Hocuspocus + Redis)

## Development

Requirements:
- Node 18+
- Redis (e.g., `redis-server` on port 6379)

Install and run:
- `make collab-install`
- `make collab-dev`

Environment variables:
- `COLLAB_JWT_SECRET` (shared with API)
- `REDIS_URL` (e.g., `redis://localhost:6379`)
- `PORT` (default: `3001`)
- `PERSIST_DIR` (default: `apps/collab/data`)

Websocket endpoint:
- `ws://localhost:3001/collab` (proxied by your reverse proxy in deployment)

Health:
- `GET http://localhost:3002/healthz` (port is `PORT+1`)

Persistence:
- Documents are persisted on disk (append-compacted Yjs state update) under `PERSIST_DIR`.
- This enables restoring state across collab server restarts. 