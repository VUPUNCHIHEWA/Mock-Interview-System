from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import fitz  # PyMuPDF
import models
from database import engine, SessionLocal
from models import Base
import users


Base.metadata.create_all(bind=engine)

app = FastAPI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users.router)

@app.get("/")
def root():
    return {"message": "Mock Interview Backend Running"}

# --- 1. CV DATA SAVE ENDPOINT ---
@app.post("/save-cv")
async def save_cv(data: dict, db: Session = Depends(get_db)):
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    # දැනටමත් මේ User ට CV එකක් තියෙනවාදැයි පරීක්ෂා කිරීම
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
            github_username=data.get("github_username")
        )
        db.add(new_cv)

    try:
        db.commit()
        return {"message": "CV data saved successfully!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# --- 2. CV DATA FETCH ENDPOINT ---
@app.get("/get-cv/{user_id}")
async def get_cv(user_id: int, db: Session = Depends(get_db)):
    cv = db.query(models.CVData).filter(models.CVData.user_id == user_id).first()
    if not cv:
        return {"status": "not_found"}
    return cv

# --- 3. CV UPLOAD & PDF PARSING ENDPOINT ---
@app.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        pdf_content = await file.read()
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        
        full_text = ""
        for page in doc:
            full_text += page.get_text()
            
        doc.close()
        
        return {
            "filename": file.filename,
            "extracted_text": full_text[:2000], # Text එකේ ප්‍රමාණය අවශ්‍ය පරිදි වැඩි කරගන්න
            "message": "CV parsed successfully!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing PDF: {str(e)}")

# --- 4. GITHUB DATA ENDPOINT (Optional) ---
@app.get("/github/{username}")
async def fetch_github_info(username: str):
    from github_service import get_github_stats
    stats = get_github_stats(username)
    if "error" in stats:
        raise HTTPException(status_code=404, detail=stats["error"])
    return stats