"""
confidence_feedback.py

BSc Research Feature - "Confidence Strengths" and "Key Areas for Improvement"
on the results page.

The research scope is evaluating and improving the candidate's CONFIDENCE,
so this feedback is built ONLY from the measured confidence factors:

    Visual:  Eye Contact, Head Pose (and face-not-visible time)
    Vocal:   Speech Rate, Long Pauses, Pitch Variation

It does NOT judge the content of the answers (that is the separate Answer
Score, shown on its own and not part of the Confidence Score).

Why rule-based and not written by an AI model:
  * Explainable - every point names the factor, the measured value and the
    target, so the student can see exactly why it was given.
  * Reproducible - the same measurements always give the same feedback
    (an AI summary can change from run to run and can invent things).
  * No extra AI request - the feedback is ready even when the AI service
    is busy, just like the Confidence Score itself.

Each point follows the three feedback questions of Hattie & Timperley
(2007, S33): where am I going (the target), how am I going (the measured
value), where to next (a practical tip).

Rules (ASSUMPTIONS.md C6-C8):
  * Strength:     factor score >= 80 %  (the green band on the results page).
  * Improvement:  factor score <  80 %.
  * Speech Rate uses its own research label instead of the score band:
    "Good" (148-197 WPM) = strength; "Slow" or "Fast" = improvement;
    less than 10 s of speaking = improvement ("speak more").
  * Face not visible for 1 % or more of the measured time = improvement.
  * Improvements are listed weakest first; the first one is the top priority.
"""

from app.services.voice_analysis import (
    SPEECH_RATE_GOOD_MIN,
    SPEECH_RATE_GOOD_MAX,
    PVQ_FULL_MARKS,
    LONG_PAUSE_THRESHOLD_SECONDS,
)

STRONG_AT_OR_ABOVE = 80.0          # C6: same green band as the results page
FACE_NOT_VISIBLE_MIN_PCT = 1.0     # C7: below this it is treated as noise

# Visual targets, copied from visual_analysis.py (kept here as plain numbers
# so this file does not load MediaPipe): A10 gaze tolerance, A1/A2 head angles.
GAZE_TOLERANCE_DEG = 10
HEAD_YAW_TOLERANCE_DEG = 10
HEAD_PITCH_TOLERANCE_DEG = 15


def _has(v):
    return v is not None


def _half_up(v):
    """Round .5 up, like Math.round on the results page (Python's round()
    rounds 12.5 to 12, which would disagree with the factor bar)."""
    return int(v + 0.5) if v >= 0 else -int(-v + 0.5)


def _pct(v):
    return f"{_half_up(v)}%"


def _item(factor, group, score, measured, message, tip=None, sort_score=None):
    return {
        # Used only to order the list (removed before returning).
        "_sort": sort_score if sort_score is not None else (score if _has(score) else 0.0),
        "factor": factor,
        "group": group,          # "Visual" or "Vocal"
        "score": round(score, 1) if _has(score) else None,
        "measured": measured,    # the raw measurement, in plain words
        "message": message,      # what it means
        "tip": tip,              # what to do next (improvements only)
    }


# ---------------------------------------------------------------------------
# One function per factor: returns ("strength" | "improvement", item) or None
# ---------------------------------------------------------------------------
def _eye_contact(score):
    if not _has(score):
        return None
    measured = f"Eye contact score {_pct(score)} (full marks when your eyes are within {GAZE_TOLERANCE_DEG}° of the camera)"
    if score >= STRONG_AT_OR_ABOVE:
        return "strength", _item(
            "Eye Contact", "Visual", score, measured,
            "You kept your eyes on the camera for most of the interview. "
            "To an interviewer this comes across as calm and confident.")
    return "improvement", _item(
        "Eye Contact", "Visual", score, measured,
        "Your eyes often moved away from the camera. Looking away a lot can make you look unsure, "
        "even when your answer is good.",
        "Look at the camera lens, not at your own video. Move the interview window close to the "
        "camera, and if you need a moment to think, look back at the camera when you start speaking.")


