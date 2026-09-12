"""
voice_analysis.py

⭐ BSc Research Feature - Step 3
Real voice-confidence analysis, replacing the previous fake heuristic
(`70 if no audio else 85`) and Gemini's guessed `vocalScore`.

Purpose:
    Analyzes a recorded answer's audio + transcript to extract voice-based
    confidence indicators:
        - Filler word count ("um", "uh", "like", etc.) from the transcript
          (already generated elsewhere via Google Speech Recognition -
          this module does not re-transcribe, just analyzes the text).
        - Long pauses (hesitation indicator) from the audio waveform.
        - Pitch variation (very flat pitch can indicate low engagement).

Research basis:
    "AI Powered Mock Interview System with Real-time Voice" (IJNRD, 2025,
    https://www.ijnrd.org/papers/IJNRD2502318.pdf) - uses pause/filler-word
    based fluency scoring for voice confidence; general approach followed
    here.

    "Increase Apparent Public Speaking Fluency By Speech Augmentation"
    (arXiv 1812.03415) - states that pauses longer than 3 seconds are
    treated as "articulation pauses" (hesitation) rather than normal
    speech pauses. This module uses that exact 3-second cutoff (direct
    citation, not an assumption).

    Filler-word frequency guidance ("more than ~6 filler words in a
    single short answer becomes noticeable/distracting") is drawn from
    general communication-research summaries (Speak AI, 2026) rather than
    a single peer-reviewed source - noted here for transparency, same as
    in the project's standalone prototype module.

Score formula transparency:
    The vocal_score formula below (penalty weights for fillers/pauses/
    pitch) is an --- ASSUMPTION - not literature-derived --- researcher
    default, following the same citation-transparency rule applied
    throughout this project (see RESEARCH_DOCUMENTATION.md). The
    THRESHOLDS used to flag "too many" fillers/pauses/too-flat pitch are
    sourced as described above; the specific point-penalty MAGNITUDES
    are a researcher design decision requiring pilot-test calibration.
"""

import re
import librosa
import numpy as np

FILLER_WORDS = ["um", "uh", "ah", "like", "you know", "basically",
                 "actually", "so", "i mean"]

# Sourced from Speak AI (2026) general filler-word guidance - not a single
# peer-reviewed academic figure (see module docstring above).
FILLER_WORD_THRESHOLD = 6

# Directly cited from arXiv 1812.03415 (see module docstring above).
LONG_PAUSE_THRESHOLD_SECONDS = 3.0

# --- ASSUMPTION - not literature-derived ---
PITCH_VARIATION_LOW_THRESHOLD = 15.0


def count_filler_words(transcript: str) -> int:
    """Count occurrences of common filler words in the transcribed text."""
    if not transcript:
        return 0
    transcript_lower = transcript.lower()
    count = 0
    for filler in FILLER_WORDS:
        count += len(re.findall(rf"\b{re.escape(filler)}\b", transcript_lower))
    return count


def detect_long_pauses(wav_path: str, threshold_seconds: float = LONG_PAUSE_THRESHOLD_SECONDS) -> int:
    """
    Detect silent gaps in the audio longer than threshold_seconds.
    Returns the count of such long pauses.
    """
    try:
        y, sr_rate = librosa.load(wav_path, sr=None)
        intervals = librosa.effects.split(y, top_db=30)  # non-silent intervals

        long_pause_count = 0
        for i in range(1, len(intervals)):
            gap_samples = intervals[i][0] - intervals[i - 1][1]
            gap_seconds = gap_samples / sr_rate
            if gap_seconds >= threshold_seconds:
                long_pause_count += 1
        return long_pause_count
    except Exception as e:
        print(f"⚠️ Pause detection failed for {wav_path}: {e}")
        return 0


def compute_pitch_variation(wav_path: str) -> float:
    """
    Compute standard deviation of pitch (F0) across the answer.
    Low variation can indicate a flat, low-engagement delivery.
    Returns 0.0 if pitch could not be computed (e.g. silent/corrupt audio).
    """
    try:
        y, sr_rate = librosa.load(wav_path, sr=None)
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"), sr=sr_rate
        )
        voiced_f0 = f0[voiced_flag]
        if len(voiced_f0) == 0:
            return 0.0
        return round(float(np.std(voiced_f0)), 2)
    except Exception as e:
        print(f"⚠️ Pitch analysis failed for {wav_path}: {e}")
        return 0.0


def analyze_voice(transcript: str, wav_path: str) -> dict:
    """
    Main entry point - analyzes one answer's transcript + audio file.

    Returns:
        {
            "filler_word_count": int,
            "long_pause_count": int,
            "pitch_variation": float
        }
    """
    return {
        "filler_word_count": count_filler_words(transcript),
        "long_pause_count": detect_long_pauses(wav_path),
        "pitch_variation": compute_pitch_variation(wav_path),
    }


def compute_session_vocal_score(avg_filler_count: float, avg_pause_count: float,
                                  avg_pitch_variation: float) -> float:
    """
    Combines session-level averages of the 3 metrics into a single 0-100
    vocal confidence score.

    --- ASSUMPTION - not literature-derived --- penalty magnitudes below
    are a researcher default (see module docstring) - to be calibrated
    with real pilot-session data per the project's citation-transparency
    policy.
    """
    score = 100.0

    if avg_filler_count > FILLER_WORD_THRESHOLD:
        score -= min(40.0, (avg_filler_count - FILLER_WORD_THRESHOLD) * 5.0)

    if avg_pause_count > 0:
        score -= min(30.0, avg_pause_count * 10.0)

    if avg_pitch_variation < PITCH_VARIATION_LOW_THRESHOLD:
        score -= 15.0

    return round(max(0.0, min(100.0, score)), 1)