"""
voice_analysis.py

BSc Research Feature - voice (vocal) confidence measurement.

Three factors are measured from each recorded answer and turned into a
0-100 score. Every rule below is either simple arithmetic or a number
taken from a cited source (see VOCAL_SCORING.md for the full, plain-English
explanation and worked examples, and SOURCES.md for the references).

1. FILLER WORDS  (S4, S20/S21)
   Measured:  filler words per MINUTE of answer time
              (rate = number of fillers / answer minutes).
   Score:     <= 5 per minute  -> 100
              >= 7 per minute  -> 0
              5 to 7 per minute -> straight line between (e.g. 6 -> 50)
   Source:    Speak AI (S4): "more than 5-7 filler words per minute becomes
              noticeable and potentially distracting". This is the only
              numeric guideline found and it is NOT peer-reviewed (see
              LIMITATIONS.md L10). Per minute (not per answer) so that a long
              answer is not punished just for being long.

2. LONG PAUSES  (S1, S2)
   Measured:  share of the answer time spent in long pauses
              (silences of 3 seconds or more between words).
   Score:     100 x (1 - long-pause time / answer time)
              e.g. 6 s of long pauses in a 60 s answer -> 90.
   Source:    pauses > 3 s are "articulation pauses" (hesitation) -
              Das et al. (2018), citing Riggenbach (1991). The score itself
              is just the percentage of answer time that was NOT a long pause.

3. PITCH VARIATION  (S35 - Hincks, 2005)
   Measured:  Pitch Variation Quotient (PVQ) = standard deviation of the
              voice pitch (F0) / mean pitch, in 10-second pieces of the
              answer, averaged. Dividing by the speaker's own mean pitch
              makes it fair for low and high voices.
   Score:     PVQ >= 0.15 -> 100   (Hincks: below 0.15 was rated monotone;
                                     she suggests rewarding variation above
                                     15% of the mean pitch)
              PVQ <= 0.06 -> 0     (the lowest PVQ observed in her data)
              in between  -> straight line (e.g. 0.105 -> 50)
   Pitch search range 60-500 Hz = Hincks' male (60-400 Hz) and female
   (120-500 Hz) ranges combined.

VOCAL SCORE = average of the three factor scores (equal weights - no source
says one factor matters more; equal "unit" weights are the standard choice
then: Dawes, 1979, S36). A factor that could not be measured is left out of
the average (never counted as 0 or 100).

"Answer time" = from the first sound to the last sound of the recording
(silence before the student starts speaking and after they stop is not part
of the answer).

Session level: all answers are pooled (total fillers / total minutes, total
long-pause seconds / total answer seconds, PVQ weighted by answer length),
so every minute of speaking counts equally.

The raw numbers used by the older parts of the app (filler count, long-pause
count, pitch standard deviation in Hz) are still stored for the decision-tree
model (ml_model.py), which was trained on them.
"""

import math
import re

import librosa
import numpy as np

FILLER_WORDS = ["um", "uh", "ah", "like", "you know", "basically",
                "actually", "so", "i mean"]

# --- Filler words (S4) ---
FILLER_RATE_FULL_MARKS = 5.0   # per minute: at or below -> 100
FILLER_RATE_ZERO = 7.0         # per minute: at or above -> 0

# --- Long pauses (S1 citing S2) ---
LONG_PAUSE_THRESHOLD_SECONDS = 3.0
SILENCE_TOP_DB = 30            # librosa silence detection (ASSUMPTION B7, unchanged)

# --- Pitch variation (S35, Hincks 2005) ---
PVQ_FULL_MARKS = 0.15          # at or above -> 100
PVQ_ZERO = 0.06                # at or below -> 0
PITCH_FMIN_HZ = 60.0
PITCH_FMAX_HZ = 500.0
PVQ_SEGMENT_SECONDS = 10.0


def round1(x):
    """Round to 1 decimal place, halves rounded up (86.05 -> 86.1)."""
    return math.floor(x * 10 + 0.5) / 10


def _linear_score(value, zero_at, full_at):
    """Straight line: value at zero_at -> 0, at full_at -> 100, clamped."""
    if value is None:
        return None
    score = 100.0 * (value - zero_at) / (full_at - zero_at)
    return round1(max(0.0, min(100.0, score)))


# ---------------------------------------------------------------------------
# Per-answer measurement
# ---------------------------------------------------------------------------
def count_filler_words(transcript: str) -> int:
    """Count occurrences of common filler words in the transcribed text."""
    if not transcript:
        return 0
    transcript_lower = transcript.lower()
    count = 0
    for filler in FILLER_WORDS:
        count += len(re.findall(rf"\b{re.escape(filler)}\b", transcript_lower))
    return count


