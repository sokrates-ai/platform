import asyncio
from datetime import datetime, timezone
import hashlib
import json
import redis
import secrets
from fastapi import HTTPException, Request
from pydantic import EmailStr
from sqlmodel import Session, select
from src.db.organizations import Organization, OrganizationRead
from src.security.security import security_hash_password
from config.config import get_learnhouse_config
from src.services.email.utils import EmailDeliveryError
from src.services.users.emails import (
    send_password_reset_email,
)
from src.db.users import (
    AnonymousUser,
    PublicUser,
    User,
    UserRead,
)

RESET_TOKEN_TTL_SECONDS = 60 * 60
RESET_REQUEST_COOLDOWN_SECONDS = 60
RESET_REQUEST_RESPONSE = (
    "If an account exists, check your email for a password reset link."
)


def _reset_token_key(user_uuid: str, org_uuid: str, reset_token: str) -> str:
    token_digest = hashlib.sha256(reset_token.encode()).hexdigest()
    return f"password_reset:{user_uuid}:{org_uuid}:{token_digest}"


def _reset_rate_limit_key(org_uuid: str, email: EmailStr) -> str:
    email_digest = hashlib.sha256(str(email).lower().encode()).hexdigest()
    return f"password_reset_rate:{org_uuid}:{email_digest}"


async def send_reset_password_code(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    org_id: int,
    email: EmailStr,
):
    # Get org
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()

    if not org:
        raise HTTPException(
            status_code=400,
            detail="Organization not found",
        )

    # Always return the same response for unknown addresses so this endpoint cannot
    # be used to discover which people have accounts.
    statement = select(User).where(User.email == email)
    user = db_session.exec(statement).first()
    if not user:
        return RESET_REQUEST_RESPONSE

    # Redis init
    LH_CONFIG = get_learnhouse_config()
    redis_conn_string = LH_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    r = redis.Redis.from_url(redis_conn_string)
    rate_limit_key = _reset_rate_limit_key(org.org_uuid, email)
    try:
        accepted = r.set(
            rate_limit_key,
            "1",
            ex=RESET_REQUEST_COOLDOWN_SECONDS,
            nx=True,
        )
    except redis.RedisError as exc:
        raise HTTPException(
            status_code=503,
            detail="Password reset is temporarily unavailable",
        ) from exc
    if not accepted:
        return RESET_REQUEST_RESPONSE

    generated_reset_code = secrets.token_urlsafe(32)
    reset_code_key = _reset_token_key(
        user.user_uuid,
        org.org_uuid,
        generated_reset_code,
    )
    reset_code_object = {
        "reset_code_expires": int(datetime.now(timezone.utc).timestamp())
        + RESET_TOKEN_TTL_SECONDS,
        "reset_code_type": "password_reset",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.user_uuid,
        "org_uuid": org.org_uuid,
    }

    try:
        r.set(
            reset_code_key,
            json.dumps(reset_code_object),
            ex=RESET_TOKEN_TTL_SECONDS,
        )
    except redis.RedisError as exc:
        raise HTTPException(
            status_code=503,
            detail="Password reset is temporarily unavailable",
        ) from exc

    user = UserRead.model_validate(user)

    org = OrganizationRead.model_validate(org)

    try:
        await asyncio.to_thread(
            send_password_reset_email,
            generated_reset_code=generated_reset_code,
            user=user,
            organization=org,
            email=user.email,
        )
    except EmailDeliveryError as exc:
        r.delete(reset_code_key)
        raise HTTPException(
            status_code=503,
            detail="The password reset email could not be sent. Please try again later.",
        ) from exc

    return RESET_REQUEST_RESPONSE


async def change_password_with_reset_code(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    new_password: str,
    org_id: int,
    email: EmailStr,
    reset_code: str,
):
    # Get user
    statement = select(User).where(User.email == email)
    user = db_session.exec(statement).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="User does not exist",
        )

    # Get org
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()

    if not org:
        raise HTTPException(
            status_code=400,
            detail="Organization not found",
        )

    # Redis init
    LH_CONFIG = get_learnhouse_config()
    redis_conn_string = LH_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    r = redis.Redis.from_url(redis_conn_string)
    reset_code_key = _reset_token_key(user.user_uuid, org.org_uuid, reset_code)
    try:
        reset_code_value = r.get(reset_code_key)
    except redis.RedisError as exc:
        raise HTTPException(
            status_code=503,
            detail="Password reset is temporarily unavailable",
        ) from exc

    if reset_code_value is None:
        raise HTTPException(
            status_code=400,
            detail="Reset link is invalid or expired",
        )
    reset_code_object = json.loads(reset_code_value)

    # Check if reset code is expired
    if reset_code_object["reset_code_expires"] < int(
        datetime.now(timezone.utc).timestamp()
    ):
        r.delete(reset_code_key)
        raise HTTPException(
            status_code=400,
            detail="Reset link is invalid or expired",
        )

    # Change password
    user.password = security_hash_password(new_password)
    db_session.add(user)

    db_session.commit()
    db_session.refresh(user)

    # Delete reset code
    r.delete(reset_code_key)

    return "Password changed"
