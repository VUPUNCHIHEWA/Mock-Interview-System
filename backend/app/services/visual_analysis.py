import base64
import os
import urllib.request
import numpy as np
import cv2
import math
import threading

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
        # Gives a 3D head-rotation matrix per face -> real yaw/pitch/roll
        # angles for the Head Pose score (see head_pose_from_matrix).
        output_facial_transformation_matrixes=True,
        # Blink detection (eyeBlinkLeft/Right): iris position is unreliable
        # while the eyes are closed, so such frames are skipped for Eye Contact.
        output_face_blendshapes=True,
    )
    _face_landmarker = mp_vision.FaceLandmarker.create_from_options(_landmarker_options)
    MP_AVAILABLE = True
    print("✅ MediaPipe FaceLandmarker (Tasks API) initialized successfully.")
except Exception as e:
    print(f"⚠️ MediaPipe Tasks API initialization failed: {e}")
    MP_AVAILABLE = False
    _face_landmarker = None


# MediaPipe's FaceLandmarker and OpenCV's CascadeClassifier objects are not
# safe to use from several threads at once. analyze_frame() now runs in a
# worker thread (see routers/interview.py), so one frame is analysed at a
# time behind this lock.
_analysis_lock = threading.Lock()

# Haar cascades for the MODE 2 fallback - loaded ONCE here instead of being
# re-loaded from disk on every fallback frame (that reload made each frame
# slowest exactly when the user looks away and MediaPipe loses the face).
_face_cascade = None
_profile_cascade = None
_eye_cascade = None
if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data'):
    _face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    _profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    _eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')


# ---------------------------------------------------------------------------
# Head Pose scoring (fixed: real 3D head angles, graded score)
# ---------------------------------------------------------------------------
# The old rule used a 2D "nose-to-eye distance ratio" with one cut-off
# (0.7-1.4) and a fixed 40-point penalty, so each frame scored only 100 or
# 60. Tested on real face photos it was unreliable (a 19 deg turn could
# score 100 while a 14 deg turn scored 60), it ignored looking up/down
# completely, and a whole interview with the head turned could still score
# ~90%. Now MediaPipe's facial transformation matrix gives the real head
# angles (yaw = left/right turn, pitch = up/down, roll = tilt), and each
# frame gets a graded 0-100 score.
#
# --- ASSUMPTION - not literature-derived --- the tolerance / zero-score
# angles below are researcher-set values (pitch and roll have a larger
# tolerance because a laptop camera sits above the screen, so a student
# reading the screen naturally looks slightly down). They should be
# calibrated with pilot-session data.
HEAD_YAW_TOLERANCE_DEG = 10.0     # left/right turn up to this = full marks
HEAD_YAW_ZERO_DEG = 30.0          # turn of this much (or more) = 0
HEAD_PITCH_TOLERANCE_DEG = 15.0   # up/down
HEAD_PITCH_ZERO_DEG = 35.0
HEAD_ROLL_TOLERANCE_DEG = 15.0    # sideways tilt
HEAD_ROLL_ZERO_DEG = 35.0


def head_angles_from_matrix(matrix):
    """(yaw, pitch, roll) in degrees from MediaPipe's 4x4 facial
    transformation matrix (rotation part)."""
    R = np.array(matrix, dtype=float)[:3, :3]
    pitch = math.degrees(math.atan2(R[2, 1], R[2, 2]))
    yaw = math.degrees(math.atan2(-R[2, 0], math.hypot(R[2, 1], R[2, 2])))
    roll = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    return yaw, pitch, roll


def _axis_penalty(angle, tolerance, zero_at):
    """0 inside the tolerance, rising linearly to 1 at zero_at."""
    excess = abs(angle) - tolerance
    if excess <= 0:
        return 0.0
    return min(1.0, excess / (zero_at - tolerance))


def head_pose_score(yaw, pitch, roll):
    """Graded Head Pose score for ONE frame: 100 = facing the camera,
    0 = clearly turned away. The worst of the three axes decides."""
    worst = max(
        _axis_penalty(yaw, HEAD_YAW_TOLERANCE_DEG, HEAD_YAW_ZERO_DEG),
        _axis_penalty(pitch, HEAD_PITCH_TOLERANCE_DEG, HEAD_PITCH_ZERO_DEG),
        _axis_penalty(roll, HEAD_ROLL_TOLERANCE_DEG, HEAD_ROLL_ZERO_DEG),
    )
    return round(100.0 * (1.0 - worst), 1)


