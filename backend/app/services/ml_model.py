"""
ml_model.py

⭐ CORE MODULE - Step 4 (Original Research Contribution, Part 2)

Purpose:
    Trains a Decision Tree classifier on the synthetic dataset
    (synthetic_data.py), saves the trained model, and provides a
    function to predict a session-level confidence label ("High" /
    "Moderate" / "Low" Confidence) from real session data.

Why a Decision Tree (not deep learning / an LLM):
    1. Interpretable - the decision path can be printed/explained,
       directly supporting this project's explainability goal.
    2. Lightweight - trains in seconds, no GPU needed - appropriate for
       a BSc-scope, low-resource project.
    3. Realistic for available data - with only ~30-40 real pilot
       session samples, a simple, low-variance model is far less prone
       to overfitting than a complex one.

Research basis:
    Doshi-Velez, F., & Kim, B. (2017). Towards a Rigorous Science of
    Interpretable Machine Learning. arXiv. https://arxiv.org/pdf/1702.08608
    - motivates choosing an inherently interpretable model over a
      black-box model when explainability matters.

    Gibbons, C., Richards, S., Valderas, J.M., & Campbell, J. (2017).
    Supervised Machine Learning Algorithms Can Classify Open-Text
    Feedback of Doctor Performance With Human-Level Accuracy. JMIR.
    https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5371715/
    - supports using simple supervised ML for feedback-classification
      tasks.

Calibration with real data (planned for pilot-study phase):
    Once real Session 1 + Session 2 data is collected, predictions
    should be compared against students' self-reported confidence
    (evaluation survey) to report an honest agreement rate - see
    calibrate_with_real_data() below.
"""

import os
import joblib
import pandas as pd
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# Supports both: (a) running inside the FastAPI app (uvicorn app.main:app),
# where the full "app.services.synthetic_data" package path is available,
# and (b) running this file standalone for testing
# (cd backend/app/services && python ml_model.py), where only the local
# "synthetic_data" module is importable.
try:
    from app.services.synthetic_data import generate_synthetic_dataset, FEATURE_COLUMNS
except ImportError:
    from synthetic_data import generate_synthetic_dataset, FEATURE_COLUMNS

MODEL_PATH = os.path.join(os.path.dirname(__file__), "confidence_model.joblib")


def train_and_save_model(num_synthetic_samples: int = 300) -> dict:
    """
    Train the Decision Tree on synthetic data, evaluate on a held-out
    split, and save the trained model to disk.
    """
    df = generate_synthetic_dataset(num_samples=num_synthetic_samples)
    X = df[FEATURE_COLUMNS]
    y = df["confidence_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # --- ASSUMPTION - not literature-derived --- max_depth=4 is a
    # practical simplicity choice to keep the tree short and readable
    # (per Doshi-Velez & Kim, 2017: interpretability decreases as tree
    # depth increases).
    model = DecisionTreeClassifier(max_depth=4, random_state=42)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    report = classification_report(y_test, predictions)

    joblib.dump(model, MODEL_PATH)
    print(f"✅ Model trained and saved to {MODEL_PATH}")

    return {
        "accuracy_on_synthetic_holdout": round(accuracy, 3),
        "classification_report": report,
        "tree_structure": export_text(model, feature_names=FEATURE_COLUMNS),
    }


def load_model() -> DecisionTreeClassifier:
    """Load the previously trained and saved model, training it first if missing."""
    if not os.path.exists(MODEL_PATH):
        print("⚠️ No trained model found - training one now (first run)...")
        train_and_save_model()
    return joblib.load(MODEL_PATH)


def predict_confidence_level(visual_confidence_score: float, filler_word_count: float,
                               long_pause_count: float, pitch_variation: float) -> str:
    """
    Predict a session-level confidence label from session-average
    feature values. Returns "High Confidence" / "Moderate Confidence" /
    "Low Confidence", or "NOT_AVAILABLE" if inputs are missing (e.g. a
    text-only session with no visual/voice data to classify).
    """
    if visual_confidence_score is None or filler_word_count is None:
        return "NOT_AVAILABLE"

    model = load_model()
    input_df = pd.DataFrame([{
        "visual_confidence_score": visual_confidence_score,
        "filler_word_count": filler_word_count,
        "long_pause_count": long_pause_count,
        "pitch_variation": pitch_variation,
    }])
    return model.predict(input_df)[0]


def calibrate_with_real_data(real_data_rows: list) -> dict:
    """
    Pilot-study support function: once real session data exists, check
    how well the synthetic-trained model's predictions match students'
    self-reported confidence, and report the agreement rate honestly.

    real_data_rows: list of dicts, each with the 4 feature keys plus a
    "self_reported_label" key (from the evaluation survey, converted to
    High/Moderate/Low for comparison).
    """
    model = load_model()
    df = pd.DataFrame(real_data_rows)
    predictions = model.predict(df[FEATURE_COLUMNS])
    df["model_prediction"] = predictions

    agreement = (df["model_prediction"] == df["self_reported_label"]).mean()

    return {
        "agreement_rate_with_self_report": round(agreement, 3),
        "comparison_table": df[["model_prediction", "self_reported_label"]],
    }


if __name__ == "__main__":
    results = train_and_save_model()
    print(f"Accuracy on synthetic holdout set: {results['accuracy_on_synthetic_holdout']}")
    print()
    print("Decision Tree structure (this is what makes it 'explainable'):")
    print(results["tree_structure"])
    print()
    # Manual prediction test
    print("Test prediction (good scores):",
          predict_confidence_level(85, 2, 0, 25))
    print("Test prediction (poor scores):",
          predict_confidence_level(35, 12, 2, 8))