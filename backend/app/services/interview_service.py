import time

from app.core.config import GEMINI_MODEL, gemini_types


interview_sessions = {}


async def start_interview_session(data: dict, client=None):
    role = data.get("role", "Software Engineer")
    difficulty = data.get("difficulty", "Medium")
    github_username = data.get("githubUsername", "N/A")
    cv_text = data.get("cvPath", "")

    session_id = f"session_{int(time.time())}"

    system_prompt = f"""
    You are an elite corporate technical interviewer conducting a mock interview for a {role} position.
    The candidate has selected a '{difficulty}' difficulty level.

    Here is the text extracted from the candidate's CV:
    {cv_text}

    Your instructions:
    1. Greet the candidate in a warm, professional corporate manner.
    2. Acknowledge one interesting highlight or skill from their CV or mention that you are excited to review their background.
    3. Ask exactly ONE technical or behavioral opening question that perfectly matches the {difficulty} level for a {role}.
    4. Do not provide answers, do not list multiple questions, and do not type out the entire chat structure. Only output the interviewer's direct words.
    """

    first_question = (
        f"Hello! Welcome to your technical mock interview for the {role} position. "
        "To start off, could you introduce yourself and talk about a challenging technical project you recently worked on?"
    )

    if client:
        try:
            config = None
            if gemini_types:
                config = gemini_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                )

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=f"Please greet the candidate and ask the first question for the {role} interview.",
                config=config,
            )
            if response.text:
                first_question = response.text.strip()
        except Exception as e:
            print(f"❌ Gemini Error during start-interview: {str(e)}")

    interview_sessions[session_id] = {
        "sessionId": session_id,
        "role": role,
        "difficulty": difficulty,
        "githubUsername": github_username,
        "cvData": cv_text,
        "chatHistory": [
            {"sender": "ai", "text": first_question},
        ],
        "status": "Ongoing",
    }

    return {
        "success": True,
        "message": "Interview session initialized with Gemini!",
        "sessionId": session_id,
        "firstQuestion": first_question,
    }


async def continue_interview_session(data: dict, client=None):
    session_id = data.get("sessionId")
    user_message = data.get("message", "")

    if not session_id or session_id not in interview_sessions:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Active interview session not found")

    session = interview_sessions[session_id]
    session["chatHistory"].append({"sender": "user", "text": user_message})

    conversation_context = ""
    for msg in session["chatHistory"]:
        role_label = "Candidate" if msg["sender"] == "user" else "Interviewer"
        conversation_context += f"{role_label}: {msg['text']}\n"

    dynamic_prompt = f"""
    You are continuing the technical mock interview for the {session['role']} role ({session['difficulty']} level).
    Here is the conversation history so far:
    {conversation_context}

    Your task:
    1. Briefly evaluate or follow up on the candidate's last response (be encouraging but critical like a real interviewer).
    2. Ask the NEXT logical technical or situational question.
    3. Keep the conversation flowing naturally. Ask exactly ONE question. Do not provide full sample solutions unless asked.
    """

    next_question = "Interesting response. Can you elaborate further on how you would handle edge cases or optimize this approach?"

    if client:
        try:
            config = None
            if gemini_types:
                config = gemini_types.GenerateContentConfig(
                    system_instruction=dynamic_prompt,
                    temperature=0.7,
                )

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents="Analyze the candidate's answer and ask the next technical question.",
                config=config,
            )
            if response.text:
                next_question = response.text.strip()
        except Exception as e:
            print(f"❌ Gemini Error during chat-interview: {str(e)}")

    session["chatHistory"].append({"sender": "ai", "text": next_question})

    return {"success": True, "nextQuestion": next_question}
