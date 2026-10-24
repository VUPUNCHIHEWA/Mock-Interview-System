from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, Request, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user, ensure_same_user, get_owned_session
from app.models import User, InterviewSession, InterviewResponse, VisualMetric, CustomPracticeQuestion
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
from app.services.voice_analysis import confidence_missing_reason, answer_speech_rate
from app.services.confidence_feedback import build_confidence_feedback
from app.services.custom_practice import core_sessions_only, CUSTOM_PRACTICE_ROLE
from app.services.interview_service import continue_interview_session, start_interview_session, end_interview_session, replace_current_question, REPLACED_ANSWER_MARKER, stored_main_score
from app.services.progress_tracker import get_user_progress, get_comparison_options, get_progress_timeline

router = APIRouter()


@router.post("/api/start-interview")
async def start_interview(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    print(f"📥 Received payload for start-interview: {data}")
    # SECURITY: the owner of the session is always the logged-in user (from
    # the token), never whatever userId the client claims in the request body.
    data["userId"] = current_user.id
    data.pop("user_id", None)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
            "visualConfidenceScore": form.get("visualConfidenceScore"),
            # Focus (voice) interview mode: save the answer now, but let
            # Gemini check ALL answers together at the end of the interview.
            "deferEvaluation": form.get("deferEvaluation"),
            # Browser speech-to-text, used only if the server-side
            # transcription of the recording fails.
            "fallbackTranscript": form.get("fallbackTranscript"),
        }

    
    # SECURITY: only the owner of the session may answer in it.
    if payload.get("sessionId"):
        get_owned_session(db, payload["sessionId"], current_user)

    if audio_file:
        audio_content = await audio_file.read()
        payload["audio_content"] = audio_content

    
    return await continue_interview_session(payload, gemini_client, db)

from fastapi.concurrency import run_in_threadpool
from app.services.visual_analysis import analyze_frame

