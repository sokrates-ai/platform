# Codebase Cleanup Report

## Security Risks
- **Unsafe environment parsing enables code injection**  
  Reference: apps/api/config/config.py:120  
  Impact: Using `eval()` on `LEARNHOUSE_DEVELOPMENT_MODE` lets anyone controlling that environment variable execute arbitrary Python.  
  Recommendation: Replace `eval()` with explicit string-to-bool parsing (e.g. `distutils.util.strtobool`) and provide a safe default.

- **Default admin credentials ship in tooling**  
  Reference: apps/api/cli.py:60, load_test2/user_test.py:21  
  Impact: Both the installer and load test scripts hard-code production-like admin passwords/email, creating an instant compromise if scripts leak or run in shared environments.  
  Recommendation: Require credentials to be supplied via environment variables or prompts, and strip secrets from version control.

- **Automatic installer can recreate weak admin accounts**  
  Reference: apps/api/src/core/events/autoinstall.py:21  
  Impact: On startup, empty databases trigger `install(short=True)`, which reinstalls default data and the weak admin credentials above—opening a privilege-escalation path after resets.  
  Recommendation: Remove auto-install or gate it behind an explicit feature flag and prompt for secure credentials.

- **JWT config downgrades secrets and disables expiry**  
  Reference: apps/api/src/security/auth.py:21-26  
  Impact: `authjwt_secret_key` falls back to the literal string `"secret"` whenever “dev mode” is toggled, and `authjwt_access_token_expires` stores seconds as a float instead of a `timedelta`, so tokens may never expire.  
  Recommendation: Always load secrets from configuration, fail fast when missing, and pass a `timedelta` instance to the FastAPI-JWT Auth settings.

- **Password reset leaks credentials through URLs**  
  Reference: apps/web/services/auth/auth.ts:88, apps/api/src/routers/users.py:231  
  Impact: The frontend sends `new_password` as a query string, so logs, proxies, and analytics capture plaintext passwords; the backend endpoint also treats it as a query parameter.  
  Recommendation: Move all reset parameters into a JSON body over HTTPS and ensure sensitive values never enter the URL.

- **Embed sanitisation allows arbitrary attributes**  
  Reference: apps/web/components/Objects/Editor/Extensions/EmbedObjects/EmbedObjectsComponent.tsx:41-44  
  Impact: `DOMPurify` is configured with `ADD_ATTR: ['*']`, reinstating dangerous event attributes (`onload`, `onclick`) and enabling stored XSS.  
  Recommendation: Whitelist only the attributes you actually need (e.g. `src`, `allow`, `frameborder`) and rely on DOMPurify defaults for everything else.

- **Middleware sets cookies for .localhost only**  
  Reference: apps/web/middleware.ts:75-83  
  Impact: Production domains will never receive the `learnhouse_current_orgslug` cookie, breaking auth flows and forcing insecure fallbacks.  
  Recommendation: Derive the cookie domain dynamically from the request host, and default to no domain attribute in development.

## Reliability & Design Smells
- **Type coercion in config breaks falsy values**  
  Reference: apps/api/config/config.py:334-360  
  Impact: Wrapping strings like `"false"` with `bool()` always returns `True`, and `list(allowed_origins)` raises when the value is `None`. Ports also default to empty strings, causing `int('')` crashes.  
  Recommendation: Parse booleans/ints explicitly (e.g. `strtobool`, guarded `int()`), default `allowed_origins` to an empty list, and validate config via Pydantic.

- **Database schema mutates at import time**  
  Reference: apps/api/src/core/events/database.py:32-48  
  Impact: Importing the module triggers a recursive model import and `SQLModel.metadata.create_all`, so any script import can modify the production schema unexpectedly.  
  Recommendation: Move model discovery and migrations into startup hooks or migrations tooling, and leave module import side-effect free.

- **Async services block the event loop**  
  Reference: apps/api/src/services/users/users.py:37-116  
  Impact: Many `async def` handlers synchronously call `Session.exec` and `commit`, blocking the FastAPI event loop under load.  
  Recommendation: Either switch to SQLModel’s async engine/session or run these services synchronously behind `run_in_threadpool`.

- **Runtime configuration utilities rely on brittle hacks**  
  Reference: apps/web/services/config/config.ts:12-92  
  Impact: Dynamically rebuilding env var names (`'NEXT_PUBLIC_LEARNHOUSE_BASE_TOP_DOMAI' + N`) and returning `"error"` strings makes it easy to ship broken builds and leaks implementation details via `console.log`.  
  Recommendation: Standardise config loading (e.g. with Zod schemas), remove string-splicing hacks, and fail fast when required env vars are missing.

