"""
progress_tracker.py

⭐ CORE MODULE - Step 5 (Original Research Contribution, Part 3)

Purpose:
    Compares a student's earliest and most recent COMPLETED interview
    sessions to show whether their confidence indicators improved -
    filling the "no longitudinal tracking" gap identified in the
    literature (same gap-justification papers as feedback_engine /
    ml_model.py).

Research basis:
    Same gap-justification papers established earlier in this project:
    - Explainable AI Interviews and Organizational Attractiveness (MDPI,
      2026) https://doi.org/10.3390/admsci16030144
    - Expecting Too Much, Getting Too Little: Asynchronous AI
      Interviewers (arXiv, 2026) https://arxiv.org/html/2601.02775v2
    Both identify a lack of longitudinal/progress-tracking feedback in
    existing AI mock-interview systems as a gap this project addresses.

No new database columns required:
    Reuses data already stored on InterviewSession: overall_score,
    role, difficulty, and summary_feedback (a JSON string containing
    textualScore, visualScore, vocalScore, confidenceLevel).

--- ASSUMPTION - not literature-derived --- The "significant change"
percentage-point threshold below, and the confidence-level ranking used
to compare categorical labels, are researcher design decisions (kept
deliberately simple per this project's BSc-appropriate scope), not
sourced from literature.
"""

import json

SIGNIFICANT_CHANGE_THRESHOLD = 5  # percentage points

# Ranking for comparing categorical confidence labels (Step 4 ML Core output)
CONFIDENCE_RANK = {
    "Low Confidence": 1,
    "Moderate Confidence": 2,
    "High Confidence": 3,
    "NOT_AVAILABLE": None,
}


def _direction(change: float, higher_is_better: bool = True) -> str:
    if change is None:
        return "No data"
    if abs(change) < SIGNIFICANT_CHANGE_THRESHOLD:
        return "No significant change"
    improved = (change > 0) if higher_is_better else (change < 0)
    return "Improved" if improved else "Declined"


def _parse_summary(session) -> dict:
    """Safely parse the summary_feedback JSON string stored on a session."""
    if not session.summary_feedback:
        return {}
    try:
        return json.loads(session.summary_feedback)
    except (json.JSONDecodeError, TypeError):
        return {}


def compare_sessions(session_old, session_new) -> dict:
    """
    Compare two InterviewSession DB rows (SQLAlchemy objects) - the
    earliest and the most recent completed sessions for one user.

    Returns a dict summarizing the change between sessions across
    overall score, visual score, vocal score, and confidence level.
    """
    old_summary = _parse_summary(session_old)
    new_summary = _parse_summary(session_new)

    old_overall = session_old.overall_score or 0
    new_overall = session_new.overall_score or 0
    overall_change = new_overall - old_overall

    old_visual = old_summary.get("visualScore")
    new_visual = new_summary.get("visualScore")
    visual_change = (new_visual - old_visual) if (old_visual is not None and new_visual is not None) else None

    old_vocal = old_summary.get("vocalScore")
    new_vocal = new_summary.get("vocalScore")
    vocal_change = (new_vocal - old_vocal) if (old_vocal is not None and new_vocal is not None) else None

    old_conf_label = old_summary.get("confidenceLevel", "NOT_AVAILABLE")
    new_conf_label = new_summary.get("confidenceLevel", "NOT_AVAILABLE")
    old_conf_rank = CONFIDENCE_RANK.get(old_conf_label)
    new_conf_rank = CONFIDENCE_RANK.get(new_conf_label)

    if old_conf_rank is not None and new_conf_rank is not None:
        if new_conf_rank > old_conf_rank:
            confidence_trend = "Improved"
        elif new_conf_rank < old_conf_rank:
            confidence_trend = "Declined"
        else:
            confidence_trend = "No change"
    else:
        confidence_trend = "No data"

    # --- BSc Research Feature (Suggestion #2): role/difficulty
    # consistency check. Comparing a Session 1 (e.g. QA Engineer, Easy)
    # against a Session 2 with a DIFFERENT role/difficulty (e.g.
    # Software Engineer, Hard) is methodologically an "apples to
    # oranges" comparison - an apparent score change could be caused by
    # the role/difficulty change rather than genuine confidence
    # improvement. This is flagged explicitly rather than silently
    # presenting a potentially confounded comparison as valid.
    same_role = (session_old.role == session_new.role)
    same_difficulty = (session_old.difficulty == session_new.difficulty)
    context_consistent = same_role and same_difficulty
    context_warning = None
    if not context_consistent:
        mismatches = []
        if not same_role:
            mismatches.append(f"role changed ({session_old.role} → {session_new.role})")
        if not same_difficulty:
            mismatches.append(f"difficulty changed ({session_old.difficulty} → {session_new.difficulty})")
        context_warning = (
            "These sessions are not directly comparable: " + "; ".join(mismatches) +
            ". Score changes below may reflect this difference rather than genuine confidence change."
        )

    return {
        "session_old": {
            "session_id": session_old.session_id,
            "date": session_old.created_at.isoformat() if session_old.created_at else None,
            "role": session_old.role,
            "difficulty": session_old.difficulty,
            "overall_score": old_overall,
            "visual_score": old_visual,
            "vocal_score": old_vocal,
            "confidence_level": old_conf_label,
        },
        "session_new": {
            "session_id": session_new.session_id,
            "date": session_new.created_at.isoformat() if session_new.created_at else None,
            "role": session_new.role,
            "difficulty": session_new.difficulty,
            "overall_score": new_overall,
            "visual_score": new_visual,
            "vocal_score": new_vocal,
            "confidence_level": new_conf_label,
        },
        "context_consistent": context_consistent,
        "context_warning": context_warning,
        "overall_score_change": overall_change,
        "overall_score_trend": _direction(overall_change, higher_is_better=True),
        "visual_score_change": visual_change,
        "visual_score_trend": _direction(visual_change, higher_is_better=True) if visual_change is not None else "No data",
        "vocal_score_change": vocal_change,
        "vocal_score_trend": _direction(vocal_change, higher_is_better=True) if vocal_change is not None else "No data",
        "confidence_level_old": old_conf_label,
        "confidence_level_new": new_conf_label,
        "confidence_trend": confidence_trend,
    }


