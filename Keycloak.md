# Keycloak Authentication (LearnHouse)

This document describes the Keycloak-based sign-in flow, required environment variables, and development/production setup.

## Overview

- The web app uses **NextAuth** with a Keycloak OIDC provider.
- The API accepts OAuth tokens at **`POST /api/auth/oauth`** with provider `"keycloak"`.
- On first Keycloak login, the backend **auto-creates** a user and **auto-joins** the default org.
- Subsequent logins reuse the same account.

## Environment Variables

Set these in your runtime environment (dev: `dev.env`; prod: deployment secrets):

### Required

**Web (NextAuth):**
- `LEARNHOUSE_KEYCLOAK_ISSUER` — Keycloak realm issuer URL
  - Example (dev): `http://localhost:8081/realms/learnhouse`
- `LEARNHOUSE_KEYCLOAK_CLIENT_ID` — OIDC client ID
  - Example (dev): `learnhouse-web`
- `LEARNHOUSE_KEYCLOAK_CLIENT_SECRET` — OIDC client secret
- `NEXTAUTH_SECRET` — NextAuth secret

**Backend (API):**
- `LEARNHOUSE_KEYCLOAK_ISSUER` — same issuer used for userinfo lookup
- `LEARNHOUSE_DEFAULT_ORG_SLUG` or `NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG`
  - Used for **auto-join** on first Keycloak login

### Optional

- `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`
  - Alternative variable names the code will also read.

## Dev Setup (Local Keycloak)

### 1) Start services

Keycloak is included in `docker-compose-dev.yml` and will import a realm automatically.

```
docker compose -f docker-compose-dev.yml up -d keycloak
```

### 2) Realm import

On first boot, Keycloak imports:

- Realm: `learnhouse`
- Client: `learnhouse-web`
- Redirect URI: `http://localhost:3000/api/auth/callback/keycloak`
- Web Origin: `http://localhost:3000`
- Test user: `max.mustermann@student.hpi.uni-potsdam.de` / `password`

Import file: `extra/keycloak/realm-learnhouse.json`

**Important:** Keycloak only imports realms that do not already exist.
If you previously started Keycloak, reset volumes to re-import:

```
docker compose -f docker-compose-dev.yml down -v
docker compose -f docker-compose-dev.yml up -d keycloak
```

### 3) Run web + API

```
./dev.sh web-dev
./dev.sh api-dev
```

### 4) Login

Use the “Continue with Keycloak” button on the login page.

## Production Setup (University Keycloak)

You only need to point the app at the university’s realm.
Ask the Keycloak admins for:

- **Issuer URL** (realm URL)
- **Client ID** and **Client Secret**
- **Redirect URI** to whitelist

**Redirect URI to whitelist:**
```
https://sokrates.ae.org/api/auth/callback/keycloak
```

Also ensure userinfo includes **email**, **given_name**, and **family_name**.
The backend requires email to create/login users.

## Notes & Troubleshooting

- **Realm does not exist**: your `LEARNHOUSE_KEYCLOAK_ISSUER` is incorrect.
- **OAuth succeeds but session breaks**: the API `/auth/oauth` call failed or returned no tokens.
  - Check the API logs for details.
- **Missing email**: Keycloak userinfo must include email for account creation.

## Summary of Flow

1. User clicks “Continue with Keycloak.”
2. NextAuth receives Keycloak tokens.
3. Web calls API `/auth/oauth` with provider `keycloak` and access token.
4. API fetches userinfo, creates the user if missing, and returns LearnHouse JWTs.
5. NextAuth session stores the LearnHouse tokens.