- **Middleware contains placeholder error handling**  
  Reference: apps/web/middleware.ts:149  
  Impact: `throw("This is broken")` will surface as a 500 with no context, making production diagnostics harder.  
  Recommendation: Replace placeholder exceptions with structured errors or redirects, and cover the path in tests.

## Redundant & Versioned Assets
- **Checked-in dependencies inflate the repo**  
  Reference: node_modules/.modules.yaml:1, apps/web/node_modules/.modules.yaml:1  
  Impact: Committed `node_modules` trees slow down clones and make dependency provenance opaque.  
  Recommendation: Delete these directories from source control and rely on lockfiles + CI installs.

- **Conflicting lockfiles**  
  Reference: apps/web/package-lock.json:1, apps/web/pnpm-lock.yaml:1  
  Impact: Maintaining both npm and pnpm locks guarantees drift and wasted builds.  
  Recommendation: Pick a single package manager (pnpm per root config) and remove the other lockfile.

- **Stale orchestration artefacts**  
  Reference: docker-compose.yml.old:1  
  Impact: An unmaintained compose file confuses operators and risks drift from supported deployments.  
  Recommendation: Archive or delete the legacy file once its contents are documented elsewhere.

- **Load-test scaffolding mixes prod credentials**  
  Reference: load_test2/user_test.py:1-140  
  Impact: The entire directory is bespoke tooling with hard-coded hosts and secrets, better suited for a private ops repo.  
  Recommendation: Move these scripts out of the main repo or gate them behind explicit opt-in configuration.

## Software Engineering Debt
- **Configuration is recomputed on every call**  
  Reference: apps/api/config/config.py:108, apps/api/src/services/dev/dev.py:5, apps/api/src/security/security.py:7  
  Impact: Each helper call reloads the YAML file and environment variables, so routine operations (JWT setup, feature gating) repeatedly hit the filesystem.  
  Recommendation: Cache the parsed configuration (e.g. module-level singleton or `functools.lru_cache`) and inject settings where needed.

- **Auth scaffolding is inconsistent and mostly dead code**  
  Reference: apps/api/src/security/auth.py:16, apps/api/src/security/auth.py:43-49  
  Impact: `OAuth2PasswordBearer` points at `/api/auth/login` even though the router lives under `/api/v1`, and the resulting dependency is never used; the `Token` models are also unused clutter.  
  Recommendation: Fix the token URL, wire the dependency into endpoints, or delete the unused scaffolding entirely.

- **Password hashing utilities are contradictory**  
  Reference: apps/api/src/security/security.py:5-17  
  Impact: A bcrypt `CryptContext` is initialised but the hashing helpers call `pbkdf2_sha256` directly, signalling drift and confusing maintainers about the real hash algorithm.  
  Recommendation: Standardise on one hashing strategy and delete any unused context setup.

- **User service is a 600+ line grab bag**  
  Reference: apps/api/src/services/users/users.py:1-600  
  Impact: Business logic, persistence, RBAC checks, and email side effects all live in one file, storing timestamps as `str(datetime.now())` (`apps/api/src/services/users/users.py:52-54`). The breadth makes it hard to reason about regressions or isolate unit tests.  
  Recommendation: Split the module into cohesive units (domain, persistence, API), adopt timezone-aware datetimes, and add targeted tests around each responsibility.

- **Production code still emits ad-hoc prints**  
  Reference: apps/api/src/core/events/database.py:28, apps/api/app.py:69  
  Impact: `print` statements leak internal paths and overwhelm logs, while bypassing structured logging and observability tooling.  
  Recommendation: Replace prints with the shared logger (or Python’s `logging` module) and gate noisy messages behind debug levels.

- **Type safety on the frontend is effectively disabled**  
  Reference: apps/web/services/auth/auth.ts:4-18  
  Impact: The response interface uses literal `'string'` types and the API functions accept `any`, so TypeScript cannot catch regressions or guide refactors.  
  Recommendation: Define real interfaces for responses/requests, remove `any`, and share types with the backend where possible.

- **Automated coverage is almost nonexistent**  
  Reference: apps/api/src/tests/test_main.py:1-49  
  Impact: Only two backend tests exist and they exercise a single happy-path GET, leaving critical logic (auth, billing, RBAC) untested.  
  Recommendation: Establish a baseline test suite (unit + integration) and wire it into CI so refactors have safety rails.
