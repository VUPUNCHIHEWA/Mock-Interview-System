import json
import time
import re
import traceback
from fastapi import HTTPException
from app.core.config import GEMINI_MODEL, gemini_client, gemini_types
from app.models import InterviewSession, InterviewResponse


def clean_json_response(text: str) -> dict:
    
    if not text:
        return {}
    try:
        # Remove ```json and ``` codeblock wrappers
        cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
        return json.loads(cleaned.strip())
    except Exception as e:
        print(f"⚠️ JSON Parsing failed for text: {text} | Error: {e}")
        return {}


async def start_interview_session(data: dict, client=None, db=None):
    # Ensure client is available
    active_client = client or gemini_client

    user_id = data.get("userId") or data.get("user_id") or 1
    role = data.get("role") or "Software Engineer"
    difficulty = data.get("difficulty") or "Medium"
    github_username = data.get("githubUsername") or data.get("github_username") or "N/A"
    cv_text = data.get("cvPath") or data.get("cv_text") or ""
    interview_mode = data.get("interviewMode") or data.get("interview_mode") or "TEXT"

    session_id = f"session_{int(time.time())}"

    system_prompt = f"""
    You are an elite corporate technical interviewer conducting a mock interview for a {role} position.
    Difficulty Level: {difficulty}.

    Candidate's CV Summary/Text:
    {cv_text}

    Instructions:
    1. Greet the candidate professionally by name if present in CV.
    2. Acknowledge one specific project/skill from their CV.
    3. Ask exactly ONE technical opening question matching the {difficulty} level for a {role}.
    """

    first_question = (
        f"Hello! Welcome to your technical mock interview for the {role} position. "
        "Could you introduce yourself and talk about a challenging technical project you recently worked on?"
    )

    if active_client:
        try:
            prompt_text = f"{system_prompt}\n\nPlease greet the candidate and ask the first question for the {role} interview."

            response = active_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt_text,
            )
            if response and response.text:
                print("Raw Gemini First Question:", response.text)
                first_question = response.text.strip()
        except Exception as e:
            print(f"❌ Gemini Error during start-interview: {str(e)}")
            traceback.print_exc()

    # Database persistence
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
        
        # Save first question as a response waiting for answer
        new_response = InterviewResponse(
            session_id=session_id,
            question_text=first_question
        )
        db.add(new_response)
        db.commit()

    return {
        "success": True,
        "message": "Interview session initialized with Gemini!",
        "sessionId": session_id,
        "firstQuestion": first_question,
    }


async def continue_interview_session(data: dict, client=None, db=None):
    # Ensure client is available
    active_client = client or gemini_client

    session_id = data.get("sessionId")
    user_message = data.get("message", "")
    audio_content = data.get("audio_content")

    if not session_id or not db:
        raise HTTPException(status_code=400, detail="Active interview session ID and DB session required")

    session = db.query(InterviewSession).filter(InterviewSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active interview session not found")

    user_id = session.user_id
    audio_path = None

    if audio_content:
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
        except Exception as e:
            print(f"❌ Audio processing error: {e}")



    # Get the last unanswered question
    last_response = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id
    ).order_by(InterviewResponse.id.desc()).first()
    
    last_question = last_response.question_text if last_response else "Introduction and Project Overview"
    
    # Save user's answer immediately
    if last_response and not last_response.user_answer:
        last_response.user_answer = user_message
        if audio_path:
            last_response.audio_path = audio_path
        db.commit()

    dynamic_prompt = f"""
    You are an expert technical interviewer evaluating a candidate for a {session.role} role ({session.difficulty} level).
    
    Question Asked: "{last_question}"
    Candidate's Answer: "{user_message}"

    Tasks:
    1. Evaluate the candidate's answer for technical accuracy, clarity, and depth.
    2. Assign a score between 0 and 100 based strictly on accuracy.
    3. Write 1-2 sentences of specific feedback highlighting correct points or missing details.
    4. Generate exactly ONE logical next technical question based on their answer.

    CRITICAL: Respond STRICTLY in valid JSON format using this exact structure:
    {{
        "score": 85,
        "feedback": "Your answer covered...",
        "nextQuestion": "Your next question..."
    }}
    Do NOT add any intro, outro, or additional text outside the JSON object.
    """

    default_eval = {
        "score": 75,
        "feedback": "Answer recorded successfully. Try providing deeper implementation details.",
        "nextQuestion": "Could you explain how you would handle edge cases or error handling in this scenario?",
    }

    if active_client:
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
                if parsed_json and "score" in parsed_json:
                    default_eval = parsed_json
                    print(f"✅ Gemini Evaluation Success: Score={default_eval.get('score')}")
                else:
                    print("⚠️ JSON parsed but missing expected keys.")
        except Exception as e:
            print(f"❌ Gemini Error during chat-interview: {str(e)}")
            traceback.print_exc()

    if last_response and last_response.score is None:
        last_response.score = default_eval.get("score", 75)
        last_response.feedback = default_eval.get("feedback", "")
        db.commit()

    # Save next question
    next_question = default_eval.get("nextQuestion", "Can you elaborate further on your previous answer?")
    new_question_db = InterviewResponse(
        session_id=session_id,
        question_text=next_question
    )
    db.add(new_question_db)
    db.commit()

    return {
        "success": True,
        "nextQuestion": next_question,
        "evaluation": {
            "score": default_eval.get("score", 75),
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

    responses = db.query(InterviewResponse).filter(
        InterviewResponse.session_id == session_id,
        InterviewResponse.score != None
    ).all()
    
    evaluations = []
    for r in responses:
        evaluations.append({
            "question": r.question_text,
            "answer": r.user_answer,
            "score": r.score,
            "feedback": r.feedback
        })

    total_score = sum(eval_item.get("score", 0) for eval_item in evaluations)
    avg_score = int(total_score / len(evaluations)) if evaluations else 0

    overall_strengths = "Candidate demonstrated foundational technical knowledge."
    key_improvements = "Focus on explaining real-world architecture and edge cases."

    if active_client and evaluations:
        try:
            summary_prompt = f"""
            You are a senior technical interviewer summarizing a mock interview.

            Summarize the candidate's performance for a {session.role} role based on these Q&A evaluations:
            {json.dumps(evaluations, indent=2)}
            
            Return STRICTLY a JSON object with keys "overallStrengths" and "keyImprovements".
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
        except Exception as e:
            print(f"❌ Gemini Error during end-interview: {str(e)}")
            traceback.print_exc()

    session.status = "Completed"
    session.overall_score = avg_score
    
    summary_dict = {
        "overallStrengths": overall_strengths,
        "keyImprovements": key_improvements
    }
    session.summary_feedback = json.dumps(summary_dict)
    
    db.commit()
    
    return {
        "success": True,
        "overallScore": avg_score,
        "overallStrengths": overall_strengths,
        "keyImprovements": key_improvements,
        "evaluations": evaluations
    }