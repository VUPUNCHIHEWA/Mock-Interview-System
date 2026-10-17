"""
custom_practice.py

SUPPORTING FEATURE (not a core research contribution): Custom Practice.

A student uploads their own interview questions (for example, questions for
the IT role they want) and practises them in the normal voice + camera
interview. The questions are read aloud, the answers are checked by the AI
(Answer Score), and the same Confidence Score and confidence feedback are
shown at the end.

Kept SEPARATE from the core study (ASSUMPTIONS.md D7-D10):
  * Sessions are saved with role = "Custom Practice", so they can always be
    told apart from the standard General Interview.
  * They are NOT shown in My Interviews (History) or the Progress page, and
    they are left out of the question history used to choose bank questions.
    The student's own questions differ in difficulty and may be rehearsed,
    so their confidence scores are not comparable with standard sessions
    (LIMITATIONS L51).
  * They are not part of the study data analysis.

Rules (D8, D9):
  * 3 to 10 questions; each 10 to 300 characters after trimming; exact
    duplicates (ignoring case and spaces) are removed.
  * All uploaded questions are asked, in a random order the student does
    not see in advance (reduces simply reading out memorised answers).
"""

import random
import re

from sqlalchemy import or_

CUSTOM_PRACTICE_ROLE = "Custom Practice"

MIN_CUSTOM_QUESTIONS = 3
MAX_CUSTOM_QUESTIONS = 10
MIN_QUESTION_CHARS = 10
MAX_QUESTION_CHARS = 300


def is_custom_practice(session) -> bool:
    return bool(session is not None and getattr(session, "role", None) == CUSTOM_PRACTICE_ROLE)


def core_sessions_only(role_column):
    """
    SQL condition that keeps only core (non-custom) sessions. Written with
    an explicit NULL check because "role != X" alone would also drop rows
    whose role is empty.
    """
    return or_(role_column.is_(None), role_column != CUSTOM_PRACTICE_ROLE)


def clean_custom_questions(raw):
    """
    Check and tidy the uploaded questions.
    Returns (questions, error_message). error_message is None when valid.
    """
    if not isinstance(raw, list):
        return [], "Please send the questions as a list."

    cleaned, seen = [], set()
    for item in raw:
        if not isinstance(item, str):
            continue
        text = re.sub(r"\s+", " ", item).strip()
        # Remove list numbering or bullets the student may have typed
        # ("1.", "2)", "-", "*", "Q1:").
        text = re.sub(r"^(?:[-*•]+|\(?\d{1,2}[.)]|q\d{1,2}[:.)])\s*", "", text, flags=re.IGNORECASE).strip()
        if not text:
            continue
        if len(text) < MIN_QUESTION_CHARS:
            return [], f'"{text}" is too short. Each question needs at least {MIN_QUESTION_CHARS} characters.'
        if len(text) > MAX_QUESTION_CHARS:
            return [], f'A question is too long ({len(text)} characters). Keep each question under {MAX_QUESTION_CHARS} characters.'
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)

    if len(cleaned) < MIN_CUSTOM_QUESTIONS:
        return [], f"Please add at least {MIN_CUSTOM_QUESTIONS} different questions."
    if len(cleaned) > MAX_CUSTOM_QUESTIONS:
        return [], f"Please add no more than {MAX_CUSTOM_QUESTIONS} questions."
    return cleaned, None


def shuffled(questions):
    order = list(questions)
    random.shuffle(order)
    return order