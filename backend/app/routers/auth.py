from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas import EmailRequest, LoginRequest, OTPVerifyRequest, SignupRequest
from app.services.auth_service import login_user, resend_otp, signup_user, verify_user_otp


router = APIRouter()


@router.post("/signup")
async def signup(data: SignupRequest, db: Session = Depends(get_db)):
    return await signup_user(data, db)


@router.post("/verify-otp")
def verify_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):
    return verify_user_otp(data, db)


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return login_user(data, db)


@router.post("/resend-otp")
async def resend_otp_route(data: EmailRequest, db: Session = Depends(get_db)):
    return await resend_otp(data, db)
