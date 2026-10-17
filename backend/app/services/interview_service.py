import io
import json
import math
import os
import time
import re
import traceback
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from app.core.config import GEMINI_MODEL, gemini_client, gemini_types
from app.models import InterviewSession, InterviewResponse, CustomPracticeQuestion
from app.services.question_bank import get_next_question, AVAILABLE_ROLES, GENERAL_INTERVIEW_ROLE
from app.services.voice_analysis import (analyze_voice, compute_session_vocal, combine_confidence,
                                         confidence_missing_reason, answer_speech_rate)
from app.services.ml_model import predict_confidence_level
from app.services.confidence_feedback import build_confidence_feedback
from app.services.custom_practice import (CUSTOM_PRACTICE_ROLE, is_custom_practice, core_sessions_only,
                                          clean_custom_questions, shuffled)
from app.services.career_resources import get_recommended_resources
from app.services import ai_provider

# --- Privacy: raw voice recordings ------------------------------------------
# The consent page promises participant data is used "solely for providing
# interview feedback". Once an answer has been transcribed and measured, the
# recording itself is no longer needed, so it is DELETED by default. Only the
# results are kept (the transcript text and the filler / pause / pitch numbers).
# To keep recordings (for example in a pilot study, WITH participant consent),
# set KEEP_AUDIO_RECORDINGS=true in backend/.env
KEEP_AUDIO_RECORDINGS = os.getenv("KEEP_AUDIO_RECORDINGS", "false").strip().lower() == "true"


def _delete_audio_files(webm_path):
    """
    Deletes a recording and its .wav copy, then removes the session / user
    folders if they are now empty. Never raises: a cleanup problem must not
    break the interview.
    """
    if not webm_path:
        return
    for path in (webm_path, webm_path.replace(".webm", ".wav")):
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except OSError as e:
            print(f"⚠️ Could not delete {path}: {e}")

    folder = os.path.dirname(webm_path)
    for _ in range(2):  # session folder, then user folder
        try:
            os.rmdir(folder)  # only succeeds when the folder is empty
        except OSError:
            break
        folder = os.path.dirname(folder)

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


# --- Speech-to-text & scoring ----------------------------------------------
# All AI calls go through app/services/ai_provider.py:
#   speech-to-text: Groq Whisper large-v3 -> Gemini (backup) -> free Google
#                   Web Speech (last resort)
#   scoring/summary: Groq Llama 3.3 70B -> Gemini (backup)
# (Gemini alone hit its free daily limit within 1-2 interviews.)


# --- Auto-replaced questions -------------------------------------------------
# If the student's face is not visible for 30 s in a row after a question
# was asked (e.g. they had to leave suddenly), the frontend abandons that
# question: its camera data is deleted, it does NOT count toward the 6
# questions, and a NEW question replaces it (a new one, so leaving on
# purpose to look up an answer gives no advantage).
REPLACED_ANSWER_MARKER = "[Replaced - face not visible for 30 s]"

# A voice answer with no real speech in it (student stayed silent). Saved
# with score 0 and NOT sent to the AI, so a Whisper "silence word" such as
# "Thank you." can never be scored as if it were the student's answer.
NO_SPEECH_MARKER = "[No spoken answer detected]"
NO_SPEECH_FEEDBACK = "No speech was detected in your recording, so this answer was not evaluated."

# Scoring version saved with each session (see end_interview_session).
SCORING_VERSION = 2

# Questions in a standard interview (Custom Practice asks all its questions).
MAX_QUESTIONS_PER_SESSION = 6