def _pause_metrics(y, sr_rate):
    """
    Returns (answer_seconds, long_pause_count, long_pause_seconds).
    answer_seconds = first sound to last sound.
    """
    intervals = librosa.effects.split(y, top_db=SILENCE_TOP_DB)  # sound parts
    if len(intervals) == 0:
        return 0.0, 0, 0.0
    answer_seconds = (intervals[-1][1] - intervals[0][0]) / sr_rate
    count, total = 0, 0.0
    for i in range(1, len(intervals)):
        gap = (intervals[i][0] - intervals[i - 1][1]) / sr_rate
        if gap >= LONG_PAUSE_THRESHOLD_SECONDS:
            count += 1
            total += gap
    return float(answer_seconds), count, float(total)


def _segments(n_frames, frames_per_segment):
    """
    Split frame indices into 10-second pieces. A final piece shorter than
    10 s is joined to the piece before it (so no piece is a tiny fragment);
    an answer shorter than 10 s is one piece.
    """
    if n_frames <= 0:
        return []
    bounds = list(range(0, n_frames, frames_per_segment)) + [n_frames]
    pieces = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
    if len(pieces) > 1 and (pieces[-1][1] - pieces[-1][0]) < frames_per_segment:
        last = pieces.pop()
        pieces[-1] = (pieces[-1][0], last[1])
    return pieces


PYIN_HOP = 512  # librosa.pyin default hop_length (samples)


def _pitch_metrics(y, sr_rate, intervals):
    """
    Returns (pitch_sd_hz, pvq) over the answer time.
    pvq = mean over 10-s pieces of (SD of F0 / mean F0) of voiced frames.
    A piece needs at least 2 voiced frames to have a standard deviation.

    A pitch frame is used only if
      (a) it lies inside a sound part of the recording (there is no voice
          pitch in silence; same silence detection as the pause measurement),
          and
      (b) pYIN says it is voiced AND its voicing probability is >= 0.5
          (more likely voiced than not).
    This automatically removes pitch-tracking errors in silent gaps (in the
    source study these errors were removed by hand).
    """
    start_sample, end_sample = intervals[0][0], intervals[-1][1]
    clip = y[start_sample:end_sample]
    if len(clip) == 0:
        return 0.0, None
    f0, voiced_flag, voiced_prob = librosa.pyin(clip, fmin=PITCH_FMIN_HZ, fmax=PITCH_FMAX_HZ, sr=sr_rate)
    frame_samples = start_sample + np.arange(len(f0)) * PYIN_HOP  # frame centres
    in_sound = np.zeros(len(f0), dtype=bool)
    for a, b in intervals:
        in_sound |= (frame_samples >= a) & (frame_samples < b)
    voiced_flag = voiced_flag & in_sound & (voiced_prob >= 0.5) & ~np.isnan(f0)
    voiced_all = f0[voiced_flag]
    pitch_sd = round(float(np.std(voiced_all)), 2) if len(voiced_all) else 0.0

    hop_seconds = PYIN_HOP / sr_rate
    frames_per_segment = max(1, int(round(PVQ_SEGMENT_SECONDS / hop_seconds)))
    pvqs = []
    for a, b in _segments(len(f0), frames_per_segment):
        seg = f0[a:b][voiced_flag[a:b]]
        if len(seg) >= 2 and np.mean(seg) > 0:
            pvqs.append(float(np.std(seg) / np.mean(seg)))
    pvq = round(float(np.mean(pvqs)), 4) if pvqs else None
    return pitch_sd, pvq


def analyze_voice(transcript: str, wav_path: str) -> dict:
    """
    Measures one answer. Returns:
        filler_word_count, long_pause_count, pitch_variation (Hz SD)  - raw numbers
        speech_seconds, long_pause_seconds, pitch_pvq                  - used for scoring
    Values that could not be measured are None (never a made-up number).
    """
    result = {
        "filler_word_count": count_filler_words(transcript),
        "long_pause_count": 0,
        "pitch_variation": 0.0,
        "speech_seconds": None,
        "long_pause_seconds": None,
        "pitch_pvq": None,
    }
    try:
        y, sr_rate = librosa.load(wav_path, sr=None)
        answer_seconds, count, total = _pause_metrics(y, sr_rate)
        result["long_pause_count"] = count
        if answer_seconds > 0:
            result["speech_seconds"] = round(answer_seconds, 2)
            result["long_pause_seconds"] = round(total, 2)
            intervals = librosa.effects.split(y, top_db=SILENCE_TOP_DB)
            try:
                sd, pvq = _pitch_metrics(y, sr_rate, intervals)
                result["pitch_variation"] = sd
                result["pitch_pvq"] = pvq
            except Exception as e:
                print(f"⚠️ Pitch analysis failed for {wav_path}: {e}")
    except Exception as e:
        print(f"⚠️ Voice analysis failed for {wav_path}: {e}")
    return result


