import json
import math
import time
import re
import traceback
from fastapi import HTTPException
from app.core.config import GEMINI_MODEL, gemini_client, gemini_types
from app.models import InterviewSession, InterviewResponse
from app.services.question_bank import get_next_question, AVAILABLE_ROLES
from app.services.voice_analysis import analyze_voice, compute_session_vocal_score
from app.services.ml_model import predict_confidence_level
from app.services.career_resources import get_recommended_resources

# NOTE (BSc Research Feature - Step 1): Question generation is now handled
# by the static, literature-curated question_bank module instead of Gemini.
# Gemini is still used below ONLY for answer scoring/feedback (unchanged) -
# see interview_service.py.bak for the original Gemini-question-generation
# version of this file, kept for comparison/rollback.


def clean_json_response(text: str) -> dict:
    
    if not text:
        return {}
    try:
        cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
        return json.loads(cleaned.strip())
    except Exception as e:
        print(f"⚠️ JSON Parsing failed for text: {text} | Error: {e}")
        return {}


def _parse_score(raw):
    """
    Turns a score (the camera confidence sent by the browser, or the score
    Gemini returns) into a number between 0 and 100, or None when there is
    no real value.

    Returns None (never a made-up default) for: missing, empty text,
    "null", "nan", or anything that is not a number. A genuine 0 stays 0.
    """
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if math.isnan(value) or math.isinf(value):
        return None
    return max(0.0, min(100.0, value))


