from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Float
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
class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(255))
    difficulty = Column(String(50))
    interview_mode = Column(String(50))
    overall_score = Column(Float, default=0.0)
    summary_feedback = Column(Text, nullable=True)
    status = Column(String(50), default="Ongoing")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    responses = relationship("InterviewResponse", back_populates="session", cascade="all, delete-orphan")

class InterviewResponse(Base):
    __tablename__ = "interview_responses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), ForeignKey("interview_sessions.session_id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=True)
    audio_path = Column(String(500), nullable=True)
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    visual_confidence_score = Column(Float, nullable=True)
    # --- BSc Research Feature (Step 3): real voice-confidence metrics,
    # replacing the previous fake heuristic. Nullable since these are
    # only computed when an audio answer is provided.
    filler_word_count = Column(Integer, nullable=True)
    long_pause_count = Column(Integer, nullable=True)
    pitch_variation = Column(Float, nullable=True)
    # Used by the vocal scores (see voice_analysis.py / VOCAL_SCORING.md):
    # answer time (first to last sound), time spent in long pauses (>= 3 s),
    # and the pitch variation quotient (SD / mean of pitch). None for answers
    # recorded before this scoring existed.
    speech_seconds = Column(Float, nullable=True)
    long_pause_seconds = Column(Float, nullable=True)
    pitch_pvq = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("InterviewSession", back_populates="responses")

class VisualMetric(Base):
    __tablename__ = "visual_metrics"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), ForeignKey("interview_sessions.session_id", ondelete="CASCADE"), nullable=False)
    confidence_score = Column(Float, default=0.0)
    emotion = Column(String(50), nullable=True)
    # Per-factor scores for this frame (0-100), so the results page can show
    # Eye Contact and Head Pose separately. Nullable: frames with no face,
    # and rows saved before these columns existed, have no value.
    gaze_score = Column(Float, nullable=True)
    head_stability_score = Column(Float, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    session = relationship("InterviewSession")