def _head_pose(score):
    if not _has(score):
        return None
    measured = (f"Head pose score {_pct(score)} (full marks when your head turns less than "
                f"{HEAD_YAW_TOLERANCE_DEG}° left/right and {HEAD_PITCH_TOLERANCE_DEG}° up/down)")
    if score >= STRONG_AT_OR_ABOVE:
        return "strength", _item(
            "Head Pose", "Visual", score, measured,
            "You kept your head facing forward and steady, which shows you were engaged and composed.")
    return "improvement", _item(
        "Head Pose", "Visual", score, measured,
        "Your head was often turned away or tilted up/down. This can look like you are avoiding "
        "the interviewer or reading something.",
        "Sit straight in front of the screen with the camera at eye level. Keep notes out of sight so "
        "you are not tempted to look down at them.")


def _face_not_visible(pct):
    if not _has(pct) or pct < FACE_NOT_VISIBLE_MIN_PCT:
        return None
    # No score is shown; it is ordered by the share of time the face WAS
    # visible (lower = needs more attention).
    return "improvement", _item(
        "Face Visibility", "Visual", None,
        f"Face not visible for {_pct(pct)} of the measured time (counted as 0 for eye contact and head pose)",
        "For part of the interview the camera could not see your face, so that time lowered your "
        "visual score.",
        "Sit in the centre of the camera view with light in front of you (not behind you), and keep "
        "your face in view while you think.", sort_score=100.0 - pct)


def _speech_rate(sr):
    if not sr:
        return None
    score = sr.get("score")
    wpm = sr.get("value")
    if sr.get("enoughSpeech") is False:
        return "improvement", _item(
            "Speech Rate", "Vocal", None,
            f"Only {sr.get('speakingSeconds')} s of speaking was measured (at least "
            f"{sr.get('minSpeakingSeconds')} s is needed to rate your pace)",
            "You spoke very little, so your speaking pace could not be measured. Very short answers "
            "can come across as hesitant.",
            "Aim to speak for at least 30-60 seconds per answer. A simple structure helps: "
            "your point, a short example, and what you learned.", sort_score=0.0)
    label = sr.get("label")
    if not _has(wpm) or not label:
        return None
    measured = (f"{wpm} words per minute (rated confident in research between "
                f"{int(SPEECH_RATE_GOOD_MIN)} and {int(SPEECH_RATE_GOOD_MAX)})")
    if label == "Good":
        return "strength", _item(
            "Speech Rate", "Vocal", score, measured,
            "You spoke at a steady, confident pace - not too slow and not rushed.")
    if label == "Slow":
        return "improvement", _item(
            "Speech Rate", "Vocal", score, measured,
            "You spoke more slowly than the pace listeners rate as confident. A slow pace can sound "
            "unsure or as if you are searching for words.",
            "Practise your self-introduction and common answers aloud until they flow, and try to speak "
            "a little faster while staying clear.")
    return "improvement", _item(
        "Speech Rate", "Vocal", score, measured,
        "You spoke faster than the best-rated pace. Rushing can sound nervous and makes your answer "
        "harder to follow.",
        "Slow down slightly: take a short breath at the end of each sentence and stress your key points.")


def _filler_words_old(fw):
    """Sessions saved before 2026-10-16 had Filler Words instead of Speech Rate."""
    if not fw or not _has(fw.get("score")):
        return None
    score = fw["score"]
    measured = f"Filler words score {_pct(score)} (older scoring)"
    if score >= STRONG_AT_OR_ABOVE:
        return "strength", _item("Filler Words", "Vocal", score, measured,
                                 "You used few filler words such as \"um\" and \"uh\".")
    return "improvement", _item(
        "Filler Words", "Vocal", score, measured,
        "You used many filler words such as \"um\" and \"uh\", which can sound hesitant.",
        "Pause silently for a moment instead of saying \"um\" while you think.")