# ---------------------------------------------------------------------------
# Scores
# ---------------------------------------------------------------------------
def filler_score(fillers_per_minute):
    return _linear_score(fillers_per_minute, FILLER_RATE_ZERO, FILLER_RATE_FULL_MARKS)


def long_pause_score(long_pause_share):
    if long_pause_share is None:
        return None
    return round1(max(0.0, min(100.0, 100.0 * (1.0 - long_pause_share))))


def pitch_score(pvq):
    return _linear_score(pvq, PVQ_ZERO, PVQ_FULL_MARKS)


def compute_session_vocal(responses) -> dict:
    """
    Session vocal score + per-factor breakdown from InterviewResponse rows
    (or any objects with filler_word_count, speech_seconds,
    long_pause_seconds and pitch_pvq).

    Returns {"vocalScore": float|None, "vocalBreakdown": dict|None,
             "answersMeasured": int}.
    Answers recorded before this scoring existed (no speech_seconds) are
    skipped, so older sessions get None ("N/A").
    """
    measured = [r for r in responses
                if getattr(r, "speech_seconds", None) and r.filler_word_count is not None]
    if not measured:
        return {"vocalScore": None, "vocalBreakdown": None, "answersMeasured": 0}

    total_seconds = sum(r.speech_seconds for r in measured)
    total_minutes = total_seconds / 60.0
    total_fillers = sum(r.filler_word_count for r in measured)
    filler_rate = total_fillers / total_minutes if total_minutes > 0 else None

    paused = sum((r.long_pause_seconds or 0.0) for r in measured)
    pause_share = paused / total_seconds if total_seconds > 0 else None

    pitched = [r for r in measured if r.pitch_pvq is not None]
    pitch_seconds = sum(r.speech_seconds for r in pitched)
    pvq = (sum(r.pitch_pvq * r.speech_seconds for r in pitched) / pitch_seconds
           if pitch_seconds > 0 else None)

    breakdown = {
        "fillerWords": {
            "score": filler_score(filler_rate),
            "value": round(filler_rate, 1) if filler_rate is not None else None,
            "unit": "per minute",
            "fullMarksAtOrBelow": FILLER_RATE_FULL_MARKS,
            "zeroAtOrAbove": FILLER_RATE_ZERO,
            "count": total_fillers,
        },
        "longPauses": {
            "score": long_pause_score(pause_share),
            "value": round(100.0 * pause_share, 1) if pause_share is not None else None,
            "unit": "% of answer time",
            "pauseSeconds": round(paused, 1),
            "minPauseSeconds": LONG_PAUSE_THRESHOLD_SECONDS,
            "count": sum(r.long_pause_count or 0 for r in measured),
        },
        "pitchVariation": {
            "score": pitch_score(pvq),
            "value": round(pvq, 3) if pvq is not None else None,
            "unit": "PVQ",
            "fullMarksAtOrAbove": PVQ_FULL_MARKS,
            "zeroAtOrBelow": PVQ_ZERO,
        },
        "answerSeconds": round(total_seconds, 1),
    }
    scores = [breakdown[k]["score"] for k in ("fillerWords", "longPauses", "pitchVariation")
              if breakdown[k]["score"] is not None]
    vocal = round1(sum(scores) / len(scores)) if scores else None
    return {"vocalScore": vocal, "vocalBreakdown": breakdown, "answersMeasured": len(measured)}


def combine_confidence(visual_score, vocal_score):
    """
    Confidence score = average of the visual and vocal scores (equal
    weights; the original formula also gave them equal weight, 20% + 20%).

    BOTH parts are required. If either is missing (e.g. no voice answers,
    or no camera data), the Confidence Score is None ("N/A"). A score made
    from one part alone would not measure the same thing as a full
    Confidence Score, so the two could not be fairly compared.
    """
    if visual_score is None or vocal_score is None:
        return None
    return round1((visual_score + vocal_score) / 2)


def confidence_missing_reason(visual_score, vocal_score):
    """Short reason shown to the student when the Confidence Score is N/A."""
    if visual_score is None and vocal_score is None:
        return "No camera or voice data was recorded, so a Confidence Score cannot be given."
    if vocal_score is None:
        return "No voice answers were recorded or measured, so a Confidence Score cannot be given (it needs both camera and voice)."
    if visual_score is None:
        return "No camera data was recorded, so a Confidence Score cannot be given (it needs both camera and voice)."
    return None
