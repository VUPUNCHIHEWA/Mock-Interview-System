"""
istqb_quiz.py

--- BSc Research Feature: QA Career-Prep Practice Quiz (Supporting
Feature - Extension of Career Guidance Suggestions, NOT a core
research contribution) ---

Purpose:
    Provides a short practice quiz on ISTQB Foundation Level SYLLABUS
    TOPICS (e.g., testing types, test design techniques) for QA
    Engineer candidates whose content/textual score indicated a
    knowledge gap - a natural extension of the Career Guidance
    Suggestions feature (see career_resources.py).

IMPORTANT - Copyright note:
    These are ORIGINAL, researcher-authored questions covering the
    same GENERAL TOPIC AREAS as the public ISTQB Foundation Level
    syllabus (e.g., testing levels, black-box/white-box techniques,
    defect lifecycle). They are NOT copied or adapted from actual
    ISTQB exam papers or any copyrighted ISTQB materials - ISTQB past
    papers and official syllabus text are copyrighted and are not
    reproduced here. Students are directed to the official ISTQB
    syllabus (via the Career Guidance resource links) for the
    authoritative source material; this quiz is only a self-check
    practice tool covering the same subject matter in original wording.

Scope note (explicitly disclosed, same as career_resources.py):
    This is a simple, static, non-adaptive quiz (fixed question set,
    no difficulty adjustment, no learning analytics) - a supporting
    convenience feature, not a research contribution or an evaluated
    part of this project's research methodology.
"""

ISTQB_PRACTICE_QUESTIONS = [
    {
        "id": 1,
        "question": "What is the main difference between Smoke Testing and Sanity Testing?",
        "options": [
            "Smoke testing checks a broad, shallow set of core functions after a new build; sanity testing checks a narrow, deeper set of functions after a minor change.",
            "Smoke testing is always automated, while sanity testing is always manual.",
            "There is no real difference; the terms are interchangeable.",
            "Smoke testing is performed only by developers, sanity testing only by QA."
        ],
        "correct_index": 0,
        "explanation": "Smoke testing verifies that critical functionalities work after a new build (broad but shallow), while sanity testing verifies specific functionality after a small code change or bug fix (narrow but deeper)."
    },
    {
        "id": 2,
        "question": "Which of the following best describes Black-Box Testing?",
        "options": [
            "Testing based on the internal code structure and logic.",
            "Testing based on the software's specifications and requirements, without knowledge of internal code.",
            "Testing performed only by the original developer of the code.",
            "Testing that requires access to the database schema."
        ],
        "correct_index": 1,
        "explanation": "Black-box testing evaluates functionality against requirements/specifications without examining internal code structure - the tester treats the system as a 'black box.'"
    },
    {
        "id": 3,
        "question": "What is 'Equivalence Partitioning' primarily used for?",
        "options": [
            "Measuring code coverage percentage.",
            "Dividing input data into groups that are expected to be processed similarly, to reduce the number of test cases needed.",
            "Splitting a test team into equal-sized sub-groups.",
            "Partitioning a database for performance testing."
        ],
        "correct_index": 1,
        "explanation": "Equivalence Partitioning is a test-design technique that divides input data into partitions where the system is expected to behave the same way, allowing one representative test case per partition instead of testing every possible value."
    },
    {
        "id": 4,
        "question": "In the defect lifecycle, what does the status 'Reopened' typically indicate?",
        "options": [
            "The defect was fixed and verified successfully.",
            "The defect was rejected by the development team.",
            "A previously 'Fixed' defect has reappeared or was not actually resolved, so testing found the issue again.",
            "The defect is a duplicate of another reported issue."
        ],
        "correct_index": 2,
        "explanation": "'Reopened' means a defect that was marked as fixed did not pass re-testing - the original problem still exists or resurfaced, so it returns to an active state."
    },
    {
        "id": 5,
        "question": "What is the primary goal of Regression Testing?",
        "options": [
            "To test a completely new feature for the first time.",
            "To verify that recent code changes have not broken existing functionality that previously worked correctly.",
            "To measure the performance of the system under heavy load.",
            "To test the system's compatibility with different browsers only."
        ],
        "correct_index": 1,
        "explanation": "Regression testing re-runs existing test cases after changes (bug fixes, new features) to confirm that previously working functionality has not been negatively affected."
    },
    {
        "id": 6,
        "question": "Which test level typically comes immediately after Unit Testing in the standard testing process?",
        "options": [
            "User Acceptance Testing (UAT)",
            "Integration Testing",
            "Production Monitoring",
            "Exploratory Testing"
        ],
        "correct_index": 1,
        "explanation": "The typical test-level sequence is: Unit Testing (individual components) -> Integration Testing (combined components/modules) -> System Testing (whole system) -> Acceptance Testing (business/user validation)."
    },
    {
        "id": 7,
        "question": "What does 'Boundary Value Analysis' focus on testing?",
        "options": [
            "Values at the edges of valid input ranges (e.g., minimum, maximum, and just outside those limits).",
            "Only values in the exact middle of an input range.",
            "The visual boundaries/layout of the user interface.",
            "Network boundary/firewall configurations."
        ],
        "correct_index": 0,
        "explanation": "Boundary Value Analysis tests values at the edges of valid ranges (and just beyond them), since defects often occur at these boundary conditions rather than in the middle of a range."
    },
    {
        "id": 8,
        "question": "What is the main purpose of a 'Test Plan' document?",
        "options": [
            "To list every line of source code in the application.",
            "To outline the scope, approach, resources, and schedule of intended testing activities for a project.",
            "To record only the bugs found after testing is complete.",
            "To serve as the official user manual for the software."
        ],
        "correct_index": 1,
        "explanation": "A Test Plan describes the testing strategy: what will be tested, how, by whom, with what resources, and on what schedule - it's a planning document, not a bug log or user manual."
    },
]


def get_quiz_questions() -> list:
    """
    Returns the quiz questions WITHOUT the correct_index and explanation
    fields (so the frontend cannot see answers before the student
    submits) - a "safe" version for sending to the client.
    """
    return [
        {"id": q["id"], "question": q["question"], "options": q["options"]}
        for q in ISTQB_PRACTICE_QUESTIONS
    ]


def grade_quiz(answers: dict) -> dict:
    """
    Grades submitted answers.

    Args:
        answers: dict mapping question id (as string or int) -> selected option index

    Returns:
        {
            "score": int (correct count),
            "total": int,
            "results": [{"id", "correct", "correct_index", "explanation"}, ...]
        }
    """
    results = []
    score = 0

    for q in ISTQB_PRACTICE_QUESTIONS:
        qid = q["id"]
        submitted = answers.get(str(qid), answers.get(qid))
        is_correct = (submitted == q["correct_index"])
        if is_correct:
            score += 1
        results.append({
            "id": qid,
            "correct": is_correct,
            "correct_index": q["correct_index"],
            "explanation": q["explanation"],
        })

    return {
        "score": score,
        "total": len(ISTQB_PRACTICE_QUESTIONS),
        "results": results,
    }