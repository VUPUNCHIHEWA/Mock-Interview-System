"""
ai_provider.py

One place for all the AI calls the interview needs:
  * transcribe(audio)      - speech-to-text of a recorded answer
  * generate_json(prompt)  - answer scoring / interview summary (JSON reply)

Provider order (automatic fallback):
  1. Groq   - Whisper large-v3 (speech-to-text) + Llama 3.3 70B (scoring).
              Much higher free limits than Gemini and much faster.
  2. Gemini - backup, used only if Groq is not set up or fails.
  3. (speech-to-text only) free Google Web Speech API - last resort.

Set in backend/.env (see GROQ_SETUP_GUIDE.md):
  GROQ_API_KEY=...                 (required for Groq)
  GROQ_STT_MODEL=whisper-large-v3  (optional)
  GROQ_LLM_MODEL=llama-3.3-70b-versatile (optional)
  AI_PROVIDER=groq                 (optional: "gemini" makes Gemini first)

If a provider says "rate limit" (HTTP 429), the call waits briefly and tries
again before falling back to the next provider.
"""

import io
import json
import os
import re
import time

from app.core.config import GEMINI_MODEL, gemini_client, gemini_types

try:
    from groq import Groq
except Exception:  # package not installed
    Groq = None

GROQ_API_KEY = (os.getenv("GROQ_API_KEY") or "").strip()
GROQ_STT_MODEL = os.getenv("GROQ_STT_MODEL", "whisper-large-v3").strip()
GROQ_LLM_MODEL = os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile").strip()
AI_PROVIDER = os.getenv("AI_PROVIDER", "groq").strip().lower()

# --- ASSUMPTION - not literature-derived --- retry / silence settings.
RATE_LIMIT_RETRIES = 2            # extra tries after a 429 before falling back
RATE_LIMIT_MAX_WAIT_SECONDS = 20  # never wait longer than this per retry
# Whisper can "hear" words in silence (e.g. "Thank you."). A segment is
# treated as silence and dropped when BOTH of these hold (the usual Whisper
# silence rule: high no-speech probability and low confidence).
WHISPER_NO_SPEECH_PROB = 0.6
WHISPER_MIN_AVG_LOGPROB = -1.0
# Whisper normally leaves out filler words ("um", "uh"). OpenAI's
# speech-to-text guide lists "preserving punctuation, capitalization, and
# filler words" as a use of the prompt parameter: Whisper copies the style
# of the prompt, so a prompt written WITH fillers makes it keep them.
# --- ASSUMPTION --- the exact sentence is the researcher's own example of
# that style; how well it works must be checked on pilot recordings.
WHISPER_FILLER_PROMPT = "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking."

# --- ASSUMPTION - not literature-derived --- loudness-based silence check.
# The Whisper rule above is not enough: on a silent clip Whisper often returns
# "Thank you." with a LOW no-speech probability, so it passes the rule. So the
# audio itself is checked first (before any AI is called):
#   * the clip is cut into 50 ms pieces and the loudness (dBFS) of each is read
#   * the room's background noise level = the quietest 10 % of pieces
#   * a piece counts as "voice" when it is SPEECH_ABOVE_NOISE_DB louder than
#     the background AND louder than SPEECH_MIN_DBFS
#   * less than MIN_SPEECH_SECONDS of voice in the whole answer = no answer
SPEECH_MIN_DBFS = float(os.getenv("SPEECH_MIN_DBFS", "-45"))
SPEECH_ABOVE_NOISE_DB = float(os.getenv("SPEECH_ABOVE_NOISE_DB", "12"))
MIN_SPEECH_SECONDS = float(os.getenv("MIN_SPEECH_SECONDS", "0.6"))
# A Whisper segment whose own time window has less voice than this is dropped.
MIN_SEGMENT_SPEECH_SECONDS = 0.25
# Known Whisper "silence phrases" (it learned them from video subtitles).
# A segment that is ONLY one of these is dropped unless there is clearly
# enough voice under it.
WHISPER_HALLUCINATION_PHRASES = {
    "thank you", "thank you very much", "thanks", "thanks for watching",
    "thank you for watching", "thank you so much for watching",
    "please subscribe", "subscribe", "like and subscribe", "bye", "bye bye",
    "goodbye", "you", "okay", "ok", "so", "oh", "hmm", "um", "uh",
    "see you next time", "see you in the next video", "music", "applause",
    "silence", "subtitles by the amaraorg community", "transcribed by",
}
HALLUCINATION_MIN_SPEECH_SECONDS = 1.0

