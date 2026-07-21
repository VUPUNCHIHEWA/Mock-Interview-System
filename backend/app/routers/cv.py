from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.services.cv_service import extract_pdf_text, get_cv_data, save_cv_data


router = APIRouter()


@router.post("/save-cv")
async def save_cv(data: dict, db: Session = Depends(get_db)):
    return save_cv_data(data, db)


@router.get("/get-cv/{user_id}")
async def get_cv(user_id: int, db: Session = Depends(get_db)):
    return get_cv_data(user_id, db)


@router.post("/api/upload-cv")
async def upload_cv(cvFile: UploadFile = File(...)):
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
