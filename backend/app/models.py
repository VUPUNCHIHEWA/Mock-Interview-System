from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    is_verified = Column(Boolean, default=False)
    otp = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)

    cv = relationship("CVData", back_populates="owner", uselist=False)


class CVData(Base):
    __tablename__ = "cv_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    full_name = Column(String(255), nullable=False)
    role = Column(String(255))
    email = Column(String(255))
    phone = Column(String(20))
    summary = Column(Text)
    education = Column(Text)
    skills = Column(Text)
    certifications = Column(Text)
    publications = Column(Text)
    github_username = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    owner = relationship("User", back_populates="cv")


class SignupProfile(Base):
    __tablename__ = "signup_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    target_role = Column(String(255), nullable=True)
    experience_level = Column(String(50), nullable=True)

    user = relationship("User")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    university = Column(String(255), nullable=True)
    degree = Column(String(255), nullable=True)
    role = Column(String(255), nullable=True)
    github = Column(String(255), nullable=True)
    linkedin = Column(String(255), nullable=True)

    user = relationship("User")