@router.post("/api/analyze-visual")
async def analyze_visual(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session_id = data.get("sessionId")
    # The frontend payload might use "image_base64" or "frame"
    frame_b64 = data.get("image_base64") or data.get("frame")
    
    if not session_id or not frame_b64:
        return {"status": "ERROR", "warning_message": "No sessionId or frame provided"}
        
    session = get_owned_session(db, session_id, current_user)
    
    if session.interview_mode == "TEXT":
        return {"status": "SKIPPED", "warning_message": "TEXT mode active, skipping visual analysis"}
        
    try:
        # Call the new Visual Analysis Engine
        # analyze_frame() is heavy, blocking CPU work (MediaPipe/OpenCV).
        # Running it in a worker thread keeps the server's event loop free,
        # so other requests are not stuck behind it.
        # Personal "looking at the camera" offset measured in the camera check
        # (optional - missing if the student skipped the check).
        gaze_baseline = data.get("gazeBaseline") if isinstance(data.get("gazeBaseline"), dict) else None
        analysis_result = await run_in_threadpool(analyze_frame, frame_b64, session_id, gaze_baseline)

        # A frame that could not be processed (technical error), or a frame
        # where nothing could be measured, is NOT a measurement - do not store
        # it. (Storing it would turn it into 0, because confidence_score has a
        # database default of 0.0.)
        if (analysis_result.get("status") == "ERROR"
                or (analysis_result.get("status") == "FACE_DETECTED"
                    and analysis_result.get("visual_confidence_score") is None)):
            return analysis_result
        
        # Save to DB metric history
        # NOTE (BSc Research Feature, Step 2): confidence_score can now be
        # None when no face was detected in this frame (see
        # visual_analysis.py) - the DB column is nullable, so this is
        # stored as-is rather than defaulting to a misleading 0.0/fake value.
        new_metric = VisualMetric(
            session_id=session_id,
            confidence_score=analysis_result.get("visual_confidence_score"),
            # Status label: eye-contact status, or "NO_FACE" when the face was
            # not visible (used for the "face not visible" % on the results).
            emotion=("NO_FACE" if analysis_result.get("status") == "NO_FACE_DETECTED"
                     else analysis_result.get("eye_contact_status", "UNKNOWN")),
            # Per-factor scores, used for the Eye Contact / Head Pose
            # breakdown on the results page.
            gaze_score=analysis_result.get("gaze_score"),
            head_stability_score=analysis_result.get("head_stability_score"),
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

# --- ASSUMPTION - not literature-derived --- minimum Head Pose score (0-100)
# for the camera test to count the student as "facing the camera" (75 = head
# turned at most about 15 deg; see HEAD_* angles in visual_analysis.py).
DEVICE_TEST_MIN_HEAD_SCORE = 75


# Pre-interview camera test: checks whether the face can be seen well enough
# for the interview detectors. Nothing is stored (there is no interview
# session yet) - it only tells the test page what the detector sees.
@router.post("/api/check-face")
async def check_face(data: dict, current_user: User = Depends(get_current_user)):
    frame_b64 = data.get("image_base64") or data.get("frame")
    if not frame_b64:
        return {"status": "ERROR", "warning_message": "No frame provided"}
    result = await run_in_threadpool(analyze_frame, frame_b64, "device-test")
    # "Ready" = the main detector (MediaPipe) found the face, could measure the
    # head angle, and the student is roughly facing the camera. A face found
    # only by the weaker fallback detector usually means poor lighting or
    # framing, so it does not count as ready.
    head = result.get("head_stability_score")
    if result.get("status") != "FACE_DETECTED":
        reason = "TOO_DARK" if "dark" in (result.get("warning_message") or "").lower() else "NO_FACE"
    elif head is None:
        reason = "FACE_UNCLEAR"
    elif head < DEVICE_TEST_MIN_HEAD_SCORE:
        reason = "NOT_FACING_CAMERA"
    else:
        reason = "OK"
    result["ready"] = reason == "OK"
    result["reason"] = reason
    return result


# Focus interview: the student's face was not visible for 30 s in a row
# after a question was asked -> drop that question and give a new one.
@router.post("/api/replace-question")
async def replace_question(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.get("sessionId"):
        get_owned_session(db, data["sessionId"], current_user)
    return await replace_current_question(data, db)


@router.get("/api/audio-file/{response_id}")
async def get_audio_file(response_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    response_record = db.query(InterviewResponse).filter(InterviewResponse.id == response_id).first()
    if not response_record:
        raise HTTPException(status_code=404, detail="Response not found")
        
    # SECURITY: ownership is checked against the logged-in user (token),
    # not against a user_id the caller supplies.
    get_owned_session(db, response_record.session_id, current_user)
        
    if not response_record.audio_path:
        raise HTTPException(status_code=404, detail="No audio file associated with this response")
        
    import os
    if not os.path.exists(response_record.audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found on server")
        
    return FileResponse(response_record.audio_path, media_type="audio/webm")

@router.post("/api/end-interview")
async def end_interview(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_owned_session(db, data.get("sessionId"), current_user)
    return await end_interview_session(data, gemini_client, db)

@router.get("/api/interview-history/{user_id}")
async def get_interview_history(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    # Custom Practice sessions (supporting feature) are kept out of My
    # Interviews so they never mix with the standard interviews (D7).
    sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id,
        core_sessions_only(InterviewSession.role),
    ).order_by(InterviewSession.created_at.desc()).all()
    
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
            # Main (confidence) score; None for sessions scored with the
            # older formula (see stored_main_score).
            "overallScore": stored_main_score(s),
            "confidenceLevel": confidence_level,
            "status": s.status,
            "createdAt": s.created_at
        })
    return {"success": True, "history": history}

# --- Supporting feature: Practice History (Custom Practice sessions ONLY).
# A separate list so practice reports can be reopened, while My Interviews
# and the Progress page stay limited to the standard (core) interviews (D7, D11).
# Reports open through /api/interview-session/{id} and are deleted through the
# normal delete endpoint, both of which check that the session is the user's.
@router.get("/api/practice-history/{user_id}")
async def get_practice_history(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id,
        InterviewSession.role == CUSTOM_PRACTICE_ROLE,
    ).order_by(InterviewSession.created_at.desc()).all()

    import json
    items = []
    for s in sessions:
        confidence_level = "NOT_AVAILABLE"
        if s.summary_feedback:
            try:
                confidence_level = json.loads(s.summary_feedback).get("confidenceLevel", "NOT_AVAILABLE")
            except (json.JSONDecodeError, TypeError):
                pass
        questions = [q.question_text for q in db.query(CustomPracticeQuestion).filter(
            CustomPracticeQuestion.session_id == s.session_id
        ).order_by(CustomPracticeQuestion.position.asc()).all()]
        items.append({
            "sessionId": s.session_id,
            "status": s.status,
            "createdAt": s.created_at,
            "overallScore": stored_main_score(s) if s.status == "Completed" else None,
            "confidenceLevel": confidence_level,
            "questionCount": len(questions),
            "questions": questions,
        })
    return {"success": True, "history": items}

@router.get("/api/interview-session/{session_id}")
async def get_interview_session_details(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = get_owned_session(db, session_id, current_user)
        
    responses = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id,
        InterviewResponse.user_answer != None,
        InterviewResponse.user_answer != REPLACED_ANSWER_MARKER,
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
            # Per-answer delivery info (explainability): speaking speed and
            # answer time. None for answers without voice measures.
            "speechRate": answer_speech_rate(r) if r.filler_word_count is not None else None,
            "answerSeconds": r.speech_seconds,
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
    visual_breakdown = None
    vocal_breakdown = None
    replaced_questions = 0
    ai_models = None
    confidence_score = None
    scoring_version = 1
    confidence_level = "NOT_AVAILABLE"
    if session.summary_feedback:
        try:
            summary_dict = json.loads(session.summary_feedback)
            overall_strengths = summary_dict.get("overallStrengths", overall_strengths)
            key_improvements = summary_dict.get("keyImprovements", key_improvements)
            textual_score = summary_dict.get("textualScore", textual_score)
            visual_score = summary_dict.get("visualScore", visual_score)
            vocal_score = summary_dict.get("vocalScore", vocal_score)
            visual_breakdown = summary_dict.get("visualBreakdown", visual_breakdown)
            vocal_breakdown = summary_dict.get("vocalBreakdown", vocal_breakdown)
            replaced_questions = summary_dict.get("replacedQuestions", 0)
            ai_models = summary_dict.get("aiModels")
            confidence_score = summary_dict.get("confidenceScore")
            scoring_version = summary_dict.get("scoringVersion", 1)
            confidence_level = summary_dict.get("confidenceLevel", confidence_level)
        except Exception:
            overall_strengths = session.summary_feedback

    # Confidence Score needs BOTH camera and voice. Sessions saved earlier
    # with a camera-only (or voice-only) score are shown as N/A.
    is_text_mode = bool(session.interview_mode and session.interview_mode.upper() == "TEXT")
    confidence_note = None
    if not is_text_mode and scoring_version >= 2:
        if visual_score is None or vocal_score is None:
            confidence_score = None
            confidence_level = "NOT_AVAILABLE"
        confidence_note = confidence_missing_reason(visual_score, vocal_score)
    # Confidence feedback is rebuilt from the stored measurements, so reports
    # saved before this change (which had an AI summary of the answers) also
    # show confidence-only strengths and improvements. Old 60/20/20 sessions
    # (scoringVersion 1) keep what was saved with them.
    if not is_text_mode and scoring_version >= 2 and (visual_breakdown or vocal_breakdown):
        overall_strengths, key_improvements = build_confidence_feedback(visual_breakdown, vocal_breakdown)
    main_score = stored_main_score(session)

    return {
        "success": True,
        "results": {
            "overallScore": main_score,
            # Older sessions: their old overall score (60% answer + 20% visual
            # + 20% vocal), shown separately so it is not mistaken for a
            # confidence score.
            "legacyOverallScore": session.overall_score if (main_score is None and scoring_version < 2 and not is_text_mode) else None,
            "confidenceScore": confidence_score,
            "confidenceMissingReason": confidence_note,
            "scoringVersion": scoring_version,
            "overallStrengths": overall_strengths,
            "keyImprovements": key_improvements,
            "evaluations": evaluations,
            "interviewMode": session.interview_mode,
            "textualScore": textual_score,
            "visualScore": visual_score,
            "vocalScore": vocal_score,
            "visualBreakdown": visual_breakdown,
            "vocalBreakdown": vocal_breakdown,
            "replacedQuestions": replaced_questions,
            "aiModels": ai_models,
            "sessionId": session.session_id,
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
async def delete_interview_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = get_owned_session(db, session_id, current_user)
        
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_same_user(user_id, current_user)
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
async def get_progress_options(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    try:
        result = get_comparison_options(db, user_id)
        return {"success": True, **result}
    except Exception as e:
        print(f"❌ Error in get-progress-options: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# Progress page: every completed session with its overall score and the 5
# confidence-factor scores, for the time chart and the history cards.
@router.get("/api/progress-timeline/{user_id}")
async def get_progress_timeline_route(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_same_user(user_id, current_user)
    try:
        return {"success": True, **get_progress_timeline(db, user_id)}
    except Exception as e:
        print(f"❌ Error in get-progress-timeline: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))