def generate_progress_message(comparison: dict) -> list:
    """Turn the comparison dict into a list of friendly, readable progress messages."""
    if "error" in comparison:
        return [comparison["error"]]

    messages = []

    # --- BSc Research Feature (Suggestion #2): surface the
    # role/difficulty consistency warning first, before any score
    # interpretation, so the student sees the caveat before the numbers.
    if comparison.get("context_warning"):
        messages.append(f"⚠️ {comparison['context_warning']}")

    if comparison["overall_score_trend"] == "Improved":
        messages.append(f"🎉 Your overall score improved by {comparison['overall_score_change']} points!")
    elif comparison["overall_score_trend"] == "Declined":
        messages.append(f"📉 Your overall score dropped by {abs(comparison['overall_score_change'])} points - review your last session's feedback.")

    if comparison["visual_score_trend"] == "Improved":
        messages.append(f"👁️ Your visual confidence improved by {comparison['visual_score_change']} points!")
    elif comparison["visual_score_trend"] == "Declined":
        messages.append(f"👁️ Your visual confidence dropped by {abs(comparison['visual_score_change'])} points.")

    if comparison["vocal_score_trend"] == "Improved":
        messages.append(f"🎙️ Your vocal delivery improved by {comparison['vocal_score_change']} points!")
    elif comparison["vocal_score_trend"] == "Declined":
        messages.append(f"🎙️ Your vocal delivery dropped by {abs(comparison['vocal_score_change'])} points.")

    if comparison["confidence_trend"] == "Improved":
        messages.append(f"🌳 AI-predicted confidence level improved: {comparison['confidence_level_old']} → {comparison['confidence_level_new']}")
    elif comparison["confidence_trend"] == "Declined":
        messages.append(f"🌳 AI-predicted confidence level dropped: {comparison['confidence_level_old']} → {comparison['confidence_level_new']}")

    if len(messages) == (1 if comparison.get("context_warning") else 0):
        messages.append("Your performance is consistent across sessions - no significant change detected.")

    return messages