_CHUNK_MS = 50


class NoSpeechDetected(Exception):
    """The answer recording has no real speech in it."""

groq_client = None
if Groq is not None and GROQ_API_KEY and not GROQ_API_KEY.startswith("YOUR_"):
    try:
        # max_retries=0: rate-limit retries are handled below (_with_rate_limit_retry)
        groq_client = Groq(api_key=GROQ_API_KEY, max_retries=0, timeout=60.0)
        print(f"✅ Groq connected (speech-to-text: {GROQ_STT_MODEL}, scoring: {GROQ_LLM_MODEL}).")
    except Exception as e:
        print(f"⚠️ Groq could not be set up: {e}")
elif Groq is None:
    print("⚠️ Groq package not installed (pip install groq) - using Gemini only.")
else:
    print("⚠️ GROQ_API_KEY not set in backend/.env - using Gemini only.")

if gemini_client is None:
    print("⚠️ Gemini backup not available (GEMINI_API_KEY not set).")


def available() -> bool:
    """True if at least one AI provider can be used."""
    return groq_client is not None or gemini_client is not None


def _provider_order():
    order = ["groq", "gemini"] if AI_PROVIDER != "gemini" else ["gemini", "groq"]
    return [p for p in order if (p == "groq" and groq_client) or (p == "gemini" and gemini_client)]


def _is_rate_limit(err) -> bool:
    text = str(err).lower()
    status = getattr(err, "status_code", None) or getattr(getattr(err, "response", None), "status_code", None)
    return status == 429 or "429" in text or "rate limit" in text or "quota" in text or "exhausted" in text


def _retry_wait_seconds(err, attempt) -> float:
    """Use the provider's 'retry-after' hint if there is one."""
    wait = None
    response = getattr(err, "response", None)
    headers = getattr(response, "headers", None) or {}
    try:
        if "retry-after" in headers:
            wait = float(headers["retry-after"])
    except (TypeError, ValueError):
        wait = None
    if wait is None:
        match = re.search(r"try again in ([0-9.]+)s", str(err))
        if match:
            wait = float(match.group(1))
    if wait is None:
        wait = 2 * (attempt + 1)
    return min(RATE_LIMIT_MAX_WAIT_SECONDS, max(0.5, wait))


def _with_rate_limit_retry(label, fn):
    """Run fn(); on a rate-limit error wait and try again a few times."""
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        try:
            return fn()
        except Exception as e:
            if _is_rate_limit(e) and attempt < RATE_LIMIT_RETRIES:
                wait = _retry_wait_seconds(e, attempt)
                print(f"⏳ {label}: rate limit - waiting {wait:.1f}s and trying again...")
                time.sleep(wait)
                continue
            raise


def _compact_wav(audio_segment) -> bytes:
    """16 kHz mono WAV copy for upload (the original is kept for analysis)."""
    buffer = io.BytesIO()
    audio_segment.set_channels(1).set_frame_rate(16000).export(buffer, format="wav")
    return buffer.getvalue()


def _as_dict(obj):
    if isinstance(obj, dict):
        return obj
    for attr in ("model_dump", "to_dict", "dict"):
        if hasattr(obj, attr):
            try:
                return getattr(obj, attr)()
            except Exception:
                pass
    return {"text": getattr(obj, "text", "")}


# ---------------------------------------------------------------------------
# Speech-to-text
# ---------------------------------------------------------------------------
_GEMINI_TRANSCRIBE_PROMPT = """Transcribe this recorded job-interview answer into English text, word for word (verbatim).
Rules:
- Write exactly what the speaker says. Do NOT correct grammar, do NOT summarise, do NOT add or guess words.
- KEEP every filler word and hesitation exactly as spoken (for example: um, uh, ah, like, you know, so, basically, actually, I mean).
- The speaker may have a non-native English accent (for example South Asian English) and may use technical terms.
- If there is no clear speech, return nothing.
Return ONLY the transcript text, with no labels, quotes or comments."""


