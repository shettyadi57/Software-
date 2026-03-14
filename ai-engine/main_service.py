"""
AEGIS AI Engine - Face, Voice & Behavior Detection Microservice
Runs alongside the FastAPI backend to provide additional analysis.
Optionally used; the extension also has built-in lightweight detection.
"""
import asyncio
import base64
import io
import json
import logging
import time
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Optional heavy imports — gracefully degrade if not installed
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logging.warning("OpenCV not available — using fallback detection")

try:
    import mediapipe as mp
    MP_AVAILABLE = True
    mp_face_mesh = mp.solutions.face_mesh
    mp_face_detection = mp.solutions.face_detection
except ImportError:
    MP_AVAILABLE = False
    logging.warning("MediaPipe not available — using OpenCV fallback")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [AI] %(message)s")
logger = logging.getLogger("aegis-ai")

app = FastAPI(title="AEGIS AI Engine", version="4.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Models ────────────────────────────────────────────────────────────────────
class FrameRequest(BaseModel):
    image_data: str          # base64 JPEG/PNG
    session_id: Optional[str] = None
    timestamp: Optional[float] = None

class FrameResponse(BaseModel):
    face_count: int
    looking_away: bool
    head_pose: dict
    phone_suspected: bool
    attention_score: float
    confidence: float
    processing_ms: float

class AudioRequest(BaseModel):
    audio_rms: float
    frequency_data: Optional[list] = None
    session_id: Optional[str] = None

# ── Face detector (with fallback) ─────────────────────────────────────────────
if CV2_AVAILABLE:
    # Use Haar cascade as reliable fallback
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

if MP_AVAILABLE:
    face_detection_model = mp_face_detection.FaceDetection(
        model_selection=0, min_detection_confidence=0.5
    )
    face_mesh_model = mp_face_mesh.FaceMesh(
        max_num_faces=5,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

def decode_frame(image_data: str) -> Optional[np.ndarray]:
    """Decode base64 image to numpy array."""
    try:
        # Strip data URI prefix if present
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
        img_bytes = base64.b64decode(image_data)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        if CV2_AVAILABLE:
            return cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        else:
            from PIL import Image
            img = Image.open(io.BytesIO(img_bytes))
            return np.array(img)
    except Exception as e:
        logger.error(f"Frame decode error: {e}")
        return None

def detect_faces_opencv(frame: np.ndarray) -> int:
    """Haar cascade face detection."""
    if not CV2_AVAILABLE:
        return -1
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return len(faces)

def detect_faces_mediapipe(frame: np.ndarray) -> dict:
    """MediaPipe face detection + pose estimation."""
    result = {"face_count": 0, "looking_away": False, "head_pose": {}, "phone_suspected": False}
    if not MP_AVAILABLE or not CV2_AVAILABLE:
        return result

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    det_results = face_detection_model.process(rgb)

    if det_results.detections:
        result["face_count"] = len(det_results.detections)

    if result["face_count"] == 1:
        mesh_results = face_mesh_model.process(rgb)
        if mesh_results.multi_face_landmarks:
            landmarks = mesh_results.multi_face_landmarks[0].landmark
            # Simplified head pose from nose tip and face boundary
            nose = landmarks[1]
            left_ear = landmarks[234]
            right_ear = landmarks[454]
            chin = landmarks[152]
            forehead = landmarks[10]

            h, w = frame.shape[:2]
            # Yaw (left-right head turn)
            yaw = abs(nose.x - 0.5) * 2  # 0 = center, 1 = fully turned
            # Pitch (up-down)
            pitch = abs(nose.y - 0.5) * 2

            result["looking_away"] = yaw > 0.3 or pitch > 0.3
            result["head_pose"] = {
                "yaw": round(yaw, 3),
                "pitch": round(pitch, 3),
                "centered": not result["looking_away"],
            }

    return result

def estimate_attention(face_count: int, looking_away: bool, head_pose: dict) -> float:
    """Calculate attention score 0–100 from face data."""
    if face_count == 0:
        return 10.0
    if face_count > 1:
        return 30.0
    if looking_away:
        yaw = head_pose.get("yaw", 0)
        pitch = head_pose.get("pitch", 0)
        deviation = max(yaw, pitch)
        return max(20, 100 - (deviation * 150))
    return 95.0

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "opencv": CV2_AVAILABLE,
        "mediapipe": MP_AVAILABLE,
        "timestamp": time.time(),
    }

@app.post("/analyze/frame", response_model=FrameResponse)
async def analyze_frame(req: FrameRequest):
    t0 = time.time()
    frame = decode_frame(req.image_data)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    if MP_AVAILABLE:
        result = detect_faces_mediapipe(frame)
        face_count = result["face_count"]
        looking_away = result["looking_away"]
        head_pose = result["head_pose"]
    elif CV2_AVAILABLE:
        face_count = detect_faces_opencv(frame)
        looking_away = False
        head_pose = {}
    else:
        face_count = 1  # Assume OK if no detection available
        looking_away = False
        head_pose = {}

    # Simple phone detection: look for rectangular bright object in lower frame area
    phone_suspected = False
    if CV2_AVAILABLE and frame is not None:
        lower = frame[frame.shape[0] // 2:, :]
        gray = cv2.cvtColor(lower, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect = w / max(h, 1)
            area = w * h
            if 1500 < area < 30000 and 0.4 < aspect < 0.65:
                phone_suspected = True
                break

    attention = estimate_attention(face_count, looking_away, head_pose)
    ms = (time.time() - t0) * 1000

    logger.info(f"Frame analyzed: faces={face_count} away={looking_away} attn={attention:.0f} phone={phone_suspected} {ms:.0f}ms")

    return FrameResponse(
        face_count=face_count,
        looking_away=looking_away,
        head_pose=head_pose,
        phone_suspected=phone_suspected,
        attention_score=attention,
        confidence=0.85 if (MP_AVAILABLE or CV2_AVAILABLE) else 0.5,
        processing_ms=round(ms, 1),
    )

@app.post("/analyze/audio")
async def analyze_audio(req: AudioRequest):
    """Classify audio level as speech, silence, or background noise."""
    rms = req.audio_rms
    if rms < 5:
        label = "silence"
    elif rms < 15:
        label = "background_noise"
    elif rms < 40:
        label = "possible_speech"
    else:
        label = "speech_detected"

    return {
        "rms": rms,
        "label": label,
        "is_speech": rms >= 25,
        "confidence": min(1.0, rms / 50),
    }

if __name__ == "__main__":
    logger.info(f"Starting AI engine (OpenCV={CV2_AVAILABLE}, MediaPipe={MP_AVAILABLE})")
    uvicorn.run("main_service:app", host="0.0.0.0", port=8001, reload=False)
