from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, Request, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.models import InterviewSession, InterviewResponse, VisualMetric
from app.core.config import gemini_client
import base64
import numpy as np
import cv2
try:
    import mediapipe as mp
    mp_solutions = getattr(mp, 'solutions', None)
    mp_face_detection = getattr(mp_solutions, 'face_detection', None) if mp_solutions else None
except Exception:
    mp = None
    mp_face_detection = None
from app.services.interview_service import continue_interview_session, start_interview_session, end_interview_session

router = APIRouter()


@router.post("/api/start-interview")
async def start_interview(data: dict, db: Session = Depends(get_db)):
    print(f"📥 Received payload for start-interview: {data}")
    try:
        return await start_interview_session(data, gemini_client, db)
    except Exception as e:
        print(f"❌ Error in start-interview: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/chat-interview")
async def chat_interview(
    request: Request,
    sessionId: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        
        body = await request.json()
        payload = body
    else:
        form = await request.form()
        payload = {
            "sessionId": sessionId,
            "message": message or "",
            "visualConfidenceScore": form.get("visualConfidenceScore")
        }

    
    if audio_file:
        audio_content = await audio_file.read()
        payload["audio_content"] = audio_content

    
    return await continue_interview_session(payload, gemini_client, db)

from app.services.visual_analysis import analyze_frame

@router.post("/api/analyze-visual")
async def analyze_visual(data: dict, db: Session = Depends(get_db)):
    session_id = data.get("sessionId")
    # The frontend payload might use "image_base64" or "frame"
    frame_b64 = data.get("image_base64") or data.get("frame")
    
    if not session_id or not frame_b64:
        return {"status": "ERROR", "warning_message": "No sessionId or frame provided"}
        
    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    
    if session and session.interview_mode == "TEXT":
        return {"status": "SKIPPED", "warning_message": "TEXT mode active, skipping visual analysis"}
        
    try:
        # Call the new Visual Analysis Engine
        analysis_result = analyze_frame(frame_b64, session_id)
        
        # Save to DB metric history
        new_metric = VisualMetric(
            session_id=session_id,
            confidence_score=analysis_result.get("visual_confidence_score", 0.0),
            emotion=analysis_result.get("eye_contact_status", "UNKNOWN")  # Storing status here for compatibility
        )
        db.add(new_metric)
        db.commit()
        
        return analysis_result
    except Exception as e:
        print(f"Visual Analysis Route Error: {e}")
        return {
            "status": "ERROR",
            "visual_confidence_score": 0.0,
            "gaze_score": 0.0,
            "head_stability_score": 0.0,
            "eye_contact_status": "UNKNOWN",
            "head_pose_status": "UNKNOWN",
            "warning_message": str(e)
        }

@router.get("/api/audio-file/{response_id}")
async def get_audio_file(response_id: int, user_id: int, db: Session = Depends(get_db)):
    response_record = db.query(InterviewResponse).filter(InterviewResponse.id == response_id).first()
    if not response_record:
        raise HTTPException(status_code=404, detail="Response not found")
        
    session = db.query(InterviewSession).filter(InterviewSession.session_id == response_record.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this audio file")
        
    if not response_record.audio_path:
        raise HTTPException(status_code=404, detail="No audio file associated with this response")
        
    import os
    if not os.path.exists(response_record.audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found on server")
        
    return FileResponse(response_record.audio_path, media_type="audio/webm")

@router.post("/api/end-interview")
async def end_interview(data: dict, db: Session = Depends(get_db)):
    return await end_interview_session(data, gemini_client, db)

@router.get("/api/interview-history/{user_id}")
async def get_interview_history(user_id: int, db: Session = Depends(get_db)):
    sessions = db.query(InterviewSession).filter(InterviewSession.user_id == user_id).order_by(InterviewSession.created_at.desc()).all()
    
    history = []
    for s in sessions:
        history.append({
            "sessionId": s.session_id,
            "role": s.role,
            "difficulty": s.difficulty,
            "interviewMode": s.interview_mode,
            "overallScore": s.overall_score,
            "status": s.status,
            "createdAt": s.created_at
        })
    return {"success": True, "history": history}

@router.get("/api/interview-session/{session_id}")
async def get_interview_session_details(session_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    responses = db.query(InterviewResponse).filter(InterviewResponse.session_id == session_id).order_by(InterviewResponse.created_at.asc()).all()
    
    evaluations = []
    for r in responses:
        evaluations.append({
            "question": r.question_text,
            "answer": r.user_answer,
            "score": r.score,
            "feedback": r.feedback
        })
        
    import json
    overall_strengths = "No feedback available."
    key_improvements = ""
    if session.summary_feedback:
        try:
            summary_dict = json.loads(session.summary_feedback)
            overall_strengths = summary_dict.get("overallStrengths", overall_strengths)
            key_improvements = summary_dict.get("keyImprovements", key_improvements)
        except Exception:
            overall_strengths = session.summary_feedback
        
    return {
        "success": True,
        "results": {
            "overallScore": session.overall_score,
            "overallStrengths": overall_strengths,
            "keyImprovements": key_improvements,
            "evaluations": evaluations
        }
    }

@router.delete("/api/interview-session/{session_id}")
async def delete_interview_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    db.delete(session)
    db.commit()
    
    return {"success": True, "message": "Interview session deleted successfully"}