class _SpeechProfile:
    """Which 50 ms pieces of the answer contain voice (see settings above)."""

    def __init__(self, audio_segment):
        mono = audio_segment.set_channels(1)
        levels = [mono[i:i + _CHUNK_MS].dBFS for i in range(0, len(mono), _CHUNK_MS)]
        finite = sorted(l for l in levels if l != float("-inf"))
        if finite:
            noise_floor = finite[int(len(finite) * 0.10)]
            self.threshold = max(SPEECH_MIN_DBFS, noise_floor + SPEECH_ABOVE_NOISE_DB)
        else:  # digital silence (all zeros)
            noise_floor, self.threshold = float("-inf"), 0.0
        self.noise_floor = noise_floor
        self.voiced = [l >= self.threshold for l in levels]

    def seconds(self, start_s=0.0, end_s=None, pad_s=0.2):
        """Seconds of voice between start_s and end_s (padded a little,
        because Whisper's timestamps are not exact)."""
        first = max(0, int((start_s - pad_s) * 1000 / _CHUNK_MS))
        last = len(self.voiced) if end_s is None else int((end_s + pad_s) * 1000 / _CHUNK_MS) + 1
        return sum(self.voiced[first:last]) * _CHUNK_MS / 1000.0

    @property
    def total_seconds(self):
        return self.seconds()


def _normalise(text) -> str:
    return re.sub(r"[^a-z ]", "", (text or "").lower()).strip()


def _is_hallucination_phrase(text) -> bool:
    norm = _normalise(text)
    if not norm:
        return True
    # "Thank you. Thank you." -> every sentence is a known phrase
    parts = [p for p in (_normalise(s) for s in re.split(r"[.!?,]+", text or "")) if p]
    return norm in WHISPER_HALLUCINATION_PHRASES or (
        bool(parts) and all(p in WHISPER_HALLUCINATION_PHRASES for p in parts))


def _transcribe_groq(wav_bytes, profile=None) -> str:
    def call():
        return groq_client.audio.transcriptions.create(
            file=("answer.wav", wav_bytes),
            model=GROQ_STT_MODEL,
            language="en",                 # fixed: avoids wrong language detection
            prompt=WHISPER_FILLER_PROMPT,  # keep filler words (see above)
            response_format="verbose_json",  # gives per-segment silence info
            temperature=0.0,
        )
    data = _as_dict(_with_rate_limit_retry("Groq speech-to-text", call))
    segments = data.get("segments") or []
    if segments:
        kept = []
        for seg in segments:
            seg = _as_dict(seg)
            seg_text = (seg.get("text") or "").strip()
            no_speech = float(seg.get("no_speech_prob", 0) or 0)
            avg_logprob = float(seg.get("avg_logprob", 0) or 0)
            # 1) the usual Whisper silence rule
            silent = no_speech > WHISPER_NO_SPEECH_PROB and avg_logprob < WHISPER_MIN_AVG_LOGPROB
            # 2) no real voice in the audio under this segment
            voice_s = None
            if profile is not None and seg.get("start") is not None and seg.get("end") is not None:
                voice_s = profile.seconds(float(seg["start"]), float(seg["end"]))
                if voice_s < MIN_SEGMENT_SPEECH_SECONDS:
                    silent = True
            # 3) a known "silence phrase" ("Thank you.") with little voice under it
            if _is_hallucination_phrase(seg_text) and (
                    no_speech > 0.3
                    or (voice_s is not None and voice_s < HALLUCINATION_MIN_SPEECH_SECONDS)):
                silent = True
            if silent:
                print(f"🔇 Dropped Whisper segment as silence: {seg_text!r} "
                      f"(no_speech={no_speech:.2f}, voice={voice_s})")
            else:
                kept.append(seg_text)
        text = " ".join(t for t in kept if t)
    else:
        text = (data.get("text") or "").strip()
    if not text or (_is_hallucination_phrase(text) and profile is not None
                    and profile.total_seconds < HALLUCINATION_MIN_SPEECH_SECONDS * 1.5):
        # Real "no answer" - NOT an error, so do not try another provider.
        raise NoSpeechDetected("Groq heard no real speech")
    return text


