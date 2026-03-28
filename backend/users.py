from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from pydantic import BaseModel

from auth import hash_password, verify_password, create_access_token
from otp_utils import generate_otp
from email_config import conf

from fastapi_mail import FastMail, MessageSchema

router = APIRouter()


# ---------------------------
# DATABASE CONNECTION
# ---------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------
# REQUEST MODELS
# ---------------------------

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class OTPVerifyRequest(BaseModel):
    email: str
    otp: str


# ---------------------------
# SIGNUP
# ---------------------------

@router.post("/signup")
async def signup(data: SignupRequest, db: Session = Depends(get_db)):

    existing = db.query(models.User).filter(models.User.email == data.email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    otp = generate_otp()

    print("Sending OTP to:", data.email)
    print("OTP:", otp)

    user = models.User(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        otp=otp,
        is_verified=False
    )

    db.add(user)
    db.commit()

    message = MessageSchema(
        subject="Mock Interview System - OTP Verification",
        recipients=[data.email],
        body=f"""
        <h2>Mock Interview System</h2>
        <p>Your OTP code is:</p>
        <h1>{otp}</h1>
        <p>Please enter this code to verify your account.</p>
        """,
        subtype="html"
    )

    fm = FastMail(conf)

    try:
        await fm.send_message(message)
    except Exception as e:
        print("Email sending failed:", e)

    return {"message": "OTP sent to email"}


# ---------------------------
# VERIFY OTP
# ---------------------------

@router.post("/verify-otp")
def verify_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):

    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.otp != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user.is_verified = True
    user.otp = None

    db.commit()

    return {"message": "Account verified successfully"}


# ---------------------------
# LOGIN
# ---------------------------

@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):

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
        "user": {
            "name": user.name,
            "email": user.email
        }
    }


# ---------------------------
# RESEND OTP
# ---------------------------

class EmailRequest(BaseModel):
    email: str


@router.post("/resend-otp")
async def resend_otp(data: EmailRequest, db: Session = Depends(get_db)):

    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = generate_otp()

    user.otp = otp
    db.commit()

    print("Resend OTP:", otp)

    message = MessageSchema(
        subject="Mock Interview System - New OTP",
        recipients=[data.email],
        body=f"""
        <h2>Mock Interview System</h2>
        <p>Your new OTP code is:</p>
        <h1>{otp}</h1>
        <p>Please use this code to verify your account.</p>
        """,
        subtype="html"
    )

    fm = FastMail(conf)
    await fm.send_message(message)

    return {"message": "New OTP sent"}