"""
audio_level_check.py

Checks ONE (or more) answer recordings and says why the app did or did not
hear speech in it: silent microphone, too quiet, or fine. Uses the SAME
loudness rule as the app (ai_provider._SpeechProfile, ASSUMPTIONS B17).
No AI service is called.

Usage (from the backend/ folder):

    python -m validation.audio_level_check uploads/user_3/session_xxx/audio_123.webm
    python -m validation.audio_level_check uploads/user_3/session_xxx        (all clips in a folder)

To keep the recordings so they can be checked, set KEEP_AUDIO_RECORDINGS=true
in backend/.env and restart the backend.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from pydub import AudioSegment  # noqa: E402

from app.services import ai_provider  # noqa: E402

AUDIO_EXTS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4", ".flac", ".aac"}


def check(path):
    audio = AudioSegment.from_file(path)
    profile = ai_provider._SpeechProfile(audio)
    print(f"\n{path}")
    print(f"  length              : {profile.length_seconds:.1f} s")
    print(f"  loudest 50 ms piece : {profile.loudest:.1f} dBFS")
    print(f"  background noise    : {profile.noise_floor:.1f} dBFS (quietest 10%)")
    print(f"  voice threshold     : {profile.threshold:.1f} dBFS "
          f"(SPEECH_MIN_DBFS={ai_provider.SPEECH_MIN_DBFS:g}, "
          f"+{ai_provider.SPEECH_ABOVE_NOISE_DB:g} dB above noise)")
    print(f"  voice found         : {profile.total_seconds:.1f} s "
          f"(needs {ai_provider.MIN_SPEECH_SECONDS:g} s)")

    if profile.total_seconds >= ai_provider.MIN_SPEECH_SECONDS:
        print("  RESULT: OK - the app hears speech in this recording.")
    elif profile.loudest < -80:
        print("  RESULT: SILENT - the microphone sent (almost) no sound at all.")
        print("          Play the file: if you hear nothing, check (1) the app's mute button,")
        print("          (2) the browser's microphone choice (padlock icon -> site settings),")
        print("          (3) Windows Settings -> Sound -> Input: the right mic and its level,")
        print("          (4) close other apps that use the mic (Zoom, Teams, Discord).")
    elif profile.loudest < profile.threshold:
        print(f"  RESULT: TOO QUIET - sound is there, but the loudest part ({profile.loudest:.1f} dBFS)")
        print(f"          is below the voice threshold ({profile.threshold:.1f} dBFS).")
        print("          Raise the microphone input level, or lower SPEECH_MIN_DBFS in backend/.env")
        print("          (for example SPEECH_MIN_DBFS=-55) and restart the backend.")
    else:
        print("  RESULT: SHORT - some voice, but less than the minimum. Speak for longer.")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    target = Path(sys.argv[1])
    files = ([target] if target.is_file()
             else sorted(p for p in target.rglob("*") if p.suffix.lower() in AUDIO_EXTS))
    if not files:
        sys.exit(f"No recordings found at {target}")
    for f in files:
        try:
            check(f)
        except Exception as e:
            print(f"\n{f}\n  could not read the file: {e}")


if __name__ == "__main__":
    main()
