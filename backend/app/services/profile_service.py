from fastapi import HTTPException
from sqlalchemy.orm import Session

import app.models as models


def serialize_profile(profile):
    if not profile:
        return None

    return {
        "user_id": profile.user_id,
        "full_name": profile.full_name,
        "email": profile.email,
        "university": profile.university,
        "degree": profile.degree,
        "role": profile.role,
        "github": profile.github,
        "linkedin": profile.linkedin,
    }


def get_profile(user_id: int, db: Session):
    profile = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()
    if not profile:
        return {
            "user_id": user_id,
            "full_name": "",
            "email": "",
            "university": "",
            "degree": "",
            "role": "",
            "github": "",
            "linkedin": "",
        }

    return serialize_profile(profile)


def save_profile(user_id: int, data, db: Session):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()

    if not profile:
        profile = models.Profile(user_id=user_id)
        db.add(profile)

    profile.full_name = data.full_name or user.name
    profile.email = data.email or user.email
    profile.university = data.university
    profile.degree = data.degree
    profile.role = data.role
    profile.github = data.github
    profile.linkedin = data.linkedin

    db.commit()
    return {"message": "Profile saved successfully"}