def _transcribe_gemini(wav_bytes, profile=None) -> str:
    if not gemini_types:
        raise RuntimeError("Gemini types not available")
    part = gemini_types.Part.from_bytes(data=wav_bytes, mime_type="audio/wav")

    def call():
        return gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[_GEMINI_TRANSCRIBE_PROMPT, part],
            config=gemini_types.GenerateContentConfig(temperature=0.0),
        )
    response = _with_rate_limit_retry("Gemini speech-to-text", call)
    text = (response.text or "").strip().strip('"').strip()
    if not text or (_is_hallucination_phrase(text) and profile is not None
                    and profile.total_seconds < HALLUCINATION_MIN_SPEECH_SECONDS * 1.5):
        raise NoSpeechDetected("Gemini heard no real speech")
    return text


def transcribe(audio_segment, wav_path):
    """
    Speech-to-text for one answer. Returns (text, engine_name).
    Tries Groq -> Gemini -> free Google Web Speech. Raises if all fail.

    Returns ("", "silence-check") when the recording has no real speech
    (student stayed silent) - so no AI is asked to "hear" words in silence.
    """
    try:
        profile = _SpeechProfile(audio_segment)
        print(f"🔊 Voice in answer: {profile.total_seconds:.1f}s "
              f"(noise {profile.noise_floor:.1f} dBFS, voice threshold {profile.threshold:.1f} dBFS)")
        if profile.total_seconds < MIN_SPEECH_SECONDS:
            print("🔇 No speech in the recording - skipping speech-to-text.")
            return "", "silence-check"
    except Exception as e:  # never block transcription because of this check
        print(f"⚠️ Silence check failed ({e}) - continuing without it.")
        profile = None

    wav_bytes = _compact_wav(audio_segment)
    for provider in _provider_order():
        try:
            if provider == "groq":
                return _transcribe_groq(wav_bytes, profile), f"groq:{GROQ_STT_MODEL}"
            return _transcribe_gemini(wav_bytes, profile), f"gemini:{GEMINI_MODEL}"
        except NoSpeechDetected as e:
            print(f"🔇 {e} - treating the answer as empty.")
            return "", f"{provider}:no-speech"
        except Exception as e:
            print(f"⚠️ {provider} speech-to-text failed ({e}) - trying the next option.")

    # Last resort: free Google Web Speech API (less accurate).
    import speech_recognition as sr
    recognizer = sr.Recognizer()
    with sr.AudioFile(wav_path) as source:
        audio_data = recognizer.record(source)
    return recognizer.recognize_google(audio_data), "google-web-speech"


# ---------------------------------------------------------------------------
# JSON generation (scoring / summary)
# ---------------------------------------------------------------------------
def _clean_json(text):
    if not text:
        return None
    try:
        cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
        return json.loads(cleaned.strip())
    except Exception:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)  # JSON inside extra text
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return None
        return None


def _json_groq(prompt, temperature):
    def call():
        return groq_client.chat.completions.create(
            model=GROQ_LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a careful interview assessor. Reply with one valid JSON object only."},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
    response = _with_rate_limit_retry("Groq scoring", call)
    return response.choices[0].message.content


def _json_gemini(prompt, temperature):
    config = None
    if gemini_types:
        config = gemini_types.GenerateContentConfig(response_mime_type="application/json", temperature=temperature)

    def call():
        return gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt, config=config)
    return _with_rate_limit_retry("Gemini scoring", call).text


def generate_json(prompt, temperature=0.4, label="AI"):
    """
    Ask for a JSON object. Returns (parsed_dict, engine_name), or
    (None, None) if every provider failed (caller shows "Not Evaluated").
    """
    for provider in _provider_order():
        try:
            if provider == "groq":
                raw, engine = _json_groq(prompt, temperature), f"groq:{GROQ_LLM_MODEL}"
            else:
                raw, engine = _json_gemini(prompt, temperature), f"gemini:{GEMINI_MODEL}"
            print(f"📥 Raw {label} response ({engine}):", raw)
            parsed = _clean_json(raw)
            if isinstance(parsed, dict):
                return parsed, engine
            print(f"⚠️ {engine} did not return valid JSON - trying the next option.")
        except Exception as e:
            print(f"⚠️ {provider} {label} failed ({e}) - trying the next option.")
    return None, None