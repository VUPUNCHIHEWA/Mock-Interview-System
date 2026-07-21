from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    target_role: str | None = None
    experience_level: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class OTPVerifyRequest(BaseModel):
    email: str
    otp: str


class EmailRequest(BaseModel):
    email: str


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    university: str | None = None
    degree: str | None = None
    role: str | None = None
    github: str | None = None
    linkedin: str | None = None
