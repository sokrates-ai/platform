from types import SimpleNamespace

import pytest

from config.config import MailingConfig, get_learnhouse_config
from src.services.email import utils as email_utils
from src.services.users import emails as user_emails
from src.services.users.password_reset import _reset_token_key


def _mailing_config(**overrides) -> MailingConfig:
    values = {
        "provider": "smtp",
        "resend_api_key": None,
        "system_email_address": "no-reply@sokrates.local",
        "sender_name": "Sokrates",
        "reply_to": None,
        "public_web_url": "http://localhost:3000",
        "smtp_host": "localhost",
        "smtp_port": 1025,
        "smtp_username": None,
        "smtp_password": None,
        "smtp_starttls": False,
        "smtp_timeout_sec": 10,
    }
    values.update(overrides)
    return MailingConfig(**values)


def test_development_email_config_uses_mailpit(monkeypatch: pytest.MonkeyPatch):
    for key in (
        "LEARNHOUSE_EMAIL_PROVIDER",
        "LEARNHOUSE_PUBLIC_WEB_URL",
        "LEARNHOUSE_RESEND_API_KEY",
        "LEARNHOUSE_SMTP_HOST",
        "SK_PUBLIC_URL",
    ):
        monkeypatch.delenv(key, raising=False)

    config = get_learnhouse_config().mailing_config

    assert config.provider == "smtp"
    assert config.smtp_host == "localhost"
    assert config.smtp_port == 1025
    assert config.smtp_starttls is False
    assert config.public_web_url == "http://localhost:3000"


def test_resend_provider_sends_text_and_uses_idempotency_key(monkeypatch):
    config = _mailing_config(
        provider="resend",
        resend_api_key="test-key",
        reply_to="support@example.org",
    )
    sent = {}

    def fake_send(params, options):
        sent["params"] = params
        sent["options"] = options
        return {"id": "email_123"}

    monkeypatch.setattr(email_utils.resend.Emails, "send", fake_send)

    result = email_utils._send_with_resend(
        config,
        to="student@example.org",
        subject="Reset password",
        html_body="<p>Reset</p>",
        text_body="Reset",
        idempotency_key="password-reset-123",
    )

    assert result == {"id": "email_123"}
    assert sent["params"]["from"] == "Sokrates <no-reply@sokrates.local>"
    assert sent["params"]["text"] == "Reset"
    assert sent["params"]["reply_to"] == "support@example.org"
    assert sent["options"] == {"idempotency_key": "password-reset-123"}


def test_smtp_provider_builds_multipart_message(monkeypatch):
    config = _mailing_config()
    captured = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            captured.update(host=host, port=port, timeout=timeout)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def send_message(self, message):
            captured["message"] = message

    monkeypatch.setattr(email_utils.smtplib, "SMTP", FakeSMTP)

    email_utils._send_with_smtp(
        config,
        to="student@example.org",
        subject="Reset password",
        html_body="<p>Reset</p>",
        text_body="Reset",
    )

    assert captured["host"] == "localhost"
    assert captured["port"] == 1025
    assert captured["message"]["To"] == "student@example.org"
    assert captured["message"].is_multipart()


def test_password_reset_email_uses_configured_url_and_escapes_username(monkeypatch):
    captured = {}
    config = SimpleNamespace(
        site_name="Sokrates",
        mailing_config=SimpleNamespace(public_web_url="https://learn.example.org"),
    )

    def fake_send_email(**kwargs):
        captured.update(kwargs)
        return {"id": "email_123"}

    monkeypatch.setattr(user_emails, "get_learnhouse_config", lambda: config)
    monkeypatch.setattr(user_emails, "send_email", fake_send_email)

    user_emails.send_password_reset_email(
        generated_reset_code="secret token",
        user=SimpleNamespace(username="<Student>"),
        organization=SimpleNamespace(slug="math course"),
        email="student+test@example.org",
    )

    assert "https://learn.example.org/reset?" in captured["body"]
    assert "orgslug=math+course" in captured["body"]
    assert "resetCode=secret+token" in captured["body"]
    assert "&lt;Student&gt;" in captured["body"]
    assert "<Student>" not in captured["body"]
    assert captured["subject"] == "Sokrates Password Reset"
    assert captured["text_body"].startswith("Hello <Student>")
    assert captured["idempotency_key"].startswith("password-reset-")


def test_reset_token_is_not_stored_in_redis_key():
    key = _reset_token_key("user-1", "org-1", "raw-secret-token")

    assert "raw-secret-token" not in key
    assert key.startswith("password_reset:user-1:org-1:")
