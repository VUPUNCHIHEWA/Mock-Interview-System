from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import ensure_same_user, get_current_user, get_db
from app.models import User
from app.services.cv_service import extract_pdf_text, get_cv_data, save_cv_data


router = APIRouter()


@router.post("/save-cv")
async def save_cv(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # SECURITY: a CV can only be saved for the logged-in user.
    if data.get("user_id") is not None:
        ensure_same_user(int(data["user_id"]), current_user)
    data["user_id"] = current_user.id
    return save_cv_data(data, db)


@router.get("/get-cv/{user_id}")
async def get_cv(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    return get_cv_data(user_id, db)


@router.post("/api/upload-cv")
async def upload_cv(cvFile: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if cvFile.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        pdf_content = await cvFile.read()
        full_text = await extract_pdf_text(pdf_content)

        return {
            "success": True,
            "filename": cvFile.filename,
            "extracted_text": full_text,
            "message": "CV parsed successfully!",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing PDF: {str(e)}")