def stored_main_score(session):
    """
    The session's main (confidence) score for lists and charts, or None for
    sessions scored with the older formula (60% answer + 20% visual + 20%
    vocal), whose overall score means something different and must not be
    mixed with the new one.
    """
    if session.interview_mode and session.interview_mode.upper() == "TEXT":
        return session.overall_score
    try:
        summary = json.loads(session.summary_feedback) if session.summary_feedback else {}
    except Exception:
        summary = {}
    if (summary or {}).get("scoringVersion", 1) >= SCORING_VERSION:
        # Both parts are needed. Sessions saved before this rule, where the
        # score came from camera (or voice) alone, are shown as N/A too.
        if summary.get("visualScore") is None or summary.get("vocalScore") is None:
            return None
        return session.overall_score
    return None



def _question_history(db, user_id, current_session_id=None) -> dict:
    """
    Questions this student was asked in EARLIER interview sessions, as
    {question_text: recency} (larger number = asked more recently). Used so a
    student who practises many times does not keep getting the same
    questions (see question_bank._next_general_question).
    """
    if not db or user_id is None:
        return {}
    try:
        rows = db.query(InterviewResponse.question_text).join(
            InterviewSession, InterviewSession.session_id == InterviewResponse.session_id
        ).filter(
            InterviewSession.user_id == user_id,
            InterviewSession.session_id != (current_session_id or ""),
            # Custom Practice questions are the student's own, not bank
            # questions, so they never affect which bank questions come next.
            core_sessions_only(InterviewSession.role),
        ).order_by(InterviewResponse.id.asc()).all()
    except Exception as e:
        print(f"⚠️ Could not read question history ({e}) - questions may repeat.")
        return {}
    history = {}
    for index, (text,) in enumerate(rows):
        if text:
            history[text] = index  # later rows overwrite -> most recent use
    return history


# --- Custom Practice (supporting feature, see custom_practice.py) ----------
def _custom_questions(db, session_id):
    """The student's questions for this session, in asking order."""
    rows = db.query(CustomPracticeQuestion).filter(
        CustomPracticeQuestion.session_id == session_id
    ).order_by(CustomPracticeQuestion.position.asc()).all()
    return [r.question_text for r in rows]


async def replace_current_question(data: dict, db=None):
    from app.models import VisualMetric

    session_id = data.get("sessionId")
    if not session_id or not db:
        raise HTTPException(status_code=400, detail="Active interview session ID and DB session required")
    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active interview session not found")

    current = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id
    ).order_by(InterviewResponse.id.desc()).first()
    if not current or current.user_answer is not None:
        raise HTTPException(status_code=400, detail="There is no open question to replace")

    # 1) Delete the camera frames recorded for this question. Frames are only
    #    recorded while a question is open, so everything stored after the
    #    question was created belongs to it.
    deleted = db.query(VisualMetric).filter(
        VisualMetric.session_id == session_id,
        VisualMetric.timestamp >= current.created_at,
    ).delete(synchronize_session=False)

    # 2) Mark the abandoned question (kept so it is never asked again).
    current.user_answer = REPLACED_ANSWER_MARKER
    current.score = None
    current.feedback = REPLACED_ANSWER_MARKER

    # 3) A new question in its place.
    if is_custom_practice(session):
        # Custom Practice uses only the student's own list, so the same
        # question is asked again (practice only - no study data, D9).
        new_question = current.question_text
    else:
        asked = [row[0] for row in db.query(InterviewResponse.question_text).filter(
            InterviewResponse.session_id == session_id).all()]
        history = _question_history(db, session.user_id, session_id)
        new_question = get_next_question(session.role, asked, difficulty=session.difficulty,
                                         history=history)["question"]
    db.add(InterviewResponse(session_id=session_id, question_text=new_question))
    db.commit()
    print(f"🔁 Question replaced (face not visible 30 s); {deleted} camera frames discarded.")

    return {"success": True, "nextQuestion": new_question, "framesDiscarded": deleted}


def _interview_context(session) -> str:
    """How the interview is described to Gemini in prompts."""
    if is_custom_practice(session):
        return ("a practice interview using questions the candidate chose themselves "
                "(they may be technical IT questions or general interview questions)")
    if session.role == GENERAL_INTERVIEW_ROLE:
        return "a general job interview (general, non-role-specific questions)"
    return f"a {session.role} role ({session.difficulty} level)"


