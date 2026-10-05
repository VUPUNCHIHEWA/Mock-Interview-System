"""
career_resources.py

--- BSc Research Feature: Career Guidance Suggestions (Supporting
Feature - NOT a core research contribution) ---

Purpose:
    Provides simple, static learning-resource suggestions when a
    student's answer content (Textual Score) is weak, mapped by their
    selected role. Behavioral weaknesses (Visual/Vocal) already have
    actionable tips via the Progress Tracker's Focus Area feature
    (see progress_tracker.py) - this module specifically addresses
    CONTENT/technical-knowledge gaps, which resources like courses and
    certifications can meaningfully help with (behavioral confidence
    cannot be improved by "taking a course").

Scope note (explicitly disclosed):
    This is intentionally a simple, static lookup table - NOT a dynamic
    recommendation engine, personalized learning-path system, or
    ML-based suggestion model. That would be a substantial, separate
    research area (educational recommender systems) outside this
    project's core focus (behavioral confidence analysis). This module
    is included as a small, practical supporting feature only,
    following the same "supporting infrastructure, not a research
    claim" categorization used for other non-core features in this
    project (e.g., CV Builder).

--- ASSUMPTION - not literature-derived --- The textual-score
threshold (60) used to trigger a resource suggestion, and the specific
resources listed per role, are researcher-curated choices, not derived
from a specific paper or a validated recommendation algorithm.
"""

TEXTUAL_SCORE_LOW_THRESHOLD = 60

ROLE_RESOURCES = {
    "QA Engineer": [
        {"name": "ISTQB Foundation Level Syllabus", "type": "Certification Guide", "link": "https://www.istqb.org/certifications/foundation-level"},
        {"name": "Software Testing and Automation (Coursera)", "type": "Online Course", "link": "https://www.coursera.org/courses?query=software%20testing"},
        {"name": "Selenium Official Documentation", "type": "Technical Documentation", "link": "https://www.selenium.dev/documentation/"},
        {"name": "Complete Manual Testing Course (Udemy)", "type": "Online Course", "link": "https://www.udemy.com/topic/software-testing/"},
    ],
    "Software Engineer": [
        {"name": "CS50: Introduction to Computer Science (Harvard/edX)", "type": "Online Course", "link": "https://cs50.harvard.edu/x/"},
        {"name": "System Design Primer (GitHub)", "type": "Technical Documentation", "link": "https://github.com/donnemartin/system-design-primer"},
        {"name": "LeetCode - Data Structures & Algorithms Practice", "type": "Practice Platform", "link": "https://leetcode.com/"},
    ],
    "Business Analyst": [
        {"name": "BABOK Guide (IIBA Body of Knowledge)", "type": "Certification Guide", "link": "https://www.iiba.org/business-analysis-certifications/babok/"},
        {"name": "Business Analysis Fundamentals (Coursera)", "type": "Online Course", "link": "https://www.coursera.org/courses?query=business%20analysis"},
        {"name": "Agile Business Analysis Practices (IIBA)", "type": "Technical Documentation", "link": "https://www.iiba.org/"},
    ],
    "UX/UI Designer": [
        {"name": "Google UX Design Professional Certificate (Coursera)", "type": "Certification Course", "link": "https://www.coursera.org/professional-certificates/google-ux-design"},
        {"name": "Nielsen Norman Group - UX Research Articles", "type": "Technical Documentation", "link": "https://www.nngroup.com/articles/"},
        {"name": "Figma Learn - Official Tutorials", "type": "Technical Documentation", "link": "https://help.figma.com/hc/en-us/categories/360002051613-Figma-Design"},
    ],
}

# Fallback for roles not in the curated list (e.g., "Other" from surveys,
# or a role string that doesn't exactly match - never crash, just show nothing).
DEFAULT_RESOURCES = []


def get_recommended_resources(role: str, textual_score) -> dict:
    """
    Returns recommended learning resources for a role, ONLY if the
    textual (content) score indicates a genuine content-knowledge gap.

    Returns:
        {"triggered": bool, "resources": list, "reason": str or None}
    """
    if textual_score is None:
        return {"triggered": False, "resources": [], "reason": "No textual score available"}

    if textual_score >= TEXTUAL_SCORE_LOW_THRESHOLD:
        return {"triggered": False, "resources": [], "reason": None}

    resources = ROLE_RESOURCES.get(role, DEFAULT_RESOURCES)

    return {
        "triggered": True,
        "resources": resources,
        "reason": f"Your content/technical score ({textual_score}%) suggests reviewing "
                   f"foundational {role} knowledge could help in future sessions.",
    }