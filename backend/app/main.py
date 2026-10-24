from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401
from app.core.config import origins
from app.db.base import Base
from app.db.session import engine
from app.routers.auth import router as auth_router
from app.routers.cv import router as cv_router
from app.routers.interview import router as interview_router
from app.routers.profile import router as profile_router


Base.metadata.create_all(bind=engine)


def _add_missing_visual_metric_columns():
    # create_all() only creates NEW tables - it does not add new columns to
    # a table that already exists. This adds the per-factor visual columns
    # (eye contact / head pose) to an existing visual_metrics table once,
    # so old databases keep working without being dropped.
    from sqlalchemy import inspect, text
    existing = {c["name"] for c in inspect(engine).get_columns("visual_metrics")}
    with engine.begin() as conn:
        for col in ("gaze_score", "head_stability_score"):
            if col not in existing:
                conn.execute(text(f"ALTER TABLE visual_metrics ADD COLUMN {col} FLOAT"))
                print(f"✅ Added column visual_metrics.{col}")
    # Vocal scoring columns on interview_responses (answer time, long-pause
    # time, pitch variation quotient).
    existing = {c["name"] for c in inspect(engine).get_columns("interview_responses")}
    with engine.begin() as conn:
        for col in ("speech_seconds", "long_pause_seconds", "pitch_pvq"):
            if col not in existing:
                conn.execute(text(f"ALTER TABLE interview_responses ADD COLUMN {col} FLOAT"))
                print(f"✅ Added column interview_responses.{col}")


_add_missing_visual_metric_columns()

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
app.include_router(interview_router)
app.include_router(profile_router)


@app.get("/")
def root():
    return {"message": "Mock Interview Backend Running"}