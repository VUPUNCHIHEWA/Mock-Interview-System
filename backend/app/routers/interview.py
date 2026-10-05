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
from app.services.progress_tracker import get_user_progress, get_comparison_options
from app.services.istqb_quiz import get_quiz_questions, grade_quiz

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
        # NOTE (BSc Research Feature, Step 2): confidence_score can now be
        # None when no face was detected in this frame (see
        # visual_analysis.py) - the DB column is nullable, so this is
        # stored as-is rather than defaulting to a misleading 0.0/fake value.
        new_metric = VisualMetric(
            session_id=session_id,
            confidence_score=analysis_result.get("visual_confidence_score"),
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
    
    import json
    history = []
    for s in sessions:
        # --- BSc Research Feature: extract confidenceLevel from
        # summary_feedback so the History list can show the AI-Predicted
        # Confidence badge without requiring a separate detail-page visit.
        confidence_level = "NOT_AVAILABLE"
        if s.summary_feedback:
            try:
                confidence_level = json.loads(s.summary_feedback).get("confidenceLevel", "NOT_AVAILABLE")
            except (json.JSONDecodeError, TypeError):
                pass

        history.append({
            "sessionId": s.session_id,
            "role": s.role,
            "difficulty": s.difficulty,
            "interviewMode": s.interview_mode,
            "overallScore": s.overall_score,
            "confidenceLevel": confidence_level,
            "status": s.status,
            "createdAt": s.created_at
        })
    return {"success": True, "history": history}

@router.get("/api/interview-session/{session_id}")
async def get_interview_session_details(session_id: str, db: Session = Depends(get_db)):
    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    responses = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id,
        InterviewResponse.user_answer != None
    ).order_by(InterviewResponse.id.asc()).all()
    
    # --- BUG FIX (consistency with end_interview_session, Function 5
    # fix): each item now carries isSkipped/isNotEvaluated flags so the
    # Interview Results page can display them distinctly instead of
    # showing a numeric score for questions that were never actually
    # scored - matching the fix already applied to the immediate
    # end-interview response.
    evaluations = []
    for r in responses:
        is_skipped = (r.user_answer == "[Skipped by student]")
        is_not_evaluated = (r.score is None and not is_skipped)
        evaluations.append({
            "question": r.question_text,
            "answer": r.user_answer,
            "score": r.score,
            "feedback": r.feedback,
            "isSkipped": is_skipped,
            "isNotEvaluated": is_not_evaluated,
        })
        
    import json
    overall_strengths = "No feedback available."
    key_improvements = ""
    textual_score = session.overall_score
    # --- BUG FIX: previously defaulted to fake placeholder values (80,
    # 80) when summary_feedback couldn't be parsed or didn't contain
    # these keys - silently fabricating "good-looking" scores instead of
    # honestly reporting that this session has no visual/vocal data.
    # Consistent with the project-wide never-fabricate-data policy
    # (see Step 2/3/Function-5 fixes) - now defaults to None, displayed
    # as "N/A" by the frontend.
    visual_score = None
    vocal_score = None
    confidence_level = "NOT_AVAILABLE"
    if session.summary_feedback:
        try:
            summary_dict = json.loads(session.summary_feedback)
            overall_strengths = summary_dict.get("overallStrengths", overall_strengths)
            key_improvements = summary_dict.get("keyImprovements", key_improvements)
            textual_score = summary_dict.get("textualScore", textual_score)
            visual_score = summary_dict.get("visualScore", visual_score)
            vocal_score = summary_dict.get("vocalScore", vocal_score)
            confidence_level = summary_dict.get("confidenceLevel", confidence_level)
        except Exception:
            overall_strengths = session.summary_feedback
        
    return {
        "success": True,
        "results": {
            "overallScore": session.overall_score,
            "overallStrengths": overall_strengths,
            "keyImprovements": key_improvements,
            "evaluations": evaluations,
            "interviewMode": session.interview_mode,
            "textualScore": textual_score,
            "visualScore": visual_score,
            "vocalScore": vocal_score,
            "confidenceLevel": confidence_level,
            # --- BSc Research Feature (Function 5, Suggestion #2/#4):
            # session context, consistent with the immediate
            # end-interview response (see interview_service.py) - fixes
            # the "role/date shows right after ending, but disappears
            # when reopened from History" inconsistency.
            "role": session.role,
            "difficulty": session.difficulty,
            "createdAt": session.created_at.isoformat() if session.created_at else None,
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


# --- BSc Research Feature (Step 5): ⭐ Progress Tracker endpoint - core
# research contribution, compares a user's sessions within a specific
# role+difficulty+interview_mode combination (see progress_tracker.py
# for the comparability-validation logic and literature citations).
#
# --- BSc Research Feature (User-Selectable Comparison): the student
# can now explicitly choose which role/difficulty/mode combination to
# view via optional query parameters (?role=X&difficulty=Y&mode=Z). If
# omitted, the system falls back to auto-selecting the largest valid
# group (backward-compatible default behavior).
@router.get("/api/progress/{user_id}")
async def get_progress(
    user_id: int,
    role: Optional[str] = None,
    difficulty: Optional[str] = None,
    mode: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        result = get_user_progress(db, user_id, role=role, difficulty=difficulty, interview_mode=mode)
        return {"success": True, **result}
    except Exception as e:
        print(f"❌ Error in get-progress: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# --- BSc Research Feature: returns the list of role/difficulty/mode
# combinations this user has 2+ completed sessions for - used to
# populate the frontend's selection dropdowns with only valid,
# comparable options (rather than letting the student pick a
# combination with insufficient data).
@router.get("/api/progress-options/{user_id}")
async def get_progress_options(user_id: int, db: Session = Depends(get_db)):
    try:
        result = get_comparison_options(db, user_id)
        return {"success": True, **result}
    except Exception as e:
        print(f"❌ Error in get-progress-options: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# --- BSc Research Feature: QA Career-Prep Practice Quiz (Supporting
# Feature, extension of Career Guidance Suggestions - see
# istqb_quiz.py for full scope/copyright disclosure). Original,
# researcher-authored MCQ questions covering ISTQB Foundation syllabus
# TOPIC AREAS - not copied from any copyrighted ISTQB exam material.
@router.get("/api/istqb-quiz")
async def get_istqb_quiz():
    try:
        questions = get_quiz_questions()
        return {"success": True, "questions": questions}
    except Exception as e:
        print(f"❌ Error in get-istqb-quiz: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/istqb-quiz/submit")
async def submit_istqb_quiz(data: dict):
    try:
        answers = data.get("answers", {})
        result = grade_quiz(answers)
        return {"success": True, **result}
    except Exception as e:
        print(f"❌ Error in submit-istqb-quiz: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))