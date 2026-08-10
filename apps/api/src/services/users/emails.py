import hashlib
from html import escape
from urllib.parse import urlencode

from pydantic import EmailStr
from config.config import get_learnhouse_config
from src.db.organizations import OrganizationRead
from src.db.users import UserRead
from src.services.email.utils import send_email


def send_account_creation_email(
    user: UserRead,
    email: EmailStr,
):
    username = escape(user.username)
    return send_email(
        to=email,
        subject=f"Welcome to LearnHouse, {user.username}!",
        body=f"""
<html>
    <body>
        <p>Hello {username}</p>
        <p>Welcome to LearnHouse! , get started by creating your own organization or join a one.</p>
        <p>Need some help to get started ? <a href="https://university.learnhouse.io">LearnHouse Academy</a></p>
    </body>
</html>
""",
        text_body=(
            f"Hello {user.username}\n\n"
            "Welcome to LearnHouse! Get started by creating an organization or "
            "joining one."
        ),
    )


def send_password_reset_email(
    generated_reset_code: str,
    user: UserRead,
    organization: OrganizationRead,
    email: EmailStr,
):
    config = get_learnhouse_config()
    query = urlencode(
        {
            "email": str(email),
            "resetCode": generated_reset_code,
            "orgslug": organization.slug,
        }
    )
    reset_url = f"{config.mailing_config.public_web_url}/reset?{query}"
    username = escape(user.username)
    safe_reset_url = escape(reset_url, quote=True)
    idempotency_key = (
        "password-reset-"
        + hashlib.sha256(f"{email}:{generated_reset_code}".encode()).hexdigest()
    )

    return send_email(
        to=email,
        subject="Sokrates Password Reset",
        body=f"""
<html>
    <body>
        <p>Hello {username},</p>
        <p>We received a request to reset your password.</p>
        <p><a href="{safe_reset_url}">Reset your password</a></p>
        <p>This link expires in one hour. If you did not request it, you can ignore this email.</p>
    </body>
</html>
""",
        text_body=(
            f"Hello {user.username},\n\n"
            "We received a request to reset your password. Open this link:\n"
            f"{reset_url}\n\n"
            "This link expires in one hour. If you did not request it, you can "
            "ignore this email."
        ),
        idempotency_key=idempotency_key,
    )
