from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import app.models as models
from app.core.security import ALGORITHM, SECRET_KEY
from app.db.session import SessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# auto_error=False so we can return our own clean 401 message.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Works out WHO is calling from the login token (JWT) sent in the
    "Authorization: Bearer <token>" header. The user is never taken from
    the URL or request body, so a caller cannot pretend to be someone else.
    """
    unauthorized = HTTPException(
        status_code=401,
        detail="Not authenticated. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except JWTError:
        raise unauthorized

    if user_id is None:
        raise unauthorized

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise unauthorized

    return user


def ensure_same_user(user_id: int, current_user: models.User) -> None:
    """For routes like /api/progress/{user_id}: the ID in the URL must be the logged-in user."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only access your own data.")


def get_owned_session(db: Session, session_id: str, current_user: models.User) -> models.InterviewSession:
    """
    Returns the interview session only if it belongs to the logged-in user.
    Returns 404 (not 403) for someone else's session, so outsiders cannot
    even tell whether a given session ID exists.
    """
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.session_id == session_id
    ).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session