async def start_interview_session(data: dict, client=None, db=None):
    active_client = client or gemini_client

    user_id = data.get("userId") or data.get("user_id") or 1
    role = data.get("role") or "Software Engineer"
    difficulty = data.get("difficulty") or "Medium"
    github_username = data.get("githubUsername") or data.get("github_username") or "N/A"
    cv_text = data.get("cvPath") or data.get("cv_text") or ""
    interview_mode = data.get("interviewMode") or data.get("interview_mode") or "TEXT"

    session_id = f"session_{int(time.time())}"

    if role not in AVAILABLE_ROLES:
        print(f"⚠️ Role '{role}' not in curated question bank {AVAILABLE_ROLES} - "
              f"using general questions only for this session.")

    first_question_data = get_next_question(role, already_asked=[], difficulty=difficulty)
    first_question = first_question_data["question"]

    if db:
        new_session = InterviewSession(
            session_id=session_id,
            user_id=user_id,
            role=role,
            difficulty=difficulty,
            interview_mode=interview_mode,
            status="Ongoing"
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        
        new_response = InterviewResponse(
            session_id=session_id,
            question_text=first_question
        )
        db.add(new_response)
        db.commit()

    return {
        "success": True,
        "message": "Interview session initialized (question bank)!",
        "sessionId": session_id,
        "firstQuestion": first_question,
    }


async def continue_interview_session(data: dict, client=None, db=None):
    active_client = client or gemini_client

    session_id = data.get("sessionId")
    user_message = data.get("message", "")
    audio_content = data.get("audio_content")
    # --- BSc Research Feature (Suggestion #1): Skip Question support -
    # lets a student move past a question they cannot answer, rather
    # than being blocked and unable to complete the fixed-6-question
    # session. A skipped answer is saved with a placeholder text and
    # score=0 (not evaluated by Gemini), consistent with the project's
    # data-integrity policy of never fabricating a "real" evaluation for
    # data that doesn't exist. This is flagged in the response so the
    # frontend can show it distinctly.
    is_skip = data.get("skipQuestion", False)

    if not session_id or not db:
        raise HTTPException(status_code=400, detail="Active interview session ID and DB session required")

    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active interview session not found")

    user_id = session.user_id
    audio_path = None
    voice_metrics = None

    # --- Skip Question handling: bypass audio processing entirely if
    # this is a skip (no real answer was given, so nothing to analyze).
    if not is_skip and audio_content:
        try:
            import os, time
            folder_path = f"uploads/user_{user_id}/session_{session_id}"
            os.makedirs(folder_path, exist_ok=True)
            audio_path = f"{folder_path}/audio_{int(time.time())}.webm"
            
            with open(audio_path, "wb") as buffer:
                buffer.write(audio_content)
            print(f"🎙️ Audio file saved to {audio_path}")

            import speech_recognition as sr
            from pydub import AudioSegment
            
            wav_path = audio_path.replace(".webm", ".wav")
            audio = AudioSegment.from_file(audio_path, format="webm")
            audio.export(wav_path, format="wav")
            
            recognizer = sr.Recognizer()
            with sr.AudioFile(wav_path) as source:
                audio_data = recognizer.record(source)
                transcribed_text = recognizer.recognize_google(audio_data)
                
            user_message = f"{user_message} {transcribed_text}".strip()
            print(f"🎙️ Transcribed Audio: {transcribed_text}")

            voice_metrics = analyze_voice(transcribed_text, wav_path)
            print(f"🎙️ Voice metrics: {voice_metrics}")
        except Exception as e:
            print(f"❌ Audio processing error: {e}")

    # Real visual score only. None means "no valid camera reading" - it is
    # NOT replaced by a default (a missing measurement must never look like
    # a good one).
    vci = _parse_score(data.get("visualConfidenceScore"))

    last_response = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id
    ).order_by(InterviewResponse.id.desc()).first()
    
    last_question = last_response.question_text if last_response else "Introduction and Project Overview"
    
    if last_response and not last_response.user_answer:
        # --- Skip Question: save a placeholder answer, score=0, and a
        # clear "[Skipped]" feedback marker - never send a skipped
        # question to Gemini for evaluation (there is no real answer to
        # evaluate), consistent with the never-fabricate-data policy.
        if is_skip:
            last_response.user_answer = "[Skipped by student]"
            last_response.score = 0
            last_response.feedback = "[Skipped - not evaluated]"
            db.commit()
        else:
            last_response.user_answer = user_message
            if audio_path:
                last_response.audio_path = audio_path

            if voice_metrics:
                last_response.filler_word_count = voice_metrics["filler_word_count"]
                last_response.long_pause_count = voice_metrics["long_pause_count"]
                last_response.pitch_variation = voice_metrics["pitch_variation"]

            if vci is not None:
                last_response.visual_confidence_score = vci

            db.commit()

    # What we tell Gemini about delivery must be real measurements only.
    if vci is not None:
        visual_line = f"{vci:.1f}/100"
    else:
        visual_line = "not available (no valid camera reading for this answer)"

    if voice_metrics:
        pitch = voice_metrics.get("pitch_variation")
        pitch_text = f"{pitch:.1f}" if isinstance(pitch, (int, float)) else "not available"
        vocal_context = (
            f"Measured from audio: {voice_metrics.get('filler_word_count')} filler words, "
            f"{voice_metrics.get('long_pause_count')} long pauses (over 3 seconds), "
            f"pitch variation {pitch_text}"
        )
    elif audio_path:
        vocal_context = "not available (audio was recorded but could not be analysed)"
    else:
        vocal_context = "not available (text-only response)"

    if session.interview_mode and session.interview_mode.upper() == "TEXT":
        dynamic_prompt = f"""
    You are an expert technical interviewer evaluating a candidate for a {session.role} role ({session.difficulty} level).
    
    Question Asked: "{last_question}"
    Candidate's Answer (Text/Transcribed): "{user_message}"

    Tasks:
    1. Evaluate the candidate's answer EXCLUSIVELY for logical and relevant accuracy (Score 0-100). Do not judge grammar or delivery.
    2. Write 1-2 sentences of specific feedback highlighting technical correctness and logic.

    CRITICAL: Respond STRICTLY in valid JSON format using this exact structure:
    {{
        "score": 85,
        "feedback": "Your answer covered..."
    }}
    Do NOT add any intro, outro, or additional text outside the JSON object.
    """
    else:
        dynamic_prompt = f"""
    You are an expert technical interviewer evaluating a candidate for a {session.role} role ({session.difficulty} level).
    
    Question Asked: "{last_question}"
    Candidate's Answer (Text/Transcribed): "{user_message}"
    Visual Confidence Score (from camera analysis): {visual_line}
    Vocal Delivery Context: {vocal_context}

    Tasks:
    1. Evaluate the candidate's answer for technical accuracy, clarity, and depth (Textual Score).
    2. Integrate the Textual Score with the provided Visual Confidence Score and Vocal Delivery to calculate an OVERALL integrated score (0-100). 
       - Weighting suggestion: 60% Textual (Logical value), 20% Visual, 20% Vocal.
       - If the Visual Confidence Score or Vocal Delivery is marked "not available", do NOT guess or invent it - base the score only on the information that IS available.
       - NOTE (BSc Research): this 60/20/20 weighting is an
         ASSUMPTION - not literature-derived - carried over from the
         original implementation. See RESEARCH_DOCUMENTATION.md for the
         project's citation-transparency policy on such assumptions.
    3. Write 1-2 sentences of specific feedback highlighting technical correctness and any behavioral/delivery notes.

    CRITICAL: Respond STRICTLY in valid JSON format using this exact structure:
    {{
        "score": 85,
        "feedback": "Your answer covered..."
    }}
    Do NOT add any intro, outro, or additional text outside the JSON object.
    """

    # No real evaluation yet. The score stays None (NOT a made-up number such
    # as 75) until Gemini returns a valid one. A None score is shown to the
    # student as "Not Evaluated" and is left out of the averages.
    default_eval = {
        "score": None,
        "feedback": "Your answer was recorded, but it could not be evaluated automatically this time.",
    }

    # Skip questions never call Gemini - there is no real answer to
    # evaluate, and last_response.score is already set to 0 above.
    if is_skip:
        default_eval = {"score": 0, "feedback": "[Skipped - not evaluated]"}
    elif active_client:
        try:
            config = None
            if gemini_types:
                config = gemini_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4,
                )

            response = active_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=dynamic_prompt,
                config=config,
            )

            if response and response.text:
                print("📥 Raw Gemini Evaluation Response:", response.text)
                parsed_json = clean_json_response(response.text)
                gemini_score = _parse_score(parsed_json.get("score")) if isinstance(parsed_json, dict) else None
                if gemini_score is not None:
                    default_eval = {
                        "score": gemini_score,
                        "feedback": parsed_json.get("feedback") or "",
                    }
                    print(f"✅ Gemini Evaluation Success: Score={default_eval.get('score')}")
                else:
                    print("⚠️ Gemini response had no valid score - answer left as Not Evaluated.")
        except Exception as e:
            error_msg = str(e).lower()
            print(f"❌ Gemini Error during chat-interview: {str(e)}")
            traceback.print_exc()
            if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                return {
                    "success": False,
                    "limit_exceeded": True,
                    "message": "Gemini API reach limit exceeded. Please try again later."
                }

    if last_response and last_response.score is None:
        last_response.score = default_eval.get("score")
        last_response.feedback = default_eval.get("feedback", "")
        db.commit()

    MAX_QUESTIONS_PER_SESSION = 6

    already_asked_rows = db.query(InterviewResponse.question_text).filter(
        InterviewResponse.session_id == session_id
    ).all()
    already_asked = [row[0] for row in already_asked_rows]

    if len(already_asked) >= MAX_QUESTIONS_PER_SESSION:
        return {
            "success": True,
            "nextQuestion": None,
            "sessionComplete": True,
            "evaluation": {
                "score": default_eval.get("score"),
                "feedback": default_eval.get("feedback", ""),
            },
        }

    next_question_data = get_next_question(session.role, already_asked, difficulty=session.difficulty)
    next_question = next_question_data["question"]

    new_question_db = InterviewResponse(
        session_id=session_id,
        question_text=next_question
    )
    db.add(new_question_db)
    db.commit()

    session_complete_after_this = len(already_asked) + 1 >= MAX_QUESTIONS_PER_SESSION

    return {
        "success": True,
        "nextQuestion": next_question,
        "sessionComplete": False,
        "isLastQuestion": session_complete_after_this,
        "evaluation": {
            "score": default_eval.get("score"),
            "feedback": default_eval.get("feedback", ""),
        },
    }


