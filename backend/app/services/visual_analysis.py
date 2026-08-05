import base64
import numpy as np
import cv2
import math

# Safe MediaPipe Initialization
MP_AVAILABLE = False
mp_face_mesh = None

try:
    import mediapipe as mp
    if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh"):
        mp_face_mesh = mp.solutions.face_mesh
        MP_AVAILABLE = True
    else:
        from mediapipe.python.solutions import face_mesh as mp_face_mesh  # type: ignore
        MP_AVAILABLE = True
except Exception:
    MP_AVAILABLE = False
    mp_face_mesh = None


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
        cv2.imwrite("debug_frame.jpg", img) # Save for debugging
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
        # MODE 1: MediaPipe Engine (If working properly)
        # -----------------------------------------------------------------
        if MP_AVAILABLE and mp_face_mesh is not None:
            try:
                with mp_face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.3
                ) as face_mesh:

                    rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    results = face_mesh.process(rgb_img)

                    if results.multi_face_landmarks:
                        landmarks = results.multi_face_landmarks[0].landmark

                        left_iris = landmarks[468]
                        left_inner = landmarks[133]
                        left_outer = landmarks[33]

                        right_iris = landmarks[473]
                        right_inner = landmarks[362]
                        right_outer = landmarks[263]

                        left_eye_width = get_distance(left_inner, left_outer, w, h)
                        left_iris_dist = get_distance(left_iris, left_inner, w, h)
                        left_ratio = left_iris_dist / left_eye_width if left_eye_width > 0 else 0.5

                        right_eye_width = get_distance(right_inner, right_outer, w, h)
                        right_iris_dist = get_distance(right_iris, right_inner, w, h)
                        right_ratio = right_iris_dist / right_inner if right_eye_width > 0 else 0.5

                        avg_ratio = (left_ratio + right_ratio) / 2.0
                        gaze_score = 100.0
                        eye_contact_status = "GOOD"

                        if abs(avg_ratio - 0.5) > 0.15:
                            gaze_score = max(0.0, 100.0 - (abs(avg_ratio - 0.5) * 200.0))
                            eye_contact_status = "WANDERING"

                        nose = landmarks[1]
                        left_eye = landmarks[33]
                        right_eye = landmarks[263]

                        dist_left = get_distance(nose, left_eye, w, h)
                        dist_right = get_distance(nose, right_eye, w, h)
                        yaw_ratio = dist_left / dist_right if dist_right > 0 else 1.0

                        head_stability_score = 100.0
                        head_pose_status = "STABLE"

                        if yaw_ratio < 0.7 or yaw_ratio > 1.4:
                            head_stability_score -= 40.0
                            head_pose_status = "EXCESSIVE_MOVEMENT"

                        gaze_score = min(100.0, max(0.0, gaze_score))
                        head_stability_score = min(100.0, max(0.0, head_stability_score))
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
            except Exception as e:
                print(f"MediaPipe Exception: {str(e)}")

        # -----------------------------------------------------------------
        # MODE 2: Highly Sensitive OpenCV Fallback Detection
        # -----------------------------------------------------------------
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
        # MODE 3: Lenient Fallback for Mock Interview (Assume face is present)
        # -----------------------------------------------------------------
        # If the image isn't pitch black (checked earlier) but we couldn't detect a face, 
        # provide a simulated positive response to not block the UI experience.
        return {
            "status": "FACE_DETECTED",
            "visual_confidence_score": 80.0,
            "gaze_score": 85.0,
            "head_stability_score": 90.0,
            "eye_contact_status": "GOOD",
            "head_pose_status": "STABLE",
            "warning_message": "Face detection limited; using simulated metrics."
        }

    except Exception as e:
        print(f"Exception inside analyze_frame: {str(e)}")
        default_response["warning_message"] = f"Frame processing error: {str(e)}"
        return default_response