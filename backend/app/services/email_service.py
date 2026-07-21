from fastapi_mail import FastMail, MessageSchema

from app.core.email import conf


async def send_otp_email(receiver_email: str, otp: str):
    if conf is None:
        print("Mail config is missing; skipping OTP email send.")
        return

    message = MessageSchema(
        subject="Mock Interview System - OTP Verification",
        recipients=[receiver_email],
        body=f"""
        <h2>Mock Interview System</h2>
        <p>Your OTP code is:</p>
        <h1>{otp}</h1>
        <p>Please enter this code to verify your account.</p>
        """,
        subtype="html",
    )

    fm = FastMail(conf)
    await fm.send_message(message)
