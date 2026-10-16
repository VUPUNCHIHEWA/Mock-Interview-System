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


def is_valid_comparison_group(session_a, session_b) -> tuple:
    """
    ⭐ CORE VALIDATION TOOL - Determines whether two sessions are
    methodologically comparable, applying an "experimental control"
    principle borrowed from research methodology: a fair comparison
    requires holding relevant confounding variables constant between
    the conditions being compared (here, between Session A and Session
    B), so that any observed difference can be attributed to genuine
    change over time rather than to a difference in the sessions
    themselves.

    Checks 3 dimensions of equivalence:
    1. Same role - different job roles have different question
       difficulty/content, making scores non-comparable.
    2. Same difficulty level - Easy vs Hard sessions are not
       comparable on raw score alone.
    3. Same interview mode (TEXT vs MULTIMODAL) - a TEXT-mode session
       has NO visual/vocal data at all; comparing it against a
       MULTIMODAL session's visual/vocal scores would be comparing
       real data against the complete absence of data, not a
       meaningful change.

    Returns (is_valid: bool, reason: str or None) - reason explains
    which dimension failed, for transparent reporting to the student.

    --- ASSUMPTION - not literature-derived --- these 3 specific
    dimensions were chosen as the relevant confounding variables for
    THIS project's context; the general principle of controlling
    confounding variables for valid comparison is standard experimental
    methodology, but the specific list of variables to control is a
    researcher judgment call, not itself derived from a cited paper.
    """
    if session_a.role != session_b.role:
        return False, f"different roles ({session_a.role} vs {session_b.role})"
    if session_a.difficulty != session_b.difficulty:
        return False, f"different difficulty levels ({session_a.difficulty} vs {session_b.difficulty})"
    if session_a.interview_mode != session_b.interview_mode:
        return False, f"different interview modes ({session_a.interview_mode} vs {session_b.interview_mode})"
    return True, None


def compare_sessions(session_old, session_new) -> dict:
    """
    Compare two InterviewSession DB rows (SQLAlchemy objects) - the
    earliest and the most recent completed sessions for one user.

    Returns a dict summarizing the change between sessions across
    overall score, visual score, vocal score, and confidence level.
    """
    old_summary = _parse_summary(session_old)
    new_summary = _parse_summary(session_new)

    # Main score = Confidence Score (needs BOTH camera and voice). A session
    # without one has no main score (None) - it is never counted as 0.
    from app.services.interview_service import stored_main_score
    old_overall = stored_main_score(session_old)
    new_overall = stored_main_score(session_new)
    overall_change = (new_overall - old_overall) if (old_overall is not None and new_overall is not None) else None

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
        "overall_score_trend": _direction(overall_change, higher_is_better=True) if overall_change is not None else "No data",
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


def get_comparison_options(db, user_id: int) -> dict:
    """
    ⭐ NEW: Returns the list of (role, difficulty, interview_mode)
    combinations this user has 2+ completed sessions for - i.e., the
    combinations that are VALID to compare. Used to populate the
    frontend's role/difficulty/mode selection dropdowns, so the student
    can only ever select combinations that actually have comparable
    data, rather than guessing and hitting a "not enough data" error.
    """
    from app.models import InterviewSession

    completed_sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id,
        InterviewSession.status == "Completed"
    ).all()

    groups = {}
    for s in completed_sessions:
        key = (s.role, s.difficulty, s.interview_mode)
        groups.setdefault(key, []).append(s)

    options = [
        {"role": role, "difficulty": difficulty, "interview_mode": mode, "session_count": len(sessions)}
        for (role, difficulty, mode), sessions in groups.items()
        if len(sessions) >= 2
    ]
    # Most-sessions-first, so the frontend can pre-select the most data-rich option by default.
    options.sort(key=lambda o: o["session_count"], reverse=True)

    return {
        "options": options,
        "has_any_valid_combination": len(options) > 0,
    }


