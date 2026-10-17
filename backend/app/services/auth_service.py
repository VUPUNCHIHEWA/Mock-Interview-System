from fastapi import HTTPException
from sqlalchemy.orm import Session

import app.models as models
from app.core.security import create_access_token, hash_password, verify_password
from app.services.email_service import send_otp_email
from app.services.otp_service import generate_otp

# Minimum password length for new accounts (UI redesign, 2026-10-17).
# Must match MIN_PASSWORD_LENGTH in frontend/src/pages/Signup.jsx.
# Only checked at sign up, so existing accounts can still log in.
MIN_PASSWORD_LENGTH = 8


async def signup_user(data, db: Session):
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Please enter your full name.")
    if len(data.password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )

    existing = db.query(models.User).filter(models.User.email == data.email).first()

    if existing:
        if existing.is_verified:
            raise HTTPException(status_code=400, detail="Email already registered")

        otp = generate_otp()
        existing.name = data.name
        existing.password = hash_password(data.password)
        existing.otp = otp

        profile = db.query(models.SignupProfile).filter(models.SignupProfile.user_id == existing.id).first()
        if profile:
            profile.target_role = data.target_role
            profile.experience_level = data.experience_level
        else:
            db.add(
                models.SignupProfile(
                    user_id=existing.id,
                    target_role=data.target_role,
                    experience_level=data.experience_level,
                )
            )

        db.commit()

        try:
            await send_otp_email(data.email, otp)
        except Exception as e:
            print("Email sending failed:", e)

        return {"message": "Account already exists but is not verified. OTP resent to email."}

    otp = generate_otp()

    user = models.User(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        otp=otp,
        is_verified=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    signup_profile = models.SignupProfile(
        user_id=user.id,
        target_role=data.target_role,
        experience_level=data.experience_level,
    )
    db.add(signup_profile)
    db.commit()

    try:
        await send_otp_email(data.email, otp)
    except Exception as e:
        print("Email sending failed:", e)

    return {"message": "OTP sent to email"}


def verify_user_otp(data, db: Session):
    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.otp != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user.is_verified = True
    user.otp = None
    db.commit()

    return {"message": "Account verified successfully"}


def login_user(data, db: Session):
    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Please verify your email first")

    token = create_access_token({"user_id": user.id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


async def resend_otp(data, db: Session):
    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = generate_otp()
    user.otp = otp
    db.commit()

    try:
        await send_otp_email(data.email, otp)
    except Exception as e:
        print("Email sending failed:", e)

    return {"message": "New OTP sent"}