async def start_interview_session(data: dict, client=None, db=None):
    active_client = client or gemini_client

    user_id = data.get("userId") or data.get("user_id") or 1
    role = data.get("role") or "Software Engineer"
    difficulty = data.get("difficulty") or "Medium"
    github_username = data.get("githubUsername") or data.get("github_username") or "N/A"
    cv_text = data.get("cvPath") or data.get("cv_text") or ""
    interview_mode = data.get("interviewMode") or data.get("interview_mode") or "TEXT"

    session_id = f"session_{int(time.time())}"

    # Custom Practice (supporting feature): the student's own questions.
    custom_questions = None
    if data.get("customQuestions") is not None:
        custom_questions, error = clean_custom_questions(data.get("customQuestions"))
        if error:
            raise HTTPException(status_code=400, detail=error)
        custom_questions = shuffled(custom_questions)
        role = CUSTOM_PRACTICE_ROLE

    # General Interview has no job role and no level.
    if role in (GENERAL_INTERVIEW_ROLE, CUSTOM_PRACTICE_ROLE):
        difficulty = None

    if role not in AVAILABLE_ROLES and role not in (GENERAL_INTERVIEW_ROLE, CUSTOM_PRACTICE_ROLE):
        print(f"⚠️ Role '{role}' not in curated question bank {AVAILABLE_ROLES} - "
              f"using general questions only for this session.")

    if custom_questions:
        first_question = custom_questions[0]
    else:
        history = _question_history(db, user_id)
        first_question_data = get_next_question(role, already_asked=[], difficulty=difficulty,
                                                history=history)
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

        if custom_questions:
            for position, text in enumerate(custom_questions):
                db.add(CustomPracticeQuestion(session_id=session_id, position=position, question_text=text))
            db.commit()
        
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
        # Custom Practice asks every uploaded question; standard interviews ask 6.
        "totalQuestions": len(custom_questions) if custom_questions else MAX_QUESTIONS_PER_SESSION,
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

    # Focus (voice) interview mode: answers are only SAVED here (audio is
    # still transcribed and voice-analysed now). Gemini checks all answers
    # together at the end, in end_interview_session(), so the student never
    # waits for Gemini between questions.
    defer_evaluation = str(data.get("deferEvaluation", "")).strip().lower() in ("true", "1", "yes")
    fallback_transcript = (data.get("fallbackTranscript") or "").strip()

    if not session_id or not db:
        raise HTTPException(status_code=400, detail="Active interview session ID and DB session required")

    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active interview session not found")

    user_id = session.user_id
    audio_path = None
    voice_metrics = None
    audio_received = bool(audio_content) and not is_skip

    # --- Skip Question handling: bypass audio processing entirely if
    # this is a skip (no real answer was given, so nothing to analyze).
    if not is_skip and audio_content:
        try:
            folder_path = f"uploads/user_{user_id}/session_{session_id}"
            os.makedirs(folder_path, exist_ok=True)
            audio_path = f"{folder_path}/audio_{int(time.time())}.webm"
            
            with open(audio_path, "wb") as buffer:
                buffer.write(audio_content)
            print(f"🎙️ Audio file saved to {audio_path}")

            wav_path = audio_path.replace(".webm", ".wav")

            def _convert_and_transcribe():
                # Blocking work (audio conversion + speech-to-text). Run in a
                # worker thread (below) so it does not freeze live camera
                # analysis while it runs.
                from pydub import AudioSegment

                audio = AudioSegment.from_file(audio_path, format="webm")
                audio.export(wav_path, format="wav")

                # Groq Whisper -> Gemini -> Google Web Speech (see ai_provider.py)
                text, engine = ai_provider.transcribe(audio, wav_path)
                print(f"🎙️ Transcribed with {engine}.")
                return text

            transcribed_text = await run_in_threadpool(_convert_and_transcribe)

            user_message = f"{user_message} {transcribed_text}".strip()
            print(f"🎙️ Transcribed Audio: {transcribed_text!r}")

            # No speech -> no voice metrics (0 fillers / 0 pauses from a
            # silent clip would wrongly look like good delivery).
            if transcribed_text.strip():
                voice_metrics = await run_in_threadpool(analyze_voice, transcribed_text, wav_path)
                print(f"🎙️ Voice metrics: {voice_metrics}")
        except Exception as e:
            print(f"❌ Audio processing error: {e}")
        finally:
            # Privacy: delete the recording as soon as it has been analysed
            # (also when analysis failed). audio_path becomes None so no path
            # to a deleted file is saved in the database.
            if not KEEP_AUDIO_RECORDINGS and audio_path:
                _delete_audio_files(audio_path)
                audio_path = None

    # If server-side transcription failed (or no audio arrived), fall back to
    # the browser's own speech-to-text so the answer text is not lost.
    if not is_skip and not user_message.strip() and fallback_transcript:
        user_message = fallback_transcript
        print("🎙️ Using browser transcript as fallback answer text.")

    # Voice answer, but nothing was said (server AND browser heard nothing).
    no_speech = audio_received and not user_message.strip()
    if no_speech:
        print("🔇 No spoken answer - saved as 'no answer', not sent to the AI.")

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
        elif no_speech:
            last_response.user_answer = NO_SPEECH_MARKER
            last_response.score = 0
            last_response.feedback = NO_SPEECH_FEEDBACK
            if vci is not None:
                last_response.visual_confidence_score = vci
            db.commit()
        else:
            last_response.user_answer = user_message
            if audio_path:
                last_response.audio_path = audio_path

            if voice_metrics:
                last_response.filler_word_count = voice_metrics["filler_word_count"]
                last_response.long_pause_count = voice_metrics["long_pause_count"]
                last_response.pitch_variation = voice_metrics["pitch_variation"]
                last_response.speech_seconds = voice_metrics.get("speech_seconds")
                last_response.long_pause_seconds = voice_metrics.get("long_pause_seconds")
                last_response.pitch_pvq = voice_metrics.get("pitch_pvq")

            if vci is not None:
                last_response.visual_confidence_score = vci

            db.commit()

    # What we tell Gemini about delivery must be real measurements only.
    if vci is not None:
        visual_line = f"{vci:.1f}/100"
    else:
        visual_line = "not available (no valid camera reading for this answer)"

    if voice_metrics:
        pvq = voice_metrics.get("pitch_pvq")
        pitch_text = f"{pvq:.3f} (pitch variation quotient)" if isinstance(pvq, (int, float)) else "not available"
        seconds = voice_metrics.get("speech_seconds")
        seconds_text = f" in {seconds:.0f} s of answer time" if isinstance(seconds, (int, float)) else ""
        words = voice_metrics.get("word_count")
        speak_s = (seconds or 0) - (voice_metrics.get("long_pause_seconds") or 0)
        rate_text = f"{words / (speak_s / 60.0):.0f} words per minute" if words and speak_s > 0 else "speech rate not available"
        vocal_context = (
            f"Measured from audio: {rate_text}{seconds_text}, "
            f"{voice_metrics.get('long_pause_count')} long pauses (3 seconds or more), "
            f"pitch variation {pitch_text}"
        )
    elif audio_received:
        vocal_context = "not available (audio was recorded but could not be analysed)"
    else:
        vocal_context = "not available (text-only response)"

    if session.interview_mode and session.interview_mode.upper() == "TEXT":
        dynamic_prompt = f"""
    You are an expert technical interviewer evaluating a candidate for {_interview_context(session)}.
    
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
    You are an expert technical interviewer evaluating a candidate for {_interview_context(session)}.
    
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
    elif no_speech:
        default_eval = {"score": 0, "feedback": NO_SPEECH_FEEDBACK}
    elif defer_evaluation:
        # Evaluated later, together with all other answers.
        default_eval = {"score": None, "feedback": None}
    elif ai_provider.available():
        parsed_json, engine = await run_in_threadpool(
            ai_provider.generate_json, dynamic_prompt, 0.4, "evaluation")
        answer_score = _parse_score(parsed_json.get("score")) if isinstance(parsed_json, dict) else None
        if answer_score is not None:
            default_eval = {"score": answer_score, "feedback": parsed_json.get("feedback") or ""}
            print(f"✅ Evaluation success ({engine}): Score={answer_score}")
        else:
            print("⚠️ No valid score from any AI provider - answer left as Not Evaluated.")

    if last_response and last_response.score is None and not defer_evaluation:
        last_response.score = default_eval.get("score")
        last_response.feedback = default_eval.get("feedback", "")
        db.commit()

    custom_list = _custom_questions(db, session_id) if is_custom_practice(session) else None
    max_questions = len(custom_list) if custom_list else MAX_QUESTIONS_PER_SESSION

    already_asked_rows = db.query(InterviewResponse.question_text).filter(
        InterviewResponse.session_id == session_id
    ).all()
    already_asked = [row[0] for row in already_asked_rows]
    # Questions replaced because the face was not visible do not count
    # toward the 6 (they are still in already_asked so they are never repeated).
    replaced_count = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id,
        InterviewResponse.user_answer == REPLACED_ANSWER_MARKER,
    ).count()
    counted_questions = len(already_asked) - replaced_count

    if counted_questions >= max_questions:
        return {
            "success": True,
            "nextQuestion": None,
            "sessionComplete": True,
            "evaluation": {
                "score": default_eval.get("score"),
                "feedback": default_eval.get("feedback", ""),
            },
        }

    if custom_list:
        # Next question in the student's (shuffled) list.
        next_question = custom_list[counted_questions]
    else:
        history = _question_history(db, session.user_id, session_id)
        next_question_data = get_next_question(session.role, already_asked, difficulty=session.difficulty,
                                               history=history)
        next_question = next_question_data["question"]

    new_question_db = InterviewResponse(
        session_id=session_id,
        question_text=next_question
    )
    db.add(new_question_db)
    db.commit()

    session_complete_after_this = counted_questions + 1 >= max_questions

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


async def _evaluate_pending_answers(session, responses, active_client, db):
    # Returns the AI engine that scored the answers (or None).
    """
    Focus (voice) interview mode: Gemini checks ALL saved-but-unscored
    answers in ONE request at the end of the interview, instead of one
    request after every answer. Answers Gemini cannot score stay None
    ("Not Evaluated") - never a made-up number.
    """
    pending = [
        r for r in responses
        if r.score is None and r.user_answer is not None
        and r.user_answer != "[Skipped by student]"
    ]
    if not pending or not ai_provider.available():
        return None

    items = [
        {"index": i, "question": r.question_text, "answer": r.user_answer or ""}
        for i, r in enumerate(pending)
    ]
    batch_prompt = f"""
    You are an expert technical interviewer evaluating a candidate for {_interview_context(session)}.
    The answers below were spoken by the candidate and transcribed automatically.

    Questions and answers (JSON):
    {json.dumps(items, indent=2)}

    For EACH item:
    1. Score the answer 0-100 for technical accuracy, relevance and depth ONLY.
       Do not judge grammar, transcription errors or delivery.
       An empty or off-topic answer gets a low score.
    2. Write 1-2 sentences of specific feedback on technical correctness.

    CRITICAL: Respond STRICTLY in valid JSON using this exact structure:
    {{
        "evaluations": [
            {{"index": 0, "score": 85, "feedback": "Your answer covered..."}}
        ]
    }}
    Include one entry for every index. Do NOT add any text outside the JSON object.
    """

    engine = None
    try:
        parsed, engine = await run_in_threadpool(
            ai_provider.generate_json, batch_prompt, 0.4, "batch evaluation")
        results = parsed.get("evaluations", []) if isinstance(parsed, dict) else []
        for item in results:
            if not isinstance(item, dict):
                continue
            try:
                idx = int(item.get("index"))
            except (TypeError, ValueError):
                continue
            if not 0 <= idx < len(pending):
                continue
            score = _parse_score(item.get("score"))
            if score is None:
                continue
            pending[idx].score = score
            pending[idx].feedback = item.get("feedback") or ""
        db.commit()
        print(f"✅ Batch evaluation ({engine}) saved for {len(results)} of {len(pending)} answers.")
    except Exception as e:
        print(f"❌ Error during batch evaluation: {str(e)}")
        traceback.print_exc()

    # Anything still unscored is shown honestly as "Not Evaluated".
    for r in pending:
        if r.score is None and not r.feedback:
            r.feedback = "Your answer was recorded, but it could not be evaluated automatically this time."
    db.commit()
    return engine


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
        InterviewResponse.user_answer != None,
        InterviewResponse.user_answer != REPLACED_ANSWER_MARKER,
    ).order_by(InterviewResponse.id.asc()).all()
    replaced_questions = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id,
        InterviewResponse.user_answer == REPLACED_ANSWER_MARKER,
    ).count()

    # Focus (voice) interview mode: check all saved answers together now.
    evaluation_engine = await _evaluate_pending_answers(session, full_responses, active_client, db)

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
            # Per-answer delivery info (explainability): speaking speed and
            # answer time. None for answers without voice measures.
            "speechRate": answer_speech_rate(r) if r.filler_word_count is not None else None,
            "answerSeconds": r.speech_seconds,
        })

    # Scored-only subset (excludes skips and not-yet-evaluated answers)
    # used for the textual-score average - same fairness principle as
    # before.
    responses = [
        r for r in full_responses
        if r.score is not None and r.user_answer != "[Skipped by student]"
    ]

    total_score = sum(eval_item.get("score", 0) for eval_item in evaluations if eval_item.get("score") is not None and not eval_item["isSkipped"])
    # None (not 0) when no answer could be scored yet (e.g. AI service busy):
    # "not checked yet" must never count as a 0 answer score.
    avg_score = int(total_score / len(responses)) if responses else None

    from app.models import VisualMetric
    visual_metrics = db.query(VisualMetric).filter(VisualMetric.session_id == session_id).all()

    valid_visual_scores = [m.confidence_score for m in visual_metrics if m.confidence_score is not None]
    frames_excluded = len(visual_metrics) - len(valid_visual_scores)
    if frames_excluded > 0:
        print(f"⚠️ {frames_excluded}/{len(visual_metrics)} visual frames could not be "
              f"processed (technical error) and were excluded from the average (session {session_id}).")

    if valid_visual_scores:
        avg_visual = sum(valid_visual_scores) / len(valid_visual_scores)
    else:
        avg_visual = None

    # Per-factor visual breakdown (Eye Contact = gaze score, Head Pose =
    # head stability score), averaged over frames where a face was found.
    # Frames saved before these columns existed have no value and are
    # skipped, so the breakdown is simply missing for older sessions.
    gaze_values = [m.gaze_score for m in visual_metrics if m.gaze_score is not None]
    head_values = [m.head_stability_score for m in visual_metrics if m.head_stability_score is not None]
    visual_breakdown = None
    if gaze_values or head_values:
        # Share of measured time (listening + answering) where the face was not visible
        # (those frames already count as 0 in Eye Contact / Head Pose).
        measured_frames = [m for m in visual_metrics if m.confidence_score is not None]
        no_face_frames = sum(1 for m in measured_frames if m.emotion == "NO_FACE")
        visual_breakdown = {
            "eyeContact": round(sum(gaze_values) / len(gaze_values), 1) if gaze_values else None,
            "headPose": round(sum(head_values) / len(head_values), 1) if head_values else None,
            "faceNotVisiblePct": round(100.0 * no_face_frames / len(measured_frames), 1) if measured_frames else None,
        }
    
    # NOTE: uses full_responses (not the scored-only subset) because
    # audio processing (filler/pause/pitch) happens independently of
    # Gemini's scoring - a "Not Evaluated" (Gemini rate-limit) answer
    # can still have real, valid voice metrics that would otherwise be
    # incorrectly lost from this average.
    responses_with_audio = [r for r in full_responses if r.filler_word_count is not None]
    # Vocal score (see voice_analysis.py / VOCAL_SCORING.md).
    vocal_result = compute_session_vocal(responses_with_audio)
    final_vocal = vocal_result["vocalScore"]
    vocal_breakdown = vocal_result["vocalBreakdown"]
    if responses_with_audio:
        # Raw per-answer averages: only used as inputs for the decision-tree
        # model (ml_model.py), which was trained on these numbers.
        avg_filler = sum(r.filler_word_count for r in responses_with_audio) / len(responses_with_audio)
        avg_pause = sum(r.long_pause_count or 0 for r in responses_with_audio) / len(responses_with_audio)
        avg_pitch = sum(r.pitch_variation or 0 for r in responses_with_audio) / len(responses_with_audio)
    else:
        avg_filler, avg_pause, avg_pitch = None, None, None
    audio_responses = sum(1 for r in full_responses if r.audio_path)
    textual_score = avg_score
    # Empty until filled below - never a made-up placeholder sentence.
    overall_strengths = []
    key_improvements = []
    final_visual = int(avg_visual) if avg_visual is not None else None

    # The AI confidence level also needs BOTH camera and voice: with no
    # measured voice it is "NOT_AVAILABLE", never a camera-only guess.
    if avg_visual is None or final_vocal is None:
        confidence_level = "NOT_AVAILABLE"
    else:
        confidence_level = predict_confidence_level(avg_visual, avg_filler, avg_pause, avg_pitch)
    print(f"🌳 ML Core - Predicted Confidence Level: {confidence_level}")

    summary_engine = None
    is_text_mode = bool(session.interview_mode and session.interview_mode.upper() == "TEXT")

    if not is_text_mode:
        # CONFIDENCE FEEDBACK (research scope): strengths and improvements
        # come ONLY from the measured confidence factors (eye contact, head
        # pose, speech rate, long pauses, pitch variation) - rule-based,
        # explainable and reproducible (confidence_feedback.py, C6-C8).
        # Answer content is NOT judged here; it has its own Answer Score
        # (the average of the per-answer scores) and per-question feedback.
        overall_strengths, key_improvements = build_confidence_feedback(visual_breakdown, vocal_breakdown)
    elif ai_provider.available() and evaluations:
        # Text-only mode has no camera or voice, so there is nothing to say
        # about confidence: the older AI summary of the answers is kept.
        try:
            summary_prompt = f"""
            You are a senior technical interviewer summarizing a mock interview.

            Session Data:
            - Textual Evaluations (Q&A): {json.dumps(evaluations, indent=2)}

            Provide a highly detailed, constructive, and organized summary of the candidate's performance in {_interview_context(session)}.
            Focus strictly on technical accuracy, logical reasoning, and depth of knowledge.

            You must provide:
            1. "overallStrengths": An array of 3-5 specific, detailed bullet points highlighting what the candidate did well.
            2. "keyImprovements": An array of 3-5 specific, actionable bullet points for areas they need to improve.
            3. "textualScore": An overall score (0-100) based strictly on technical accuracy.
            
            Return STRICTLY a JSON object with keys:
            "overallStrengths" (array of strings), "keyImprovements" (array of strings), "textualScore" (integer)
            """

            summary_data, summary_engine = await run_in_threadpool(
                ai_provider.generate_json, summary_prompt, 0.4, "summary")
            if isinstance(summary_data, dict):
                overall_strengths = summary_data.get("overallStrengths", overall_strengths)
                key_improvements = summary_data.get("keyImprovements", key_improvements)
                textual_score = summary_data.get("textualScore", textual_score)
        except Exception as e:
            print(f"❌ Error during end-interview summary: {str(e)}")
            traceback.print_exc()

    # MAIN SCORE = CONFIDENCE SCORE = average of the visual and vocal scores
    # (the study measures confidence). The answer score (textual_score) is
    # reported separately and is NOT part of it, so a busy AI service never
    # delays the main score. Text-only mode has no camera/voice, so there
    # the answer score is the only score.
    if session.interview_mode and session.interview_mode.upper() == "TEXT":
        confidence_score = None
        confidence_note = None
        final_overall = textual_score
    else:
        # Needs BOTH camera and voice - never camera (or voice) alone.
        confidence_score = combine_confidence(final_visual, final_vocal)
        confidence_note = confidence_missing_reason(final_visual, final_vocal)
        final_overall = confidence_score

    # When this runs again ("Evaluate now" after a limit), keep the earlier
    # model record for anything that did not need scoring this time.
    try:
        previous_models = (json.loads(session.summary_feedback) or {}).get("aiModels") or {} if session.summary_feedback else {}
    except Exception:
        previous_models = {}
    evaluation_engine = evaluation_engine or previous_models.get("evaluation")
    summary_engine = summary_engine or previous_models.get("summary")

    session.status = "Completed"
    session.overall_score = final_overall
    
    summary_dict = {
        "overallStrengths": overall_strengths,
        "keyImprovements": key_improvements,
        "textualScore": textual_score,
        "visualScore": final_visual,
        "vocalScore": final_vocal,
        "confidenceScore": confidence_score,
        "confidenceMissingReason": confidence_note,
        # 2 = main score is the confidence score (visual + vocal) with the
        # per-minute / time-share / PVQ vocal scoring. Older sessions (no
        # version) used 60% answer + 20% visual + 20% vocal.
        "scoringVersion": SCORING_VERSION,
        "visualBreakdown": visual_breakdown,
        "vocalBreakdown": vocal_breakdown,
        "replacedQuestions": replaced_questions,
        "confidenceLevel": confidence_level,
        # Which AI did the scoring - keep sessions from different models
        # apart when analysing research data.
        "aiModels": {"evaluation": evaluation_engine, "summary": summary_engine},
    }
    session.summary_feedback = json.dumps(summary_dict)
    
    db.commit()

    # --- BSc Research Feature: Career Guidance Suggestions (Supporting
    # Feature, NOT a core research contribution - see career_resources.py
    # docstring for full scope disclosure). Only triggers when the
    # content/textual score indicates a genuine knowledge gap; behavioral
    # weaknesses (visual/vocal) already have actionable tips via the
    # Progress Tracker's Focus Area feature.
    if session.role in (GENERAL_INTERVIEW_ROLE, CUSTOM_PRACTICE_ROLE):
        # Learning resources are role-based; General Interview and Custom
        # Practice have no role.
        recommended_resources = {"triggered": False, "resources": [], "reason": None}
    else:
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
        "confidenceScore": confidence_score,
        "confidenceMissingReason": confidence_note,
        "scoringVersion": SCORING_VERSION,
        "visualBreakdown": visual_breakdown,
        "vocalBreakdown": vocal_breakdown,
        "replacedQuestions": replaced_questions,
        "aiModels": {"evaluation": evaluation_engine, "summary": summary_engine},
        "sessionId": session.session_id,
        "role": session.role,
        "difficulty": session.difficulty,
        "createdAt": session.created_at.isoformat() if session.created_at else None,
        "recommendedResources": recommended_resources,
    }