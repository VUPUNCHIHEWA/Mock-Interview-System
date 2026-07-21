import os

from dotenv import load_dotenv

try:
    from google import genai
except Exception:
    genai = None


load_dotenv()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def get_gemini_client():
    if not genai:
        return None

    try:
        if GEMINI_API_KEY and GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE":
            return genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        return None

    return None


gemini_client = get_gemini_client()
gemini_types = getattr(genai, "types", None) if genai else None

