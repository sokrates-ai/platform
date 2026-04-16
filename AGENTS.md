# Repository Guidelines

## Project Structure & Module Organization
- `apps/api/`: FastAPI backend. Entry at `app.py`; main code in `src/`; DB migrations in `migrations/` with `alembic.ini`; runtime content in `content/`.
- `apps/web/`: Next.js 14 frontend. Routes in `app/`; shared UI in `components/`; helpers in `lib/`; static assets in `public/`; global styles in `styles/`.
- Root tooling/config: `dev.sh`, `Makefile`, `docker-compose-dev.yml`, `Dockerfile.api`, `Dockerfile.web`, plus env templates.

## Build, Test, and Development Commands
- `make setup`: Install backend/frontend deps (Poetry + pnpm) and start dev containers.
- `make api-dev`: Run the API locally (`poetry run python3 app.py`).
- `make web-dev`: Start the web dev server (`pnpm run dev`).
- `make lint`: Run frontend ESLint and backend Ruff; use this after large or sweeping code edits (e.g., when an agent modifies a big block).
- `make db`: Open a psql shell inside the dev database container.
- `docker compose -f docker-compose-dev.yml up -d`: Bring up dev services manually.

## Coding Style & Naming Conventions
- Python: 4-space indentation, type hints encouraged; lint with Ruff (`apps/api/pyproject.toml`).
- TypeScript/JavaScript: Prettier with single quotes, no semicolons, trailing commas (ES5) and Next.js ESLint rules (`apps/web/.prettierrc.yaml`, `apps/web/.eslintrc`).
- Tests follow `test_*.py` naming under `apps/api/src/tests/`.

## Testing Guidelines
- Backend tests use pytest in `apps/api/src/tests/`.
- Run: `cd apps/api && poetry run pytest`.
- Add tests alongside new API behavior; keep fixtures in `conftest.py`.

## Commit & Pull Request Guidelines
- Commit messages mostly follow conventional style (`feat:`, `fix:`, `chore:`) with short, scoped subjects; keep messages imperative and concise.
- Before PRs, open an issue or discussion as described in `CONTRIBUTING.md`.
- PRs should include a clear description, linked issue/discussion, and steps to reproduce/verify.

## Security & Configuration Tips
- Use `dev.env` locally and copy from `platform-secrets.env.template` / `workspace-secrets.env.template` for secrets.
- Never commit real credentials or production secrets.

## Warnings
- TrailStep verification uses `tutor_verified` and `ai_verified` enum fields with values `NONE`/`CORRECT`/`INCORRECT`. No migration was added, so DB schema and any clients expecting the legacy boolean verification field may need updates.
