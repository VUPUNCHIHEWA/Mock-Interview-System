"""
synthetic_data.py

⭐ CORE MODULE - Step 4 (Original Research Contribution, Part 1)

Purpose:
    Generates synthetic training examples to bootstrap the Decision Tree
    confidence-classification model (ml_model.py), since real pilot data
    (15-20 students x 2 sessions = ~30-40 samples) is too small on its
    own to reliably train a machine learning model.

Feature set (adapted to this project's actual database schema):
    - visual_confidence_score: session-average from the VisualMetric
      table (already combines gaze + head-pose per the Step 2 weighted
      formula, 0.6*gaze_score + 0.4*head_stability_score - this
      project's DB only stores the combined score, not the two
      sub-scores separately).
    - filler_word_count, long_pause_count, pitch_variation: session
      averages from InterviewResponse rows (Step 3 voice analysis).

Research basis:
    Same literature-informed thresholds established in Steps 2-3:
    - Long-pause / filler-word / pitch thresholds: see voice_analysis.py
      docstring (arXiv 1812.03415 for the pause threshold; Speak AI,
      2026 for the filler-word guidance).
    - Visual confidence threshold: derived from the same weighted
      formula used in visual_analysis.py (arXiv 2506.09153 general
      approach).

Honesty note (same as standalone prototype):
    Synthetic labels are generated using these thresholds directly, so
    the Decision Tree's initial training data reflects known patterns,
    not newly discovered ones. Its practical value is in (a) combining
    4 features into one interpretable classification, and (b) being
    calibrated/validated against real pilot session data afterward (see
    RESEARCH_DOCUMENTATION.md, Evaluation section).
"""

import random
import pandas as pd

# --- ASSUMPTION - not literature-derived (used to LABEL synthetic
#     examples; thresholds themselves reused from Steps 2-3 modules) ---
VISUAL_SCORE_LOW_THRESHOLD = 50.0
FILLER_WORD_THRESHOLD = 6
LONG_PAUSE_FLAG = 1
PITCH_VARIATION_LOW_THRESHOLD = 15.0

FEATURE_COLUMNS = [
    "visual_confidence_score", "filler_word_count", "long_pause_count", "pitch_variation"
]


def _label_confidence(visual_score, filler_count, long_pauses, pitch_var) -> str:
    """
    Simple scoring rule used ONLY to generate labels for synthetic
    training data (not used at prediction time - the trained Decision
    Tree learns its own decision boundaries from this data).
    """
    risk_points = 0
    if visual_score < VISUAL_SCORE_LOW_THRESHOLD:
        risk_points += 1
    if filler_count > FILLER_WORD_THRESHOLD:
        risk_points += 1
    if long_pauses >= LONG_PAUSE_FLAG:
        risk_points += 1
    if pitch_var < PITCH_VARIATION_LOW_THRESHOLD:
        risk_points += 1

    if risk_points <= 1:
        return "High Confidence"
    elif risk_points <= 2:
        return "Moderate Confidence"
    else:
        return "Low Confidence"


def generate_synthetic_dataset(num_samples: int = 300, random_seed: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic dataset of (features, confidence_label) pairs
    for bootstrapping the Decision Tree model.
    """
    random.seed(random_seed)
    rows = []

    for _ in range(num_samples):
        visual_score = random.randint(10, 100)
        filler_count = random.randint(0, 20)
        long_pauses = random.randint(0, 5)
        pitch_var = round(random.uniform(3, 40), 1)

        label = _label_confidence(visual_score, filler_count, long_pauses, pitch_var)

        rows.append({
            "visual_confidence_score": visual_score,
            "filler_word_count": filler_count,
            "long_pause_count": long_pauses,
            "pitch_variation": pitch_var,
            "confidence_label": label,
        })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate_synthetic_dataset(num_samples=10)
    print(df)
    print()
    print("Label distribution across 300 synthetic samples:")
    print(generate_synthetic_dataset(num_samples=300)["confidence_label"].value_counts())