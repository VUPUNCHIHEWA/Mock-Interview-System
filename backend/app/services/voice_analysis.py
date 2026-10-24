"""
voice_analysis.py

BSc Research Feature - voice (vocal) confidence measurement.

Three factors are measured from each recorded answer and turned into a
0-100 score: Speech Rate, Long Pauses, Pitch Variation.
(Filler Words was the first factor until 2026-10-16. It was REPLACED by
Speech Rate because the speech-to-text leaves fillers out and a verbatim
model was too slow on a laptop - see LIMITATIONS L9/L43. Filler counts with
the old word list are still stored: a stored count marks an answer whose
voice was analysed. They are NOT part of any score.) Every rule below is either simple arithmetic or a number
taken from a cited source (see VOCAL_SCORING.md for the full, plain-English
explanation and worked examples, and SOURCES.md for the references).

1. SPEECH RATE  (S42 Guyer et al., 2025; S43 Kirkland et al., 2022 -
   see SPEECH_RATE_SCORING.md)
   Measured:  words per minute (WPM) of SPEAKING time
              = words in the transcript / (answer time - long-pause time).
              Long pauses (>= 3 s) are left out because the Long Pauses
              factor already measures them (no double counting).
   Score:     0-100, straight lines between six points (B29):
                 74 WPM -> 0    slow end: Guyer's 113->148 line extended
                                down to rating 1 (lowest on the 1-7 scale)
                113 WPM -> 40   (rating 2.95 of 7)   Guyer et al. (2025,
                148 WPM -> 76   (rating 4.70)        Experiment 1) ratings,
                192 WPM -> 100  (rating 5.89, best)  rescaled:
                197 WPM -> 90   (rating 5.39)        100 x (rating-1)/(5.89-1)
                300 WPM -> 0    fast end: listeners' comprehension drops
                                sharply above about 275-300 WPM (S49, S50)
              Below 74 -> 0, above 300 -> 0. Outside the tested speeds the
              fast side loses 0.87 points per WPM, the slow side 1.03, so
              fast speech is penalised less than slow speech.
   Label:     Slow (< 148), Good (148-197), Fast (> 197).
   N/A:       less than 10 s of speaking time in the session.

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
   Score:     0-100, a straight line between two points (B4), both PVQ
              values from Hincks (2005):
                PVQ <= 0.06 -> 0    lowest PVQ in any 10-s sample (most monotone)
                PVQ >= 0.15 -> 100  below 0.15 was rated monotone; she
                                    suggests rewarding variation above 15%
                in between  -> 100 x (PVQ - 0.06) / 0.09  (e.g. 0.105 -> 50)
              No penalty for high variation: in her data more variation was
              rated MORE lively and no upper limit was given.
   Pitch search range 60-500 Hz = Hincks' male (60-400 Hz) and female
   (120-500 Hz) ranges combined.

VOCAL SCORE = average of the three factor scores (equal weights - no source
says one factor matters more; equal "unit" weights are the standard choice
then: Dawes, 1979, S36). A factor that could not be measured is left out of
the average (never counted as 0 or 100).

"Answer time" = from the first sound to the last sound of the recording
(silence before the student starts speaking and after they stop is not part
of the answer).

Session level: all answers are pooled (total words / total speaking minutes,
total long-pause seconds / total answer seconds, PVQ weighted by answer
length), so every minute of speaking counts equally.

The older raw numbers (filler count, long-pause count, pitch standard
deviation in Hz) are still stored with each answer for reference. They are
NOT used in any score. (The decision-tree model that used them was removed.)
"""

import math
import re

import librosa
import numpy as np

# OLD filler list - the count is still stored (it marks an answer whose voice
# was analysed), but it is NOT part of the vocal score.
FILLER_WORDS = ["um", "uh", "ah", "like", "you know", "basically",
                "actually", "so", "i mean"]

# --- Speech rate (B29; S42 Guyer et al., 2025, Experiment 1 means; S49, S50) ---
# 74 = slow end (Guyer line 113->148 extended to rating 1 -> score 0)
# 113 / 148 / 192 / 197 = speeds tested by Guyer et al. (ratings rescaled)
# 300 = fast end (comprehension drops sharply above ~275-300 WPM -> score 0)
SPEECH_RATE_POINTS = [74.0, 113.0, 148.0, 192.0, 197.0, 300.0]  # words per minute
SPEECH_RATE_SCORES = [0.0, 40.0, 76.0, 100.0, 90.0, 0.0]       # score at each point
SPEECH_RATE_GOOD_MIN = 148.0      # below -> "Slow"
SPEECH_RATE_GOOD_MAX = 197.0      # above -> "Fast"
MIN_RATE_SPEAKING_SECONDS = 10.0  # less speaking time -> N/A (B30)
WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*")
SPEECH_RATE_LABEL_TEXT = {
    "Slow": "speakers this slow were rated less confident in research; try a slightly faster pace",
    "Good": "this pace was rated confident in research",
    "Fast": "very fast speech was rated a little less confident in research; slow down slightly",
}

# --- Long pauses (S1 citing S2) ---
LONG_PAUSE_THRESHOLD_SECONDS = 3.0
SILENCE_TOP_DB = 30            # librosa silence detection (ASSUMPTION B7, unchanged)

