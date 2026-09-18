import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("app.email")
settings = get_settings()


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        logger.info("=== DEV EMAIL (no SMTP configured) ===\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    # Port 465 is implicit TLS from the first byte (SMTPS) — a plain SMTP
    # connection followed by starttls() sends plaintext commands a port-465
    # server is waiting to see inside a TLS handshake, and it just hangs
    # rather than erroring. 587 (and 25) are the opposite: plaintext first,
    # upgraded via STARTTLS. No timeout previously either, so a
    # misconfigured port hung the request indefinitely instead of failing
    # fast.
    smtp_cls = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
    with smtp_cls(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if smtp_cls is smtplib.SMTP:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


def send_otp_email(to: str, otp: str) -> None:
    send_email(
        to=to,
        subject="Verify your KenaBecha JU account",
        body=(
            f"Your verification code is: {otp}\n\n"
            "This code expires in 10 minutes. If you didn't request this, ignore this email."
        ),
    )