def generate_focus_area(comparison: dict) -> dict:
    """
    Identify the metric most in need of improvement (weakest latest score,
    or most-declined trend) and return a concrete, actionable tip.
    """
    candidates = []

    if comparison["visual_score_trend"] == "Declined" or (comparison["session_new"]["visual_score"] or 100) < 60:
        candidates.append({
            "area": "Eye Contact & Visual Confidence",
            "score": comparison["session_new"]["visual_score"],
            "tip": "Practice looking directly at your camera lens (not the screen) while answering. "
                   "Try propping your camera at eye level and placing a small sticky note next to it as a reminder.",
        })

    if comparison["vocal_score_trend"] == "Declined" or (comparison["session_new"]["vocal_score"] or 100) < 60:
        candidates.append({
            "area": "Vocal Delivery",
            "score": comparison["session_new"]["vocal_score"],
            "tip": "Before your next session, practice pausing silently for a moment instead of saying "
                   "'um' or 'uh' when you need to think. Recording yourself once beforehand can help you notice these patterns.",
        })

    if not candidates:
        return {
            "area": "Keep it up!",
            "score": None,
            "tip": "You're performing consistently well across all tracked areas. "
                   "Try a harder difficulty level next session to keep challenging yourself.",
        }

    candidates.sort(key=lambda c: c["score"] if c["score"] is not None else 0)
    return candidates[0]


def get_user_progress(db, user_id: int) -> dict:
    """
    Main entry point: fetches a user's earliest and most recent COMPLETED
    sessions and returns the comparison + friendly messages.

    --- BSc Research Feature (Suggestion #1): also returns a full
    "all_sessions" trend list (every completed session, not just the
    first and latest) - previously, sessions between the first and
    latest were completely invisible to the student, even though they
    represent real progress data. This does not change the core
    first-vs-latest comparison (kept for consistency with the original
    fixed-length-session validity argument), but restores visibility of
    the student's full session history.
    """
    from app.models import InterviewSession

    completed_sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id,
        InterviewSession.status == "Completed"
    ).order_by(InterviewSession.created_at.asc()).all()

    if len(completed_sessions) < 2:
        return {
            "available": False,
            "message": f"Progress tracking requires at least 2 completed sessions "
                       f"(found {len(completed_sessions)}). Complete another session to see your progress!",
        }

    session_old = completed_sessions[0]
    session_new = completed_sessions[-1]

    comparison = compare_sessions(session_old, session_new)
    messages = generate_progress_message(comparison)
    focus_area = generate_focus_area(comparison)

    all_sessions = []
    for s in completed_sessions:
        summary = _parse_summary(s)
        all_sessions.append({
            "session_id": s.session_id,
            "date": s.created_at.isoformat() if s.created_at else None,
            "role": s.role,
            "difficulty": s.difficulty,
            "overall_score": s.overall_score,
            "confidence_level": summary.get("confidenceLevel", "NOT_AVAILABLE"),
        })

    return {
        "available": True,
        "comparison": comparison,
        "messages": messages,
        "focus_area": focus_area,
        "all_sessions": all_sessions,
        "total_completed_sessions": len(completed_sessions),
    }


def get_research_summary(db) -> dict:
    """
    ⭐ Research Feature (Step 5, Option B): aggregates progress data
    ACROSS ALL students who have completed 2+ sessions - intended for the
    researcher's Results/Evaluation chapter, not for individual student
    display.
    """
    from app.models import InterviewSession

    all_user_ids = [row[0] for row in db.query(InterviewSession.user_id).distinct().all()]

    eligible_users = []
    per_user_comparisons = []

    for uid in all_user_ids:
        completed = db.query(InterviewSession).filter(
            InterviewSession.user_id == uid,
            InterviewSession.status == "Completed"
        ).order_by(InterviewSession.created_at.asc()).all()

        if len(completed) >= 2:
            eligible_users.append(uid)
            comparison = compare_sessions(completed[0], completed[-1])
            per_user_comparisons.append(comparison)

    if not per_user_comparisons:
        return {
            "available": False,
            "message": "No students have completed 2+ sessions yet - "
                       "research summary requires pilot data collection first.",
        }

    def _count_trend(key):
        counts = {"Improved": 0, "Declined": 0, "No significant change": 0, "No data": 0}
        for c in per_user_comparisons:
            trend = c.get(key, "No data")
            counts[trend] = counts.get(trend, 0) + 1
        return counts

    overall_changes = [c["overall_score_change"] for c in per_user_comparisons]
    avg_overall_change = round(sum(overall_changes) / len(overall_changes), 1)

    return {
        "available": True,
        "total_eligible_students": len(eligible_users),
        "overall_score_trend_counts": _count_trend("overall_score_trend"),
        "visual_score_trend_counts": _count_trend("visual_score_trend"),
        "vocal_score_trend_counts": _count_trend("vocal_score_trend"),
        "confidence_level_trend_counts": _count_trend("confidence_trend"),
        "average_overall_score_change": avg_overall_change,
        "per_user_comparisons": [
            {"user_id": uid, **comp} for uid, comp in zip(eligible_users, per_user_comparisons)
        ],
    }