# ---------------------------------------------------------------------------
# Eye Contact scoring (fixed: real gaze direction = head angle + eye angle)
# ---------------------------------------------------------------------------
# The old rule measured how far each iris sat from the middle of its eye
# (with a 0.06 cut-off and "100 - deviation x 400"). Problems found:
#   * looking away only moved the iris ~0.1, so the score stayed ~60%
#     (a whole interview without looking at the camera still gave 59%);
#   * the up/down part divided by eyelid opening, so squinting/blinking
#     changed the score; a blink gave 0;
#   * a person who turns the head but keeps the eyes on the camera (normal)
#     was marked as "wandering".
# Now: where the person is actually looking = head angle (MediaPipe matrix)
# + eye-in-head angle (iris offset along / across the eye-corner line,
# relative to eye width). This combined gaze angle away from the camera is
# turned into a graded 0-100 score. Blink frames are skipped.
#
# Calibrated on 15 real face photos of people looking at the camera: with
# GAZE_DEG_PER_IRIS_UNIT = 213 the head and eye angles cancel out (head yaw
# spread 11.8 deg -> combined gaze spread 5.0 deg). The same factor is used
# up/down (the eyeball rotates the same way; the photos had too little
# up/down eye movement to fit it separately).
#
# --- ASSUMPTION - not literature-derived --- tolerance / zero angles,
# neutral iris height and the blink cut-off are researcher-set values.
GAZE_DEG_PER_IRIS_UNIT = 213.0      # degrees of eye rotation per 1.0 iris offset (x eye width)
GAZE_NEUTRAL_IRIS_V = -0.076        # iris sits slightly above the corner line when looking straight
GAZE_TOLERANCE_DEG = 10.0           # gaze within 10 deg of the camera = full marks
GAZE_ZERO_DEG = 25.0                # 25 deg or more away from the camera = 0
GAZE_MAX_BASELINE_DEG = 15.0        # personal calibration offset is capped at this
BLINK_THRESHOLD = 0.5               # eyeBlink blendshape above this = eyes closed


def _iris_offset(landmarks, iris_idx, corner_a, corner_b, w, h):
    """Iris position relative to the eye centre, as a fraction of eye width:
    (along the eye-corner line, across it). +along = image right, +across = down."""
    pa = np.array([landmarks[corner_a].x * w, landmarks[corner_a].y * h])
    pb = np.array([landmarks[corner_b].x * w, landmarks[corner_b].y * h])
    if pa[0] > pb[0]:
        pa, pb = pb, pa
    axis = pb - pa
    width = float(np.linalg.norm(axis))
    if width <= 0:
        return 0.0, GAZE_NEUTRAL_IRIS_V
    u = axis / width
    v = np.array([-u[1], u[0]])
    rel = np.array([landmarks[iris_idx].x * w, landmarks[iris_idx].y * h]) - (pa + pb) / 2
    return float(rel @ u / width), float(rel @ v / width)


def gaze_angles(landmarks, head_yaw, head_pitch, w, h):
    """Combined gaze direction in degrees (yaw = left/right, pitch = up/down),
    0,0 = looking straight at the camera."""
    lh, lv = _iris_offset(landmarks, 468, 33, 133, w, h)
    rh, rv = _iris_offset(landmarks, 473, 362, 263, w, h)
    iris_h = (lh + rh) / 2.0
    iris_v = (lv + rv) / 2.0
    gaze_yaw = head_yaw + GAZE_DEG_PER_IRIS_UNIT * iris_h
    gaze_pitch = head_pitch + GAZE_DEG_PER_IRIS_UNIT * (iris_v - GAZE_NEUTRAL_IRIS_V)
    return gaze_yaw, gaze_pitch


def eye_contact_score(gaze_yaw, gaze_pitch, baseline=None):
    """Graded Eye Contact for ONE frame from the gaze angle away from the
    camera (after removing the student's personal calibration offset)."""
    if baseline:
        by = max(-GAZE_MAX_BASELINE_DEG, min(GAZE_MAX_BASELINE_DEG, float(baseline.get("yaw", 0) or 0)))
        bp = max(-GAZE_MAX_BASELINE_DEG, min(GAZE_MAX_BASELINE_DEG, float(baseline.get("pitch", 0) or 0)))
        gaze_yaw -= by
        gaze_pitch -= bp
    off_camera = math.hypot(gaze_yaw, gaze_pitch)
    excess = off_camera - GAZE_TOLERANCE_DEG
    if excess <= 0:
        return 100.0, off_camera
    return round(100.0 * max(0.0, 1.0 - excess / (GAZE_ZERO_DEG - GAZE_TOLERANCE_DEG)), 1), off_camera


