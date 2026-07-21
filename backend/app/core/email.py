import os

from dotenv import load_dotenv
from fastapi_mail import ConnectionConfig


load_dotenv()

def build_mail_config():
    mail_username = os.getenv("MAIL_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM", mail_username)

    if not mail_username or not mail_password or not mail_from:
        return None

    return ConnectionConfig(
        MAIL_USERNAME=mail_username,
        MAIL_PASSWORD=mail_password,
        MAIL_FROM=mail_from,
        MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "Mock Interview System"),
        MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "true").lower() == "true",
        MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "false").lower() == "true",
        USE_CREDENTIALS=os.getenv("USE_CREDENTIALS", "true").lower() == "true",
        VALIDATE_CERTS=os.getenv("VALIDATE_CERTS", "true").lower() == "true",
    )


conf = build_mail_config()