def get_user_progress(db, user_id: int, role: str = None, difficulty: str = None, interview_mode: str = None) -> dict:
    """
    Main entry point: fetches a user's completed sessions and compares
    the earliest vs. most recent session WITHIN THE SAME role+
    difficulty+interview_mode combination, returning the comparison +
    friendly messages.

    --- BSc Research Feature: user-selectable comparison group. Rather
    than the system silently auto-selecting "the largest matching
    group" (a black-box decision the student has no visibility into or
    control over), the student can now explicitly choose which role/
    difficulty/interview-mode combination to view progress for, via the
    optional role/difficulty/interview_mode parameters. This gives the
    student full transparency and control over exactly which sessions
    are being compared - directly supporting the project's broader
    interpretability/transparency principle (see ML Core, Doshi-Velez &
    Kim, 2017). If no filters are provided (backward-compatible
    default), the system falls back to auto-selecting the largest valid
    group, as before.

    See is_valid_comparison_group() for the research-methodology
    reasoning behind requiring role+difficulty+interview_mode to match
    (experimental-control principle: holding confounding variables
    constant for a fair comparison).
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

    # Group sessions by (role, difficulty, interview_mode) - only
    # sessions within the SAME group are eligible for comparison with
    # each other.
    groups = {}
    for s in completed_sessions:
        key = (s.role, s.difficulty, s.interview_mode)
        groups.setdefault(key, []).append(s)

    eligible_groups = {k: v for k, v in groups.items() if len(v) >= 2}

    if not eligible_groups:
        attempted_combos = ", ".join(
            f"{r} / {d} / {m}" for r, d, m in groups.keys()
        )
        return {
            "available": False,
            "message": (
                f"Progress tracking requires at least 2 completed sessions with the SAME "
                f"role, difficulty, AND interview mode (e.g., two 'QA Engineer - Easy - "
                f"Multimodal' sessions) so that scores are fairly comparable. You've "
                f"completed sessions in: {attempted_combos}. Complete another session "
                f"matching one of these combinations to see your progress!"
            ),
        }

    if role is not None or difficulty is not None or interview_mode is not None:
        # User explicitly selected a combination - use it if valid.
        selected_key = (role, difficulty, interview_mode)
        if selected_key not in eligible_groups:
            return {
                "available": False,
                "message": (
                    f"No comparable sessions found for {role} / {difficulty} / {interview_mode}. "
                    f"Please choose a different combination from the available options."
                ),
            }
        best_key = selected_key
    else:
        # No selection made - auto-select the largest group (backward-compatible default).
        best_key = max(
            eligible_groups.keys(),
            key=lambda k: (len(eligible_groups[k]), eligible_groups[k][-1].created_at)
        )

    matched_sessions = eligible_groups[best_key]

    session_old = matched_sessions[0]
    session_new = matched_sessions[-1]

    # Defensive re-validation using the dedicated validator tool.
    is_valid, invalid_reason = is_valid_comparison_group(session_old, session_new)
    if not is_valid:
        return {
            "available": False,
            "message": f"Could not find a valid comparable session pair ({invalid_reason}).",
        }

    comparison = compare_sessions(session_old, session_new)
    messages = generate_progress_message(comparison)
    focus_area = generate_focus_area(comparison)

    from app.services.interview_service import stored_main_score
    all_sessions = []
    for s in completed_sessions:
        summary = _parse_summary(s)
        all_sessions.append({
            "session_id": s.session_id,
            "date": s.created_at.isoformat() if s.created_at else None,
            "role": s.role,
            "difficulty": s.difficulty,
            "interview_mode": s.interview_mode,
            "overall_score": stored_main_score(s),
            "confidence_level": summary.get("confidenceLevel", "NOT_AVAILABLE"),
            "is_in_comparison_group": s in matched_sessions,
        })

    return {
        "available": True,
        "comparison": comparison,
        "messages": messages,
        "focus_area": focus_area,
        "all_sessions": all_sessions,
        "total_completed_sessions": len(completed_sessions),
        "comparison_group_role": best_key[0],
        "comparison_group_difficulty": best_key[1],
        "comparison_group_mode": best_key[2],
        "comparison_group_size": len(matched_sessions),
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

    overall_changes = [c["overall_score_change"] for c in per_user_comparisons
                       if c["overall_score_change"] is not None]
    avg_overall_change = round(sum(overall_changes) / len(overall_changes), 1) if overall_changes else None

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

# ---------------------------------------------------------------------------
# Progress timeline (Progress page chart + history cards)
# ---------------------------------------------------------------------------
# Returns EVERY completed session of a user, oldest first, with the overall
# score and the 5 confidence-factor scores (Eye Contact, Head Pose, Filler
# Words, Long Pauses, Pitch Variation) as 0-100%. The frontend draws the
# time chart (24h / 7d / 30d / 90d / 1y / All) and the history cards from it.
#
# Factor scores are re-calculated from the stored raw data, so older
# sessions get them too where the raw data exists:
#   - Vocal factors: from the per-answer filler count, answer time,
#     long-pause time and pitch variation quotient, using the SAME function
#     as the results page (compute_session_vocal). Answers recorded before
#     these were stored have no vocal factors (N/A).
#   - Visual factors: from the per-frame gaze / head-stability scores
#     (only stored for sessions recorded after that feature was added).
# A factor with no real data is None ("N/A") - never a made-up value.

def get_progress_timeline(db, user_id: int) -> dict:
    from sqlalchemy import func
    from app.models import InterviewSession, InterviewResponse, VisualMetric
    from app.services.voice_analysis import compute_session_vocal
    from app.services.interview_service import stored_main_score

    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user_id, InterviewSession.status == "Completed")
        .order_by(InterviewSession.created_at.asc())
        .all()
    )
    session_ids = [s.session_id for s in sessions]
    if not session_ids:
        return {"sessions": []}

    # Per-session averages of the per-frame visual factor scores.
    visual_rows = (
        db.query(
            VisualMetric.session_id,
            func.avg(VisualMetric.gaze_score),
            func.avg(VisualMetric.head_stability_score),
        )
        .filter(VisualMetric.session_id.in_(session_ids))
        .group_by(VisualMetric.session_id)
        .all()
    )
    visual_by_session = {sid: (gaze, head) for sid, gaze, head in visual_rows}

    # Per-answer voice metrics (same answers the results page uses: those
    # that have voice data), grouped by session.
    vocal_rows = (
        db.query(InterviewResponse)
        .filter(
            InterviewResponse.session_id.in_(session_ids),
            InterviewResponse.filler_word_count.isnot(None),
        )
        .all()
    )
    vocal_by_session = {}
    for r in vocal_rows:
        vocal_by_session.setdefault(r.session_id, []).append(r)

    def _round(v):
        return round(float(v), 1) if v is not None else None

    timeline = []
    for s in sessions:
        summary = _parse_summary(s)

        gaze, head = visual_by_session.get(s.session_id, (None, None))
        factors = {
            "eyeContact": _round(gaze),
            "headPose": _round(head),
            "fillerWords": None,
            "longPauses": None,
            "pitchVariation": None,
        }
        vocal_raw = {}
        breakdown = compute_session_vocal(vocal_by_session.get(s.session_id, []))["vocalBreakdown"]
        if breakdown:
            for key in ("fillerWords", "longPauses", "pitchVariation"):
                factors[key] = breakdown[key]["score"]
                vocal_raw[key] = breakdown[key]["value"]

        timeline.append({
            "session_id": s.session_id,
            "date": s.created_at.isoformat() if s.created_at else None,
            "role": s.role,
            "difficulty": s.difficulty,
            "interview_mode": s.interview_mode,
            # Main score = confidence score; None for sessions scored with
            # the older 60/20/20 formula (not comparable).
            "overall_score": _round(stored_main_score(s)),
            "textual_score": summary.get("textualScore"),
            "visual_score": summary.get("visualScore"),
            "vocal_score": summary.get("vocalScore"),
            "confidence_level": summary.get("confidenceLevel", "NOT_AVAILABLE"),
            "factors": factors,
            "vocal_raw": vocal_raw,
        })

    return {"sessions": timeline}
