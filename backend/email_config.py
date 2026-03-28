from fastapi_mail import ConnectionConfig
MAIL_FROM_NAME="Mock Interview System"

conf = ConnectionConfig(
    MAIL_USERNAME="umeshav520@gmail.com",
    MAIL_PASSWORD="iumh vori uvyf yjpt",

    MAIL_FROM="umeshav520@gmail.com",
    MAIL_FROM_NAME="Mock Interview System",

    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",

    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,

    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)