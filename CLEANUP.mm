<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
  <node TEXT="Codebase Cleanup Report">
    <node TEXT="Security Risks">
      <node TEXT="Unsafe environment parsing enables code injection">
        <node TEXT="Reference: apps/api/config/config.py:120"/>
        <node TEXT="Impact: Using eval() on LEARNHOUSE_DEVELOPMENT_MODE lets anyone controlling that environment variable execute arbitrary Python."/>
        <node TEXT="Recommendation: Replace eval() with explicit string-to-bool parsing (e.g. distutils.util.strtobool) and provide a safe default."/>
      </node>
      <node TEXT="Default admin credentials ship in tooling">
        <node TEXT="Reference: apps/api/cli.py:60, load_test2/user_test.py:21"/>
        <node TEXT="Impact: Installer and load test scripts hard-code production-like admin credentials, risking compromise if leaked or reused."/>
        <node TEXT="Recommendation: Require credentials via environment variables or prompts and strip secrets from version control."/>
      </node>
      <node TEXT="Automatic installer can recreate weak admin accounts">
        <node TEXT="Reference: apps/api/src/core/events/autoinstall.py:21"/>
        <node TEXT="Impact: Empty databases trigger install(short=True), reinstating default data and weak admin credentials."/>
        <node TEXT="Recommendation: Remove auto-install or gate it behind an explicit feature flag with secure credential prompts."/>
      </node>
      <node TEXT="JWT config downgrades secrets and disables expiry">
        <node TEXT="Reference: apps/api/src/security/auth.py:21-26"/>
        <node TEXT="Impact: authjwt_secret_key defaults to &quot;secret&quot; in dev mode and access token expiry uses a float, potentially never expiring."/>
        <node TEXT="Recommendation: Always load secrets from configuration, fail fast when missing, and pass a timedelta to FastAPI-JWT Auth settings."/>
      </node>
      <node TEXT="Password reset leaks credentials through URLs">
        <node TEXT="Reference: apps/web/services/auth/auth.ts:88, apps/api/src/routers/users.py:231"/>
        <node TEXT="Impact: Frontend sends new_password via query string, exposing plaintext passwords in logs and intermediaries."/>
        <node TEXT="Recommendation: Move reset parameters into a JSON body over HTTPS and keep sensitive values out of URLs."/>
      </node>
      <node TEXT="Embed sanitisation allows arbitrary attributes">
        <node TEXT="Reference: apps/web/components/Objects/Editor/Extensions/EmbedObjects/EmbedObjectsComponent.tsx:41-44"/>
        <node TEXT="Impact: DOMPurify configured with ADD_ATTR: ['*'] re-enables dangerous event attributes and allows stored XSS."/>
        <node TEXT="Recommendation: Whitelist only required attributes (e.g. src, allow, frameborder) and rely on DOMPurify defaults otherwise."/>
      </node>
      <node TEXT="Middleware sets cookies for .localhost only">
        <node TEXT="Reference: apps/web/middleware.ts:75-83"/>
        <node TEXT="Impact: Production domains never receive learnhouse_current_orgslug cookie, breaking auth flows."/>
        <node TEXT="Recommendation: Derive cookie domain dynamically from request host and omit domain attribute in development."/>
      </node>
    </node>
    <node TEXT="Reliability &amp; Design Smells">
      <node TEXT="Type coercion in config breaks falsy values">
        <node TEXT="Reference: apps/api/config/config.py:334-360"/>
        <node TEXT="Impact: bool(&quot;false&quot;) is True and list(allowed_origins) fails when None; ports default to empty strings causing crashes."/>
        <node TEXT="Recommendation: Parse booleans/ints explicitly, default allowed_origins to [], and validate config via Pydantic."/>
      </node>
      <node TEXT="Database schema mutates at import time">
        <node TEXT="Reference: apps/api/src/core/events/database.py:32-48"/>
        <node TEXT="Impact: Importing the module triggers recursive imports and SQLModel.metadata.create_all, modifying schema unexpectedly."/>
        <node TEXT="Recommendation: Move model discovery and migrations into startup hooks or tooling; keep module imports side-effect free."/>
      </node>
      <node TEXT="Async services block the event loop">
        <node TEXT="Reference: apps/api/src/services/users/users.py:37-116"/>
        <node TEXT="Impact: async handlers call Session.exec and commit synchronously, blocking FastAPI event loop under load."/>
        <node TEXT="Recommendation: Adopt SQLModel async engine/session or run sync work via run_in_threadpool."/>
      </node>
      <node TEXT="Runtime configuration utilities rely on brittle hacks">
        <node TEXT="Reference: apps/web/services/config/config.ts:12-92"/>
        <node TEXT="Impact: Dynamic env var name rebuilding and returning &quot;error&quot; strings make builds fragile and leak details."/>
        <node TEXT="Recommendation: Standardise config loading with schemas, remove string splicing hacks, and fail fast when env vars are missing."/>
      </node>
      <node TEXT="Middleware contains placeholder error handling">
        <node TEXT="Reference: apps/web/middleware.ts:149"/>
        <node TEXT="Impact: throw(&quot;This is broken&quot;) returns opaque 500 errors, hindering production diagnostics."/>
        <node TEXT="Recommendation: Replace placeholders with structured errors or redirects and add test coverage."/>
      </node>
    </node>
    <node TEXT="Redundant &amp; Versioned Assets">
      <node TEXT="Checked-in dependencies inflate the repo">
        <node TEXT="Reference: node_modules/.modules.yaml:1, apps/web/node_modules/.modules.yaml:1"/>
        <node TEXT="Impact: Committed node_modules slow clones and hide dependency provenance."/>
        <node TEXT="Recommendation: Delete node_modules from source control and rely on lockfiles plus CI installs."/>
      </node>
      <node TEXT="Conflicting lockfiles">
        <node TEXT="Reference: apps/web/package-lock.json:1, apps/web/pnpm-lock.yaml:1"/>
        <node TEXT="Impact: Maintaining npm and pnpm locks causes drift and wasted builds."/>
        <node TEXT="Recommendation: Standardise on one package manager (pnpm) and remove the other lockfile."/>
      </node>
      <node TEXT="Stale orchestration artefacts">
        <node TEXT="Reference: docker-compose.yml.old:1"/>
        <node TEXT="Impact: Legacy compose file confuses operators and risks drift from supported deployments."/>
        <node TEXT="Recommendation: Archive or delete legacy file once documented elsewhere."/>
      </node>
      <node TEXT="Load-test scaffolding mixes prod credentials">
        <node TEXT="Reference: load_test2/user_test.py:1-140"/>
        <node TEXT="Impact: Bespoke tooling with hard-coded hosts and secrets belongs outside the main repo."/>
        <node TEXT="Recommendation: Move scripts to a private ops repo or gate them behind opt-in configuration."/>
      </node>
    </node>
    <node TEXT="Software Engineering Debt">
      <node TEXT="Configuration is recomputed on every call">
        <node TEXT="Reference: apps/api/config/config.py:108, apps/api/src/services/dev/dev.py:5, apps/api/src/security/security.py:7"/>
        <node TEXT="Impact: Helpers repeatedly reload YAML and environment variables, adding filesystem overhead."/>
        <node TEXT="Recommendation: Cache parsed configuration with a singleton or lru_cache and inject settings."/>
      </node>
      <node TEXT="Auth scaffolding is inconsistent and mostly dead code">
        <node TEXT="Reference: apps/api/src/security/auth.py:16, apps/api/src/security/auth.py:43-49"/>
        <node TEXT="Impact: OAuth2PasswordBearer points at /api/auth/login while router lives under /api/v1, and dependency is unused."/>
        <node TEXT="Recommendation: Fix token URL, wire dependency into endpoints, or delete unused scaffolding."/>
      </node>
      <node TEXT="Password hashing utilities are contradictory">
        <node TEXT="Reference: apps/api/src/security/security.py:5-17"/>
        <node TEXT="Impact: bcrypt CryptContext is initialised but helpers call pbkdf2_sha256 directly, creating confusion."/>
        <node TEXT="Recommendation: Standardise on one hashing strategy and remove unused context setup."/>
      </node>
      <node TEXT="User service is a 600+ line grab bag">
        <node TEXT="Reference: apps/api/src/services/users/users.py:1-600"/>
        <node TEXT="Impact: Mixed responsibilities and stringified timestamps hinder reasoning and testing."/>
        <node TEXT="Recommendation: Split module into cohesive units, use timezone-aware datetimes, and add targeted tests."/>
      </node>
      <node TEXT="Production code still emits ad-hoc prints">
        <node TEXT="Reference: apps/api/src/core/events/database.py:28, apps/api/app.py:69"/>
        <node TEXT="Impact: print statements leak internal paths and bypass structured logging."/>
        <node TEXT="Recommendation: Replace prints with shared logger or Python logging, gating noisy messages behind debug levels."/>
      </node>
      <node TEXT="Type safety on the frontend is effectively disabled">
        <node TEXT="Reference: apps/web/services/auth/auth.ts:4-18"/>
        <node TEXT="Impact: Literal 'string' types and any parameters remove TypeScript guardrails."/>
        <node TEXT="Recommendation: Define real interfaces, remove any, and share types with backend where possible."/>
      </node>
      <node TEXT="Automated coverage is almost nonexistent">
        <node TEXT="Reference: apps/api/src/tests/test_main.py:1-49"/>
        <node TEXT="Impact: Only two backend tests cover a single happy path, leaving critical logic untested."/>
        <node TEXT="Recommendation: Establish baseline unit and integration tests and wire them into CI."/>
      </node>
    </node>
  </node>
</map>
