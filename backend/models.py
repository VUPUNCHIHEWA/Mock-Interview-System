from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database import Base

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String)
    email = Column(String, unique=True, index=True)

    password = Column(String)

    is_verified = Column(Boolean, default=False)

    otp = Column(String, nullable=True)

    otp_expiry = Column(DateTime, nullable=True)