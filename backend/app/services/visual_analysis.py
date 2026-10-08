import base64
import os
import urllib.request
import numpy as np
import cv2
import math

# -----------------------------------------------------------------------
# MediaPipe Initialization (Tasks API - BSc Research Feature, Step 2 fix)
# -----------------------------------------------------------------------
# NOTE: MediaPipe's legacy "Solutions" API (mp.solutions.face_mesh) was
# REMOVED in mediapipe >= 0.10.30 (confirmed during debugging - the
# original code's try/except silently caught this and fell back to a
# weaker OpenCV Haar Cascade detector, causing frequent false
# NO_FACE_DETECTED results). This has been migrated to MediaPipe's
# current "Tasks" API (FaceLandmarker), which requires a downloadable
# model file - auto-downloaded on first run if not already present.
MP_AVAILABLE = False
_face_landmarker = None

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")
_MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
              "face_landmarker/float16/1/face_landmarker.task")


def _ensure_model_downloaded():
    if not os.path.exists(_MODEL_PATH):
        print(f"⬇️ Downloading MediaPipe face_landmarker model (one-time setup)...")
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        print(f"✅ Model saved to {_MODEL_PATH}")


try:
    import mediapipe as mp
    from mediapipe.tasks.python import vision as mp_vision
    from mediapipe.tasks.python import BaseOptions

    _ensure_model_downloaded()

    _base_options = BaseOptions(model_asset_path=_MODEL_PATH)
    _landmarker_options = mp_vision.FaceLandmarkerOptions(
        base_options=_base_options,
        running_mode=mp_vision.RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.3,
    )
    _face_landmarker = mp_vision.FaceLandmarker.create_from_options(_landmarker_options)
    MP_AVAILABLE = True
    print("✅ MediaPipe FaceLandmarker (Tasks API) initialized successfully.")
except Exception as e:
    print(f"⚠️ MediaPipe Tasks API initialization failed: {e}")
    MP_AVAILABLE = False
    _face_landmarker = None


def get_distance(p1, p2, width, height):
    """Calculates Euclidean distance converting normalized landmarks to pixel coordinates."""
    x1, y1 = p1.x * width, p1.y * height
    x2, y2 = p2.x * width, p2.y * height
    return math.sqrt((x1 - x2)**2 + (y1 - y2)**2)