def calibrated_gaze(gaze_yaw, gaze_pitch, baseline=None):
    """Gaze angles after removing the personal calibration offset."""
    if baseline:
        gaze_yaw -= max(-GAZE_MAX_BASELINE_DEG, min(GAZE_MAX_BASELINE_DEG, float(baseline.get("yaw", 0) or 0)))
        gaze_pitch -= max(-GAZE_MAX_BASELINE_DEG, min(GAZE_MAX_BASELINE_DEG, float(baseline.get("pitch", 0) or 0)))
    return gaze_yaw, gaze_pitch


# ---------------------------------------------------------------------------
# Live coaching: what the student should do RIGHT NOW to get 100.
# ---------------------------------------------------------------------------
# Directions are given from the STUDENT's point of view. Frames reach the
# server un-mirrored, so (verified on photos) positive yaw = face/eyes
# pointing to the image right = the student's own LEFT; positive pitch =
# looking DOWN. Only shown when that factor is below 100 in this frame.
def coaching_codes(yaw, pitch, roll, head_score, gaze_yaw_cal, gaze_pitch_cal, gaze_score):
    codes = []
    if head_score is not None and head_score < 100:
        # The axis that is furthest past its tolerance decides the hint.
        excess = {
            "yaw": abs(yaw) - HEAD_YAW_TOLERANCE_DEG,
            "pitch": abs(pitch) - HEAD_PITCH_TOLERANCE_DEG,
            "roll": abs(roll) - HEAD_ROLL_TOLERANCE_DEG,
        }
        worst = max(excess, key=excess.get)
        if worst == "yaw":
            codes.append("HEAD_TURN_RIGHT" if yaw > 0 else "HEAD_TURN_LEFT")
        elif worst == "pitch":
            codes.append("HEAD_CHIN_UP" if pitch > 0 else "HEAD_CHIN_DOWN")
        else:
            codes.append("HEAD_STRAIGHTEN")
    if gaze_score is not None and gaze_score < 100:
        if abs(gaze_pitch_cal) >= abs(gaze_yaw_cal):
            codes.append("EYES_UP" if gaze_pitch_cal > 0 else "EYES_DOWN")
        else:
            codes.append("EYES_RIGHT" if gaze_yaw_cal > 0 else "EYES_LEFT")
    return codes


def get_distance(p1, p2, width, height):
    """Calculates Euclidean distance converting normalized landmarks to pixel coordinates."""
    x1, y1 = p1.x * width, p1.y * height
    x2, y2 = p2.x * width, p2.y * height
    return math.sqrt((x1 - x2)**2 + (y1 - y2)**2)


# ---------------------------------------------------------------------------
# Frames where the face is NOT visible (fixed)
# ---------------------------------------------------------------------------
# Frames are only sent while the student is recording an answer. If the
# camera works but no face can be seen (face hidden, looking far down at a
# paper, turned away, camera covered / too dark), the frame now scores 0 for
# Eye Contact, Head Pose and Visual Confidence. Before, such frames were
# left out of the average, so hiding the face could AVOID a low visual
# score (or make it N/A). Only true technical failures (a frame that cannot
# be decoded / processed) are still left out - status "ERROR".
#
# --- ASSUMPTION - not literature-derived --- treating "face not visible
# while answering" as 0 assumes the camera and lighting are adequate; the
# student is warned live (panel warning + orange camera border) so a
# detection problem can be fixed during the interview.
def _no_face_result(message):
    return {
        "status": "NO_FACE_DETECTED",
        "face_visible": False,
        "visual_confidence_score": 0.0,
        "gaze_score": 0.0,
        "head_stability_score": 0.0,
        "eye_contact_status": "UNKNOWN",
        "head_pose_status": "UNKNOWN",
        "warning_message": message,
    }