# --- Pitch variation (S35, Hincks 2005) ---
PVQ_ZERO = 0.06                # at or below -> 0   (lowest 10-s PVQ in Hincks' data)
PVQ_FULL_MARKS = 0.15          # at or above -> 100 (below = rated monotone;
                               #  "reward ... more than 15% of the mean")
PVQ_POINTS = [PVQ_ZERO, PVQ_FULL_MARKS]
PVQ_SCORES = [0.0, 100.0]
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
def count_words(transcript: str) -> int:
    """Number of words in the transcript (contractions and hyphenated words
    such as "I'm" or "real-time" count as one word)."""
    if not transcript:
        return 0
    return len(WORD_PATTERN.findall(transcript))


def count_filler_words(transcript: str) -> int:
    """OLD filler count (FILLER_WORDS list) - stored for reference, not scored."""
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
                                                     (old units, stored for reference only)
        word_count, speech_seconds, long_pause_seconds, pitch_pvq      - used for scoring
    Values that could not be measured are None (never a made-up number).
    """
    result = {
        "filler_word_count": count_filler_words(transcript),
        "word_count": count_words(transcript),
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
def speech_rate_score(wpm):
    """0-100 score: straight lines between 74 -> 0, 113 -> 40, 148 -> 76,
    192 -> 100, 197 -> 90, 300 -> 0 (B29, SPEECH_RATE_SCORING.md).
    np.interp gives 0 below 74 WPM and above 300 WPM."""
    if wpm is None:
        return None
    return round1(float(np.interp(wpm, SPEECH_RATE_POINTS, SPEECH_RATE_SCORES)))


def speech_rate_label(wpm):
    """Slow (< 148 WPM), Good (148-197), Fast (> 197)."""
    if wpm is None:
        return None
    if wpm < SPEECH_RATE_GOOD_MIN:
        return "Slow"
    if wpm <= SPEECH_RATE_GOOD_MAX:
        return "Good"
    return "Fast"


def speaking_seconds(response):
    """Answer time minus long-pause time of one stored answer (None if unknown)."""
    total = getattr(response, "speech_seconds", None)
    if not total:
        return None
    return max(0.0, total - (getattr(response, "long_pause_seconds", None) or 0.0))


def answer_words(response):
    """Word count of one stored answer, from its transcript."""
    return count_words(getattr(response, "user_answer", None) or "")


def answer_speech_rate(response):
    """Words per minute of one stored answer (shown per question, not scored:
    one short answer is too little speech for a reliable score)."""
    seconds = speaking_seconds(response)
    if not seconds:
        return None
    return round(answer_words(response) / (seconds / 60.0))


def long_pause_score(long_pause_share):
    if long_pause_share is None:
        return None
    return round1(max(0.0, min(100.0, 100.0 * (1.0 - long_pause_share))))


def pitch_label(pvq):
    """Low (< 0.15, rated monotone in Hincks 2005), Good (0.15 or more)."""
    if pvq is None:
        return None
    if pvq < PVQ_FULL_MARKS:
        return "Low"
    return "Good"


def pitch_score(pvq):
    """0-100 score: straight line 0.06 -> 0, 0.15 -> 100 (B4,
    PITCH_VARIATION_SCORING.md). np.interp gives 0 at or below 0.06 and 100
    at or above 0.15."""
    if pvq is None:
        return None
    return round1(float(np.interp(pvq, PVQ_POINTS, PVQ_SCORES)))


def compute_session_vocal(responses) -> dict:
    """
    Session vocal score + per-factor breakdown from InterviewResponse rows
    (or any objects with filler_word_count, user_answer, speech_seconds,
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
    total_words = sum(answer_words(r) for r in measured)
    speak_seconds = sum(speaking_seconds(r) or 0.0 for r in measured)
    wpm = total_words / (speak_seconds / 60.0) if speak_seconds > 0 else None
    enough_speech = speak_seconds >= MIN_RATE_SPEAKING_SECONDS
    rate_label = speech_rate_label(wpm) if enough_speech else None

    paused = sum((r.long_pause_seconds or 0.0) for r in measured)
    pause_share = paused / total_seconds if total_seconds > 0 else None

    pitched = [r for r in measured if r.pitch_pvq is not None]
    pitch_seconds = sum(r.speech_seconds for r in pitched)
    pvq = (sum(r.pitch_pvq * r.speech_seconds for r in pitched) / pitch_seconds
           if pitch_seconds > 0 else None)

    breakdown = {
        "speechRate": {
            # Score only with at least 10 s of speaking time (B30).
            "score": speech_rate_score(wpm) if enough_speech else None,
            "value": round(wpm) if wpm is not None else None,
            "unit": "words per minute",
            "label": rate_label,
            "labelText": SPEECH_RATE_LABEL_TEXT.get(rate_label),
            "ratePoints": SPEECH_RATE_POINTS,
            "scorePoints": SPEECH_RATE_SCORES,
            "words": total_words,
            "speakingSeconds": round(speak_seconds, 1),
            "minSpeakingSeconds": MIN_RATE_SPEAKING_SECONDS,
            "enoughSpeech": enough_speech,
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
            "label": pitch_label(pvq),
        },
        "answerSeconds": round(total_seconds, 1),
    }
    scores = [breakdown[k]["score"] for k in ("speechRate", "longPauses", "pitchVariation")
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