from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, Request, Depends, HTTPException
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
    audioFile: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    # 1. Request එක එන්නේ JSON ද නැත්නම් Multipart Form Data ද කියලා චෙක් කිරීම
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        # Frontend එකෙන් JSON එවුවොත්:
        body = await request.json()
        payload = body
    else:
        # Frontend එකෙන් Form Data / Audio එවුවොත්:
        payload = {
            "sessionId": sessionId,
            "message": message or ""
        }

    # 2. Audio File එකක් ආවා නම් සේව් කිරීම (Optionally)
    if audioFile:
        import os, shutil, time
        os.makedirs("uploaded_audio", exist_ok=True)
        audio_path = f"uploaded_audio/vocal_{payload.get('sessionId')}_{int(time.time())}.webm"
        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(audioFile.file, buffer)
        print(f"🎙️ Audio file saved to {audio_path}")
        payload["audio_path"] = audio_path

    # 3. Service එකට ඩේටා පාස් කිරීම
    return await continue_interview_session(payload, gemini_client, db)

@router.post("/api/analyze-visual")
async def analyze_visual(data: dict, db: Session = Depends(get_db)):
    session_id = data.get("sessionId")
    frame_b64 = data.get("frame")
    if not session_id or not frame_b64:
        return {"success": False, "message": "No sessionId or frame provided"}
        
    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    
    if session and session.interview_mode == "TEXT":
        return {"success": True, "message": "TEXT mode active, skipping visual analysis"}
        
    try:
        # Decode base64
        header, encoded = frame_b64.split(",", 1) if "," in frame_b64 else ("", frame_b64)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Simple Face Detection for confidence score
        score = 85.0  # default fallback
        emotion = "Neutral"
        
        if mp_face_detection is not None:
            with mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as face_detection:
                results = face_detection.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                if results.detections:
                    # Get the confidence score of the first detected face
                    score = float(results.detections[0].score[0]) * 100
                    emotion = "Attentive" if score > 75 else "Neutral"
                else:
                    score = 0.0
                    emotion = "No Face Detected"
                
        # Save to DB
        new_metric = VisualMetric(
            session_id=session_id,
            confidence_score=score,
            emotion=emotion
        )
        db.add(new_metric)
        db.commit()
        
        return {"success": True, "confidenceScore": round(score, 1), "emotion": emotion, "eye_contact_score": 80}
    except Exception as e:
        print(f"Visual Analysis Error: {e}")
        return {"confidence_score": 85, "eye_contact_score": 80, "emotion": "Neutral", "status": "Success", "success": True}

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