def analyze_frame(image_base64: str, session_id: str):
    default_response = {
        "status": "NO_FACE_DETECTED",
        "visual_confidence_score": 0.0,
        "gaze_score": 0.0,
        "head_stability_score": 0.0,
        "eye_contact_status": "UNKNOWN",
        "head_pose_status": "UNKNOWN",
        "warning_message": "No face detected in the frame."
    }

    try:
        # 1. Decode base64 Image
        if "," in image_base64:
            _, encoded = image_base64.split(",", 1)
        else:
            encoded = image_base64

        image_bytes = base64.b64decode(encoded)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            default_response["warning_message"] = "Failed to decode base64 image frame."
            return default_response

        h, w, _ = img.shape
        print(f"Image decoded successfully. Shape: {img.shape}")
        # Privacy: the camera frame is analysed in memory only. It used to be
        # saved to disk as "debug_frame.jpg" on every frame - that has been removed.
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 2. Darkness & Occlusion Check
        if np.mean(gray) < 15:
            return {
                "status": "NO_FACE_DETECTED",
                "visual_confidence_score": 0.0,
                "gaze_score": 0.0,
                "head_stability_score": 0.0,
                "eye_contact_status": "UNKNOWN",
                "head_pose_status": "UNKNOWN",
                "warning_message": "Camera is covered or environment is too dark."
            }

        # Histogram Equalization to improve contrast for webcam lighting
        equalized_gray = cv2.equalizeHist(gray)

        # -----------------------------------------------------------------
        # MODE 1: MediaPipe Tasks API (FaceLandmarker) - primary engine
        # -----------------------------------------------------------------
        if MP_AVAILABLE and _face_landmarker is not None:
            try:
                rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
                detection_result = _face_landmarker.detect(mp_image)

                if detection_result.face_landmarks:
                    landmarks = detection_result.face_landmarks[0]

                    left_iris = landmarks[468]
                    left_inner = landmarks[133]
                    left_outer = landmarks[33]
                    left_top = landmarks[159]
                    left_bottom = landmarks[145]

                    right_iris = landmarks[473]
                    right_inner = landmarks[362]
                    right_outer = landmarks[263]
                    right_top = landmarks[386]
                    right_bottom = landmarks[374]

                    # Horizontal ratios
                    left_eye_width = get_distance(left_inner, left_outer, w, h)
                    left_iris_h_dist = get_distance(left_iris, left_inner, w, h)
                    left_h_ratio = left_iris_h_dist / left_eye_width if left_eye_width > 0 else 0.5

                    right_eye_width = get_distance(right_inner, right_outer, w, h)
                    right_iris_h_dist = get_distance(right_iris, right_inner, w, h)
                    right_h_ratio = right_iris_h_dist / right_eye_width if right_eye_width > 0 else 0.5

                    # Vertical ratios
                    left_eye_height = get_distance(left_top, left_bottom, w, h)
                    left_iris_v_dist = get_distance(left_iris, left_top, w, h)
                    left_v_ratio = left_iris_v_dist / left_eye_height if left_eye_height > 0 else 0.5

                    right_eye_height = get_distance(right_top, right_bottom, w, h)
                    right_iris_v_dist = get_distance(right_iris, right_top, w, h)
                    right_v_ratio = right_iris_v_dist / right_eye_height if right_eye_height > 0 else 0.5

                    # Calculate deviations from center
                    left_h_deviation = abs(left_h_ratio - 0.5)
                    right_h_deviation = abs(right_h_ratio - 0.5)
                    left_v_deviation = abs(left_v_ratio - 0.5)
                    right_v_deviation = abs(right_v_ratio - 0.5)

                    avg_h_deviation = (left_h_deviation + right_h_deviation) / 2.0
                    avg_v_deviation = (left_v_deviation + right_v_deviation) / 2.0
                    
                    # Total gaze deviation combining horizontal and vertical shifts
                    avg_deviation = max(avg_h_deviation, avg_v_deviation)

                    print(f"🔍 DEBUG avg_deviation: {avg_deviation:.4f}  "
                          f"(h_dev={avg_h_deviation:.4f}, v_dev={avg_v_deviation:.4f})")

                    nose = landmarks[1]
                    left_eye = landmarks[33]
                    right_eye = landmarks[263]

                    dist_left = get_distance(nose, left_eye, w, h)
                    dist_right = get_distance(nose, right_eye, w, h)
                    yaw_ratio = dist_left / dist_right if dist_right > 0 else 1.0

                    print(f"🔍 DEBUG yaw_ratio: {yaw_ratio:.4f}  "
                          f"(dist_left={dist_left:.1f}, dist_right={dist_right:.1f})")

                    head_stability_score = 100.0
                    head_pose_status = "STABLE"
                    head_turned = False

                    if yaw_ratio < 0.7 or yaw_ratio > 1.4:
                        head_stability_score -= 40.0
                        head_pose_status = "EXCESSIVE_MOVEMENT"
                        head_turned = True

                    # BUG FIX (Step 2, round 3): "eye contact" conceptually
                    # requires BOTH the eyes to be centered in their
                    # sockets (gaze) AND the head/face to be oriented
                    # toward the camera (head pose). The original code
                    # determined eye_contact_status from gaze alone, which
                    # missed cases where the whole head turns away while
                    # the eyes stay centered within their sockets (natural
                    # head+eye coordination) - confirmed via debug logging
                    # (yaw_ratio=2.28, clearly turned, but avg_deviation
                    # stayed low since eyes were still centered relative
                    # to the turned head). Now combining both signals.
                    gaze_score = 100.0
                    eye_contact_status = "GOOD"

                    # A natural center gaze might have slight deviations (~0.02 - 0.05).
                    # A threshold of 0.06 is sensitive enough to catch independent eye glances.
                    if avg_deviation > 0.06 or head_turned:
                        # Scale the penalty so that a 0.1 deviation removes ~40 points
                        gaze_penalty = avg_deviation * 400.0
                        gaze_score = max(0.0, 100.0 - gaze_penalty)
                        eye_contact_status = "WANDERING"

                    gaze_score = min(100.0, max(0.0, gaze_score))
                    head_stability_score = min(100.0, max(0.0, head_stability_score))
                    # --- ASSUMPTION - not literature-derived --- these
                    # 0.6/0.4 weights (gaze vs head-stability) are a
                    # pre-existing design decision carried over from the
                    # original implementation, not sourced from a specific
                    # paper. General approach (MediaPipe landmarks -> gaze +
                    # head-pose -> confidence score) follows arXiv 2506.09153.
                    vci = (0.6 * gaze_score) + (0.4 * head_stability_score)

                    return {
                        "status": "FACE_DETECTED",
                        "visual_confidence_score": round(vci, 1),
                        "gaze_score": round(gaze_score, 1),
                        "head_stability_score": round(head_stability_score, 1),
                        "eye_contact_status": eye_contact_status,
                        "head_pose_status": head_pose_status,
                        "warning_message": None
                    }
                else:
                    print("⚠️ DEBUG: MediaPipe (MODE 1) ran but "
                          "detection_result.face_landmarks was EMPTY "
                          "(landmark tracking lost) - falling through to MODE 2.")
            except Exception as e:
                print(f"MediaPipe Exception: {str(e)}")

        # -----------------------------------------------------------------
        # MODE 2: Highly Sensitive OpenCV Fallback Detection
        # -----------------------------------------------------------------
        # --- DEBUG (calibration): confirms whether MODE 1 (MediaPipe,
        # which has accurate gaze-direction detection) failed and we
        # silently fell back to this MODE 2 (which only checks "are eyes
        # visible", NOT gaze direction - see eye_contact_status logic
        # below, always "GOOD" if any eyes detected regardless of where
        # they're looking). This is a likely explanation for why looking
        # down/sideways still shows "GOOD"/"stable" - MODE 1 may be
        # losing landmark tracking at extreme angles and silently
        # falling back to this weaker method.
        print("⚠️ DEBUG: Falling back to MODE 2 (OpenCV Haar Cascade) - "
              "MODE 1 (MediaPipe) did not return usable landmarks this frame.")
        if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data'):
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

            # Optimized detection parameters (more sensitive to webcam frames)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
            
            if len(faces) == 0:
                faces = face_cascade.detectMultiScale(equalized_gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))

            # Try profile face cascade if frontal face detection missed
            if len(faces) == 0:
                faces = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))

            if len(faces) > 0:
                x, y, fw, fh = faces[0]
                roi_gray = equalized_gray[y:y+fh, x:x+fw]
                eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=2)

                face_center_x = x + (fw / 2)
                frame_center_x = w / 2
                offset_ratio = abs(face_center_x - frame_center_x) / frame_center_x

                head_stability_score = max(60.0, 100.0 - (offset_ratio * 100.0))
                head_pose_status = "STABLE" if offset_ratio < 0.3 else "EXCESSIVE_MOVEMENT"

                gaze_score = 95.0 if len(eyes) >= 1 else 75.0
                eye_contact_status = "GOOD" if len(eyes) >= 1 else "WANDERING"

                vci = (0.6 * gaze_score) + (0.4 * head_stability_score)

                return {
                    "status": "FACE_DETECTED",
                    "visual_confidence_score": round(vci, 1),
                    "gaze_score": round(gaze_score, 1),
                    "head_stability_score": round(head_stability_score, 1),
                    "eye_contact_status": eye_contact_status,
                    "head_pose_status": head_pose_status,
                    "warning_message": None
                }

        # -----------------------------------------------------------------
        # MODE 3 (REMOVED - BSc Research Feature, Step 2):
        # The original implementation returned SIMULATED/fake metrics
        # (visual_confidence_score: 80.0 etc.) with status "FACE_DETECTED"
        # whenever real detection (MediaPipe + OpenCV Haar Cascade) failed,
        # silently mixing fake data points into recorded research data.
        # This is a serious research-validity risk (see
        # RESEARCH_DOCUMENTATION.md, Data Integrity section) and has been
        # removed. Frames where no face can be detected now correctly
        # report NO_FACE_DETECTED and are excluded from analysis - the
        # frontend should prompt the student to reposition/improve
        # lighting rather than silently recording a fabricated score.
        # -----------------------------------------------------------------
        return {
            "status": "NO_FACE_DETECTED",
            "visual_confidence_score": None,
            "gaze_score": None,
            "head_stability_score": None,
            "eye_contact_status": "UNKNOWN",
            "head_pose_status": "UNKNOWN",
            "warning_message": "No face could be detected in this frame. "
                                "Please check your lighting and camera position."
        }

    except Exception as e:
        print(f"Exception inside analyze_frame: {str(e)}")
        default_response["warning_message"] = f"Frame processing error: {str(e)}"
        return default_response