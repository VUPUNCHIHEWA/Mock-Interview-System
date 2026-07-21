from fastapi import APIRouter, Body

from app.core.config import gemini_client
from app.services.interview_service import continue_interview_session, start_interview_session


router = APIRouter()


@router.post("/api/start-interview")
async def start_interview(data: dict = Body(...)):
    return await start_interview_session(data, gemini_client)


@router.post("/api/chat-interview")
async def chat_interview(data: dict = Body(...)):
    return await continue_interview_session(data, gemini_client)
