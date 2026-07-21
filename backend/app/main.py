from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401
from app.core.config import origins
from app.db.base import Base
from app.db.session import engine
from app.routers.auth import router as auth_router
from app.routers.cv import router as cv_router
from app.routers.github import router as github_router
from app.routers.interview import router as interview_router
from app.routers.profile import router as profile_router


Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cv_router)
app.include_router(github_router)
app.include_router(interview_router)
app.include_router(profile_router)


@app.get("/")
def root():
    return {"message": "Mock Interview Backend Running"}