def _long_pauses(lp):
    if not lp or not _has(lp.get("score")):
        return None
    score = lp["score"]
    share = lp.get("value")
    measured = (f"{share}% of your answer time was spent in pauses of "
                f"{lp.get('minPauseSeconds', LONG_PAUSE_THRESHOLD_SECONDS):g} s or longer")
    if score >= STRONG_AT_OR_ABOVE:
        return "strength", _item(
            "Long Pauses", "Vocal", score, measured,
            "You kept your answers flowing with few long silences, which shows you were "
            "comfortable with the questions.")
    return "improvement", _item(
        "Long Pauses", "Vocal", score, measured,
        "You often stopped for long silences while answering. Long pauses are a common sign of "
        "hesitation.",
        "It is fine to take a moment before you start. Once you start, keep going in short steps "
        "(first..., then..., finally...). Practising answers to common questions aloud also helps.")


def _pitch_variation(pv):
    if not pv or not _has(pv.get("score")):
        return None
    score = pv["score"]
    pvq = pv.get("value")
    full = pv.get("fullMarksAtOrAbove", PVQ_FULL_MARKS)
    measured = (f"Pitch variation {_half_up(pvq * 100)}% of your average pitch "
                f"(full marks at {_half_up(full * 100)}% or more)") if _has(pvq) else f"Pitch variation score {_pct(score)}"
    if score >= STRONG_AT_OR_ABOVE:
        return "strength", _item(
            "Pitch Variation", "Vocal", score, measured,
            "Your voice rose and fell naturally, so you sounded lively and engaged rather than flat.")
    return "improvement", _item(
        "Pitch Variation", "Vocal", score, measured,
        "Your voice stayed quite flat (monotone). A flat voice can sound nervous or uninterested.",
        "Stress the important words and let your voice go up and down. Record yourself reading your "
        "self-introduction and listen back.")


def build_confidence_feedback(visual_breakdown, vocal_breakdown):
    """
    Returns (strengths, improvements): two lists of feedback items
    (dicts - see _item). Strengths are sorted strongest first; improvements
    weakest first, and the first improvement is marked as the top priority.
    Factors that were not measured are left out (never guessed).
    """
    visual_breakdown = visual_breakdown or {}
    vocal_breakdown = vocal_breakdown or {}

    results = [
        _eye_contact(visual_breakdown.get("eyeContact")),
        _head_pose(visual_breakdown.get("headPose")),
        _face_not_visible(visual_breakdown.get("faceNotVisiblePct")),
        _speech_rate(vocal_breakdown.get("speechRate")) if vocal_breakdown.get("speechRate")
        else _filler_words_old(vocal_breakdown.get("fillerWords")),
        _long_pauses(vocal_breakdown.get("longPauses")),
        _pitch_variation(vocal_breakdown.get("pitchVariation")),
    ]
    results = [r for r in results if r]

    strengths = sorted((i for kind, i in results if kind == "strength"), key=lambda i: -i["_sort"])
    improvements = sorted((i for kind, i in results if kind == "improvement"), key=lambda i: i["_sort"])
    for n, item in enumerate(improvements):
        item["priority"] = n == 0
    for item in strengths + improvements:
        item.pop("_sort", None)

    measured_any = bool(results)
    if measured_any and not strengths:
        strengths = [_item(
            "Keep going", None, None, None,
            "None of your confidence factors reached the strong level (80%) in this interview yet. "
            "That is normal in early practice - work on the top priority below and compare your next report.")]
    if measured_any and not improvements:
        improvements = [_item(
            "Stay consistent", None, None, None,
            "All your measured confidence factors are at the strong level (80% or above).",
            "Keep practising to stay consistent, and try a harder difficulty level to build "
            "confidence under more pressure.")]
    for item in strengths + improvements:
        item.pop("_sort", None)
    return strengths, improvements