def _error_result(message):
    return {
        "status": "ERROR",
        "face_visible": None,
        "visual_confidence_score": None,
        "gaze_score": None,
        "head_stability_score": None,
        "eye_contact_status": "UNKNOWN",
        "head_pose_status": "UNKNOWN",
        "warning_message": message,
    }


def analyze_frame(image_base64: str, session_id: str, gaze_baseline=None):
    """gaze_baseline: optional {"yaw": deg, "pitch": deg} measured during the
    pre-interview camera check while the student looked at the camera."""
    with _analysis_lock:
        return _analyze_frame_impl(image_base64, session_id, gaze_baseline)


def _analyze_frame_impl(image_base64: str, session_id: str, gaze_baseline=None):
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
            return _error_result("Failed to decode base64 image frame.")

        h, w, _ = img.shape
        print(f"Image decoded successfully. Shape: {img.shape}")
        # Privacy: the camera frame is analysed in memory only. It used to be
        # saved to disk as "debug_frame.jpg" on every frame - that has been removed.
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 2. Darkness & Occlusion Check
        if np.mean(gray) < 15:
            return _no_face_result("Camera is covered or environment is too dark.")

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

                    # --- Head Pose: real 3D angles -> graded score ---
                    matrices = getattr(detection_result, "facial_transformation_matrixes", None)
                    if matrices:
                        yaw, pitch, roll = head_angles_from_matrix(matrices[0])
                        head_stability_score = head_pose_score(yaw, pitch, roll)
                        # "Turned away" (used by eye contact below): left/right
                        # or up/down beyond tolerance. Tilt alone does not
                        # break eye contact.
                        head_turned = (abs(yaw) > HEAD_YAW_TOLERANCE_DEG
                                       or abs(pitch) > HEAD_PITCH_TOLERANCE_DEG)
                        out_of_range = head_turned or abs(roll) > HEAD_ROLL_TOLERANCE_DEG
                        print(f"🔍 DEBUG head angles: yaw={yaw:.1f} pitch={pitch:.1f} "
                              f"roll={roll:.1f} -> head pose {head_stability_score}")
                    else:
                        # Fallback (very old MediaPipe without matrices):
                        # previous 2D nose-to-eye ratio rule.
                        nose = landmarks[1]
                        dist_left = get_distance(nose, landmarks[33], w, h)
                        dist_right = get_distance(nose, landmarks[263], w, h)
                        yaw_ratio = dist_left / dist_right if dist_right > 0 else 1.0
                        head_turned = yaw_ratio < 0.7 or yaw_ratio > 1.4
                        out_of_range = head_turned
                        head_stability_score = 60.0 if head_turned else 100.0

                    head_pose_status = "EXCESSIVE_MOVEMENT" if out_of_range else "STABLE"

                    # --- Eye Contact: real gaze direction -> graded score ---
                    gaze_yaw_raw = gaze_pitch_raw = None
                    blendshapes = getattr(detection_result, "face_blendshapes", None)
                    blink = 0.0
                    if blendshapes:
                        scores = {c.category_name: c.score for c in blendshapes[0]}
                        blink = (scores.get("eyeBlinkLeft", 0.0) + scores.get("eyeBlinkRight", 0.0)) / 2.0
                    gaze_yaw_cal = gaze_pitch_cal = 0.0
                    if matrices and blink <= BLINK_THRESHOLD:
                        gaze_yaw_raw, gaze_pitch_raw = gaze_angles(landmarks, yaw, pitch, w, h)
                        gaze_score, off_camera = eye_contact_score(gaze_yaw_raw, gaze_pitch_raw, gaze_baseline)
                        gaze_yaw_cal, gaze_pitch_cal = calibrated_gaze(gaze_yaw_raw, gaze_pitch_raw, gaze_baseline)
                        eye_contact_status = "GOOD" if off_camera <= GAZE_TOLERANCE_DEG else "WANDERING"
                        print(f"🔍 DEBUG gaze: yaw={gaze_yaw_raw:.1f} pitch={gaze_pitch_raw:.1f} "
                              f"off-camera={off_camera:.1f} deg -> eye contact {gaze_score}")
                    else:
                        # Eyes closed (blink) or no head angles: gaze cannot be
                        # measured in this frame -> Eye Contact unknown (skipped).
                        gaze_score = None
                        eye_contact_status = "UNKNOWN"

                    head_stability_score = min(100.0, max(0.0, head_stability_score))
                    # --- ASSUMPTION - not literature-derived --- these
                    # 0.6/0.4 weights (gaze vs head-stability) are a
                    # pre-existing design decision carried over from the
                    # original implementation, not sourced from a specific
                    # paper. General approach (MediaPipe landmarks -> gaze +
                    # head-pose -> confidence score) follows arXiv 2506.09153.
                    if gaze_score is None:
                        vci = head_stability_score  # blink frame -> head pose only
                    else:
                        vci = (0.6 * gaze_score) + (0.4 * head_stability_score)

                    return {
                        "status": "FACE_DETECTED",
                        "face_visible": True,
                        "visual_confidence_score": round(vci, 1),
                        "gaze_score": round(gaze_score, 1) if gaze_score is not None else None,
                        "head_stability_score": round(head_stability_score, 1),
                        # Raw (uncalibrated) gaze angles - used by the camera
                        # check to calibrate each student's "looking at camera".
                        "gaze_yaw": round(gaze_yaw_raw, 1) if gaze_yaw_raw is not None else None,
                        "gaze_pitch": round(gaze_pitch_raw, 1) if gaze_pitch_raw is not None else None,
                        # What to do right now to keep Head Pose / Eye Contact at 100.
                        "coaching": coaching_codes(yaw, pitch, roll, head_stability_score,
                                                   gaze_yaw_cal, gaze_pitch_cal, gaze_score) if matrices else [],
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
        if _face_cascade is not None:
            face_cascade = _face_cascade
            profile_cascade = _profile_cascade
            eye_cascade = _eye_cascade

            # Optimized detection parameters (more sensitive to webcam frames)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
            
            if len(faces) == 0:
                faces = face_cascade.detectMultiScale(equalized_gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))

            # Try profile face cascade if frontal face detection missed
            found_by_profile = False
            if len(faces) == 0:
                faces = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
                found_by_profile = len(faces) > 0

            if len(faces) > 0:
                x, y, fw, fh = faces[0]
                roi_gray = equalized_gray[y:y+fh, x:x+fw]
                eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=2)

                face_center_x = x + (fw / 2)
                frame_center_x = w / 2
                offset_ratio = abs(face_center_x - frame_center_x) / frame_center_x

                # The Haar fallback cannot measure head ANGLE (the old code
                # scored where the face sat in the frame, which is not head
                # pose). A frontal-cascade face -> Head Pose unknown (left out
                # of the average, not guessed). Profile-only face -> turned.
                head_stability_score = None
                head_pose_status = "UNKNOWN"

                # The Haar fallback cannot tell WHERE the eyes look (the old
                # code gave 95 whenever eyes were visible). Frontal face ->
                # Eye Contact unknown (skipped); profile-only face -> 0 below.
                gaze_score = None
                eye_contact_status = "UNKNOWN"

                # If only the PROFILE (side-face) cascade found the face, the
                # head is turned away from the camera. Previously this still
                # reported "GOOD"/"STABLE" when eyes were visible, which made
                # looking away show up late on the live bar.
                if found_by_profile:
                    head_stability_score = 0.0
                    head_pose_status = "EXCESSIVE_MOVEMENT"
                    gaze_score = 0.0
                    eye_contact_status = "WANDERING"

                if head_stability_score is None or gaze_score is None:
                    vci = None  # nothing measurable in this frame (left out)
                else:
                    vci = (0.6 * gaze_score) + (0.4 * head_stability_score)

                return {
                    "status": "FACE_DETECTED",
                    "face_visible": True,
                    "visual_confidence_score": round(vci, 1) if vci is not None else None,
                    "gaze_score": round(gaze_score, 1) if gaze_score is not None else None,
                    "head_stability_score": round(head_stability_score, 1) if head_stability_score is not None else None,
                    "coaching": ["FACE_CAMERA"] if found_by_profile else [],
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
        # removed. Frames where no face can be detected report
        # NO_FACE_DETECTED and score 0 (face not visible while answering -
        # see _no_face_result above); the student is warned live so they
        # can reposition / improve lighting.
        # -----------------------------------------------------------------
        return _no_face_result("No face could be detected in this frame. "
                               "Please check your lighting and camera position.")

    except Exception as e:
        print(f"Exception inside analyze_frame: {str(e)}")
        return _error_result(f"Frame processing error: {str(e)}")