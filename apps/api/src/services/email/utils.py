import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from pydantic import EmailStr
import resend

from config.config import MailingConfig, get_learnhouse_config

logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    """Raised when an email could not be handed to the configured provider."""


def _validate_config(config: MailingConfig) -> None:
    if not config.system_email_address:
        raise EmailDeliveryError("The system email address is not configured")
    if config.provider == "resend" and not config.resend_api_key:
        raise EmailDeliveryError("The Resend API key is not configured")
    if config.provider == "smtp" and not config.smtp_host:
        raise EmailDeliveryError("The SMTP host is not configured")
    if config.provider == "disabled":
        raise EmailDeliveryError("Email delivery is disabled")


def _send_with_resend(
    config: MailingConfig,
    *,
    to: str,
    subject: str,
    html_body: str,
    text_body: str | None,
    idempotency_key: str | None,
) -> dict:
    resend.api_key = config.resend_api_key
    params: resend.Emails.SendParams = {
        "from": formataddr((config.sender_name, config.system_email_address)),
        "to": [to],
        "subject": subject,
        "html": html_body,
    }
    if text_body:
        params["text"] = text_body
    if config.reply_to:
        params["reply_to"] = config.reply_to

    options: resend.Emails.SendOptions | None = None
    if idempotency_key:
        options = {"idempotency_key": idempotency_key}
    return resend.Emails.send(params, options)


def _send_with_smtp(
    config: MailingConfig,
    *,
    to: str,
    subject: str,
    html_body: str,
    text_body: str | None,
) -> dict:
    message = EmailMessage()
    message["From"] = formataddr((config.sender_name, config.system_email_address))
    message["To"] = to
    message["Subject"] = subject
    message["Message-ID"] = make_msgid(
        domain=config.system_email_address.split("@")[-1]
    )
    if config.reply_to:
        message["Reply-To"] = config.reply_to
    message.set_content(
        text_body or "This message requires an HTML-capable email client."
    )
    message.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(
        config.smtp_host,
        config.smtp_port,
        timeout=config.smtp_timeout_sec,
    ) as smtp:
        if config.smtp_starttls:
            smtp.starttls()
        if config.smtp_username:
            smtp.login(config.smtp_username, config.smtp_password or "")
        smtp.send_message(message)

    return {"id": message["Message-ID"]}


def send_email(
    to: EmailStr,
    subject: str,
    body: str,
    *,
    text_body: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """Send one transactional email through Resend or an SMTP relay."""
    config = get_learnhouse_config().mailing_config
    _validate_config(config)

    try:
        if config.provider == "resend":
            result = _send_with_resend(
                config,
                to=str(to),
                subject=subject,
                html_body=body,
                text_body=text_body,
                idempotency_key=idempotency_key,
            )
        else:
            result = _send_with_smtp(
                config,
                to=str(to),
                subject=subject,
                html_body=body,
                text_body=text_body,
            )
    except Exception as exc:
        logger.exception("Email delivery failed through provider %s", config.provider)
        raise EmailDeliveryError(
            f"Email delivery through {config.provider} failed"
        ) from exc

    logger.info("Email handed to provider %s", config.provider)
    return result