async def end_interview_session(data: dict, client=None, db=None):
    active_client = client or gemini_client

    session_id = data.get("sessionId")
    if not session_id or not db:
        raise HTTPException(status_code=400, detail="Active interview session ID and DB session required")

    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active interview session not found")

    # --- BSc Research Feature (Suggestion #5, Function 5 fix): skipped
    # and not-evaluated (Gemini rate-limit) questions were previously
    # EXCLUDED from the query entirely, meaning they silently
    # disappeared from the Q&A Breakdown shown to the student - creating
    # a transparency gap ("why do I only see 4 of my 6 questions?").
    # Now we fetch ALL attempted questions (anything with a saved
    # answer, including skips) for DISPLAY, but keep a separate,
    # narrower list of only genuinely-scored answers for the AVERAGE
    # calculation - preserving the earlier fairness fix (skips don't
    # drag down the average) while restoring full transparency.
    full_responses = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id,
        InterviewResponse.user_answer != None
    ).order_by(InterviewResponse.id.asc()).all()

    evaluations = []
    for r in full_responses:
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

    # Scored-only subset (excludes skips and not-yet-evaluated answers)
    # used for the textual-score average - same fairness principle as
    # before.
    responses = [
        r for r in full_responses
        if r.score is not None and r.user_answer != "[Skipped by student]"
    ]

    total_score = sum(eval_item.get("score", 0) for eval_item in evaluations if eval_item.get("score") is not None and not eval_item["isSkipped"])
    avg_score = int(total_score / len(responses)) if responses else 0

    from app.models import VisualMetric
    visual_metrics = db.query(VisualMetric).filter(VisualMetric.session_id == session_id).all()

    valid_visual_scores = [m.confidence_score for m in visual_metrics if m.confidence_score is not None]
    frames_excluded = len(visual_metrics) - len(valid_visual_scores)
    if frames_excluded > 0:
        print(f"⚠️ {frames_excluded}/{len(visual_metrics)} visual frames had no face "
              f"detected and were excluded from the average (session {session_id}).")

    if valid_visual_scores:
        avg_visual = sum(valid_visual_scores) / len(valid_visual_scores)
    else:
        avg_visual = None
    
    # NOTE: uses full_responses (not the scored-only subset) because
    # audio processing (filler/pause/pitch) happens independently of
    # Gemini's scoring - a "Not Evaluated" (Gemini rate-limit) answer
    # can still have real, valid voice metrics that would otherwise be
    # incorrectly lost from this average.
    responses_with_audio = [r for r in full_responses if r.filler_word_count is not None]
    if responses_with_audio:
        avg_filler = sum(r.filler_word_count for r in responses_with_audio) / len(responses_with_audio)
        avg_pause = sum(r.long_pause_count for r in responses_with_audio) / len(responses_with_audio)
        avg_pitch = sum(r.pitch_variation for r in responses_with_audio) / len(responses_with_audio)
        final_vocal = compute_session_vocal_score(avg_filler, avg_pause, avg_pitch)
        vocal_context = (f"Avg filler words: {avg_filler:.1f}, avg long pauses: {avg_pause:.1f}, "
                          f"avg pitch variation: {avg_pitch:.1f}")
    else:
        final_vocal = None
        vocal_context = "No audio answers were recorded in this session."
        avg_filler, avg_pause, avg_pitch = None, None, None

    audio_responses = sum(1 for r in full_responses if r.audio_path)
    textual_score = avg_score
    overall_strengths = "Candidate demonstrated foundational technical knowledge."
    key_improvements = "Focus on explaining real-world architecture and edge cases."
    final_visual = int(avg_visual) if avg_visual is not None else None

    confidence_level = predict_confidence_level(avg_visual, avg_filler, avg_pause, avg_pitch)
    print(f"🌳 ML Core - Predicted Confidence Level: {confidence_level}")

    if active_client and evaluations:
        try:
            is_text_mode = session.interview_mode and session.interview_mode.upper() == "TEXT"
            
            if is_text_mode:
                summary_prompt = f"""
                You are a senior technical interviewer summarizing a mock interview.

                Session Data:
                - Textual Evaluations (Q&A): {json.dumps(evaluations, indent=2)}

                Provide a highly detailed, constructive, and organized summary of the candidate's performance for a {session.role} role.
                Focus strictly on technical accuracy, logical reasoning, and depth of knowledge.

                You must provide:
                1. "overallStrengths": An array of 3-5 specific, detailed bullet points highlighting what the candidate did well.
                2. "keyImprovements": An array of 3-5 specific, actionable bullet points for areas they need to improve.
                3. "textualScore": An overall score (0-100) based strictly on technical accuracy.
                
                Return STRICTLY a JSON object with keys:
                "overallStrengths" (array of strings), "keyImprovements" (array of strings), "textualScore" (integer)
                """
            else:
                summary_prompt = f"""
                You are a senior technical interviewer summarizing a mock interview.

                Session Data:
                - Textual Evaluations (Q&A): {json.dumps(evaluations, indent=2)}
                - Visual Confidence Average (from camera, measured by facial-landmark
                  tracking - for your context only, do not re-score this): {avg_visual}/100
                - Vocal Delivery Metrics (measured from audio, for your context only,
                  do not re-score this): {vocal_context}

                Provide a highly detailed, constructive, and organized summary of the candidate's performance for a {session.role} role.
                
                You must provide:
                1. "overallStrengths": An array of 3-5 specific, detailed bullet points highlighting what the candidate did well technically and communicatively (you may reference the visual/vocal context above descriptively).
                2. "keyImprovements": An array of 3-5 specific, actionable bullet points for areas they need to improve.
                3. "textualScore": based on technical accuracy and depth of their spoken/written answers ONLY.
                
                Return STRICTLY a JSON object with keys:
                "overallStrengths" (array of strings), "keyImprovements" (array of strings), "textualScore" (integer)
                """
            
            config = None
            if gemini_types:
                config = gemini_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4,
                )

            response = active_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=summary_prompt,
                config=config,
            )

            if response and response.text:
                print("📥 Raw Gemini Summary Response:", response.text)
                summary_data = clean_json_response(response.text)
                overall_strengths = summary_data.get("overallStrengths", overall_strengths)
                key_improvements = summary_data.get("keyImprovements", key_improvements)
                textual_score = summary_data.get("textualScore", textual_score)
        except Exception as e:
            print(f"❌ Gemini Error during end-interview: {str(e)}")
            traceback.print_exc()

    if session.interview_mode and session.interview_mode.upper() == "TEXT":
        final_overall = textual_score
    else:
        components = [(textual_score, 0.6)]
        if final_visual is not None:
            components.append((final_visual, 0.2))
        if final_vocal is not None:
            components.append((final_vocal, 0.2))

        weight_sum = sum(w for _, w in components)
        final_overall = int(sum(score * (w / weight_sum) for score, w in components))

    session.status = "Completed"
    session.overall_score = final_overall
    
    summary_dict = {
        "overallStrengths": overall_strengths,
        "keyImprovements": key_improvements,
        "textualScore": textual_score,
        "visualScore": final_visual,
        "vocalScore": final_vocal,
        "confidenceLevel": confidence_level
    }
    session.summary_feedback = json.dumps(summary_dict)
    
    db.commit()

    # --- BSc Research Feature: Career Guidance Suggestions (Supporting
    # Feature, NOT a core research contribution - see career_resources.py
    # docstring for full scope disclosure). Only triggers when the
    # content/textual score indicates a genuine knowledge gap; behavioral
    # weaknesses (visual/vocal) already have actionable tips via the
    # Progress Tracker's Focus Area feature.
    recommended_resources = get_recommended_resources(session.role, textual_score)
    
    return {
        "success": True,
        "overallScore": final_overall,
        "overallStrengths": overall_strengths,
        "keyImprovements": key_improvements,
        "evaluations": evaluations,
        "interviewMode": session.interview_mode,
        "confidenceLevel": confidence_level,
        "textualScore": textual_score,
        "visualScore": final_visual,
        "vocalScore": final_vocal,
        "role": session.role,
        "difficulty": session.difficulty,
        "createdAt": session.created_at.isoformat() if session.created_at else None,
        "recommendedResources": recommended_resources,
    }