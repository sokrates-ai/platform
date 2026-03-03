import os
import random
from typing import Optional
from fastapi import Depends, HTTPException, Request
import httpx
from sqlmodel import Session, select
from src.core.events.database import get_db_session
from src.db.organizations import Organization
from src.db.users import User, UserCreate, UserRead
from src.security.auth import get_current_user
from src.services.users.users import create_user, create_user_without_org


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

async def get_keycloak_user_info(access_token: str, issuer: str):
    issuer = issuer.rstrip("/")
    url = f"{issuer}/protocol/openid-connect/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
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
    email: Optional[str] = None,
    org_id: Optional[int] = None,
    current_user=Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    keycloak_issuer = os.environ.get("LEARNHOUSE_KEYCLOAK_ISSUER") or os.environ.get(
        "KEYCLOAK_ISSUER"
    )
    if not keycloak_issuer:
        raise HTTPException(
            status_code=500, detail="Keycloak issuer is not configured"
        )

    keycloak_user = await get_keycloak_user_info(access_token, keycloak_issuer)
    user_email = keycloak_user.get("email") or email

    if not user_email:
        raise HTTPException(
            status_code=400, detail="Keycloak user info is missing an email"
        )

    user = db_session.exec(select(User).where(User.email == user_email)).first()

    if not user:
        if org_id is None:
            default_org_slug = os.environ.get(
                "LEARNHOUSE_DEFAULT_ORG_SLUG"
            ) or os.environ.get("NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG")
            if not default_org_slug:
                raise HTTPException(
                    status_code=500, detail="Default org slug is not configured"
                )

            default_org = db_session.exec(
                select(Organization).where(Organization.slug == default_org_slug)
            ).first()

            if not default_org:
                raise HTTPException(
                    status_code=404,
                    detail="Default organization not found",
                )

            org_id = default_org.id

        base_username = (
            keycloak_user.get("preferred_username")
            or user_email.split("@")[0]
            or "user"
        )
        username = None
        for _ in range(5):
            candidate = f"{base_username}{random.randint(10, 99)}"
            existing = db_session.exec(
                select(User).where(User.username == candidate)
            ).first()
            if not existing:
                username = candidate
                break
        if not username:
            username = f"{base_username}{random.randint(100, 999)}"

        user_object = UserCreate(
            email=user_email,
            username=username,
            password="",
            first_name=keycloak_user.get("given_name") or "",
            last_name=keycloak_user.get("family_name") or "",
            avatar_image=keycloak_user.get("picture") or "",
        )

        user = await create_user(
            request, db_session, current_user, user_object, org_id
        )

        return user

    return UserRead.model_validate(user)
