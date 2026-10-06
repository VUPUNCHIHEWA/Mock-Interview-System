from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import ensure_same_user, get_current_user, get_db
from app.models import User
from app.schemas import ProfileUpdateRequest
from app.services.profile_service import get_profile, save_profile


router = APIRouter()


@router.get("/profile/{user_id}")
def read_profile(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    return get_profile(user_id, db)


# NOTE: the frontend (Profile.jsx) saves with PUT, but this route was POST-only,
# so saving would fail with "405 Method Not Allowed". Both methods are accepted now.
@router.post("/profile/{user_id}")
@router.put("/profile/{user_id}")
def update_profile(user_id: int, data: ProfileUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    return save_profile(user_id, data, db)