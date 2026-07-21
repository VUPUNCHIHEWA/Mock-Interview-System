import fitz
from fastapi import HTTPException
from sqlalchemy.orm import Session

import app.models as models


def serialize_cv(cv):
    if not cv:
        return None

    return {
        "id": cv.id,
        "user_id": cv.user_id,
        "full_name": cv.full_name,
        "role": cv.role,
        "email": cv.email,
        "phone": cv.phone,
        "summary": cv.summary,
        "education": cv.education,
        "skills": cv.skills,
        "certifications": cv.certifications,
        "publications": cv.publications,
        "github_username": cv.github_username,
        "created_at": cv.created_at,
        "updated_at": cv.updated_at,
    }


def save_cv_data(data: dict, db: Session):
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    db_cv = db.query(models.CVData).filter(models.CVData.user_id == user_id).first()

    if db_cv:
        db_cv.full_name = data.get("full_name")
        db_cv.role = data.get("role")
        db_cv.email = data.get("email")
        db_cv.phone = data.get("phone")
        db_cv.summary = data.get("summary")
        db_cv.education = data.get("education")
        db_cv.skills = data.get("skills")
        db_cv.certifications = data.get("certifications")
        db_cv.publications = data.get("publications")
        db_cv.github_username = data.get("github_username")
    else:
        new_cv = models.CVData(
            user_id=user_id,
            full_name=data.get("full_name"),
            role=data.get("role"),
            email=data.get("email"),
            phone=data.get("phone"),
            summary=data.get("summary"),
            education=data.get("education"),
            skills=data.get("skills"),
            certifications=data.get("certifications"),
            publications=data.get("publications"),
            github_username=data.get("github_username"),
        )
        db.add(new_cv)

    try:
        db.commit()
        return {"message": "CV data saved successfully!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def get_cv_data(user_id: int, db: Session):
    cv = db.query(models.CVData).filter(models.CVData.user_id == user_id).first()
    if not cv:
        return {"status": "not_found"}

    return serialize_cv(cv)


async def extract_pdf_text(pdf_content: bytes):
    doc = fitz.open(stream=pdf_content, filetype="pdf")

    full_text = ""
    for page in doc:
        full_text += page.get_text()

    doc.close()

    return full_text[:5000]
