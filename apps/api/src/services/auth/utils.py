import json
import logging
import os
import random
from pathlib import Path
from typing import Optional
from fastapi import Depends, HTTPException, Request
import httpx
from sqlmodel import Session, select
from src.core.events.database import get_db_session
from src.db.users import User, UserCreate, UserRead
from src.security.auth import get_current_user
from src.services.users.users import create_user, create_user_without_org


LOGGER = logging.getLogger(__name__)


def _get_oidc_env():
    return {
        "client_id": os.environ.get("OIDC_CLIENT_ID"),
        "client_secret": os.environ.get("OIDC_CLIENT_SECRET"),
        "callback": os.environ.get("OIDC_SOKRATES_CALLBACK"),
        "endpoint": os.environ.get("OIDC_ENDPOINT"),
        "openid_config_path": os.environ.get("OPEN_ID_CONFIG_JSON_PATH"),
    }


async def get_google_user_info(access_token: str):
    url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Failed to fetch user info from Google",
        )

    return response.json()


async def get_oidc_configuration():
    env = _get_oidc_env()
    openid_config_path = env.get("openid_config_path")
    if openid_config_path:
        config_path = Path(openid_config_path).expanduser()
        if not config_path.exists():
            LOGGER.error("OpenID configuration file not found at %s", config_path)
            raise HTTPException(
                status_code=500,
                detail="OpenID configuration file not found",
            )
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
            LOGGER.info("Loaded OpenID configuration from %s", config_path)
            return config
        except json.JSONDecodeError:
            LOGGER.exception("Failed to parse OpenID configuration JSON")
            raise HTTPException(
                status_code=500,
                detail="OpenID configuration file is invalid",
            )

    oidc_endpoint = env.get("endpoint")
    if not oidc_endpoint:
        LOGGER.error("OIDC_ENDPOINT is not configured")
        raise HTTPException(
            status_code=500,
            detail="OIDC endpoint not configured",
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(oidc_endpoint)

    if response.status_code != 200:
        LOGGER.error(
            "Failed to fetch OpenID configuration from %s (%s)",
            oidc_endpoint,
            response.status_code,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch OpenID configuration",
        )

    LOGGER.info("Fetched OpenID configuration from %s", oidc_endpoint)
    return response.json()


async def get_keycloak_user_info(access_token: str):
    config = await get_oidc_configuration()
    userinfo_endpoint = config.get("userinfo_endpoint")

    if not userinfo_endpoint:
        LOGGER.error("OpenID configuration missing userinfo_endpoint")
        raise HTTPException(
            status_code=500,
            detail="OpenID configuration missing userinfo endpoint",
        )

    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(userinfo_endpoint, headers=headers)

    if response.status_code != 200:
        LOGGER.error(
            "Failed to fetch user info from Keycloak (%s)", response.status_code
        )
        raise HTTPException(
            status_code=response.status_code,
            detail="Failed to fetch user info from Keycloak",
        )

    return response.json()


async def signWithGoogle(
    request: Request,
    access_token: str,
    email: str,
    org_id: Optional[int] = None,
    current_user=Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    # Google
    google_user = await get_google_user_info(access_token)

    user = db_session.exec(
        select(User).where(User.email == google_user["email"])
    ).first()

    if not user:
        username = (
            google_user["given_name"]
            + google_user["family_name"]
            + str(random.randint(10, 99))
        )
        user_object = UserCreate(
            email=google_user["email"],
            username=username,
            password="",
            first_name=google_user["given_name"],
            last_name=google_user["family_name"],
            avatar_image=google_user["picture"],
        )

        if org_id is not None:
            user = await create_user(
                request, db_session, current_user, user_object, org_id
            )

            return user
        else:
            user = await create_user_without_org(
                request, db_session, current_user, user_object
            )

            return user

    return UserRead.model_validate(user)


async def signWithKeycloak(
    request: Request,
    access_token: str,
    email: str,
    org_id: Optional[int] = None,
    current_user=Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    env = _get_oidc_env()
    if not env.get("client_id") or not env.get("client_secret"):
        LOGGER.warning("OIDC client credentials not fully configured")

    LOGGER.info("Starting Keycloak SSO login")
    keycloak_user = await get_keycloak_user_info(access_token)

    resolved_email = keycloak_user.get("email") or email
    if not resolved_email:
        LOGGER.error("Keycloak user info does not include an email")
        raise HTTPException(
            status_code=400,
            detail="Keycloak user info missing email",
        )

    user = db_session.exec(
        select(User).where(User.email == resolved_email)
    ).first()

    if not user:
        preferred_username = keycloak_user.get("preferred_username")
        given_name = keycloak_user.get("given_name") or ""
        family_name = keycloak_user.get("family_name") or ""
        name_base = (given_name + family_name).strip()
        if not name_base:
            name_base = (preferred_username or resolved_email.split("@")[0]).strip()

        username = f"{name_base}{random.randint(10, 99)}"
        user_object = UserCreate(
            email=resolved_email,
            username=username,
            password="",
            first_name=given_name,
            last_name=family_name,
            avatar_image=keycloak_user.get("picture", ""),
        )

        LOGGER.info("Creating new user from Keycloak SSO: %s", resolved_email)
        if org_id is not None:
            user = await create_user(
                request, db_session, current_user, user_object, org_id
            )
        else:
            user = await create_user_without_org(
                request, db_session, current_user, user_object
            )

        return user

    LOGGER.info("Existing user logged in via Keycloak SSO: %s", resolved_email)
    return UserRead.model_validate(user)
