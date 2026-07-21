from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.schemas import ProfileUpdateRequest
from app.services.profile_service import get_profile, save_profile


router = APIRouter()


@router.get("/profile/{user_id}")
def read_profile(user_id: int, db: Session = Depends(get_db)):
    return get_profile(user_id, db)


@router.post("/profile/{user_id}")
def update_profile(user_id: int, data: ProfileUpdateRequest, db: Session = Depends(get_db)):
    return save_profile(user_id, data, db)
