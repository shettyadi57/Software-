"""
AEGIS Backend - FastAPI Main Service
Handles WebSocket connections, REST API, and exam session management
"""
import asyncio
import base64
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import aiosqlite
import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "aegis-super-secret-key-change-in-production")
ALGORITHM = "HS256"
DB_PATH = "aegis.db"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("aegis")

app = FastAPI(title="AEGIS API", version="4.0.0")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Risk weights ─────────────────────────────────────────────────────────────
RISK_WEIGHTS = {
    "tab_switch": 10,
    "window_blur": 8,
    "copy_attempt": 15,
    "paste_attempt": 15,
    "shortcut_blocked": 12,
    "face_missing": 20,
    "multiple_faces": 50,
    "looking_away": 5,
    "voice_detected": 30,
    "screenshot_taken": 2,
    "devtools_opened": 25,
    "resolution_change": 20,
    "screen_share_detected": 40,
    "phone_detected": 35,
}

# ── In-memory state ──────────────────────────────────────────────────────────
active_connections: Dict[str, WebSocket] = {}   # session_id -> websocket
session_states: Dict[str, dict] = {}            # session_id -> live state
admin_connections: List[WebSocket] = []         # admin dashboard sockets

# ── Pydantic Models ──────────────────────────────────────────────────────────
class AdminLogin(BaseModel):
    username: str
    password: str

class CreateExam(BaseModel):
    title: str
    duration_minutes: int
    allowed_tabs: int = 1

class HeartbeatPayload(BaseModel):
    session_id: str
    student_id: str
    exam_id: str
    timestamp: float
    attention_score: Optional[float] = 100.0
    risk_score: Optional[float] = 0.0
    status: Optional[str] = "active"

class ViolationPayload(BaseModel):
    session_id: str
    student_id: str
    exam_id: str
    violation_type: str
    severity: str = "medium"
    metadata: Optional[dict] = {}
    timestamp: Optional[float] = None

class ScreenshotPayload(BaseModel):
    session_id: str
    student_id: str
    exam_id: str
    image_data: str  # base64
    timestamp: Optional[float] = None
    trigger: Optional[str] = "periodic"

# ── Database ──────────────────────────────────────────────────────────────────
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS admins (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at REAL
            );

            CREATE TABLE IF NOT EXISTS exams (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                session_code TEXT UNIQUE NOT NULL,
                duration_minutes INTEGER,
                allowed_tabs INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                created_by TEXT,
                created_at REAL,
                started_at REAL,
                ended_at REAL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                exam_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                student_name TEXT,
                status TEXT DEFAULT 'active',
                risk_score REAL DEFAULT 0,
                attention_score REAL DEFAULT 100,
                flagged INTEGER DEFAULT 0,
                started_at REAL,
                ended_at REAL,
                last_heartbeat REAL
            );

            CREATE TABLE IF NOT EXISTS violations (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                student_id TEXT,
                exam_id TEXT,
                violation_type TEXT NOT NULL,
                severity TEXT DEFAULT 'medium',
                risk_points INTEGER DEFAULT 0,
                metadata TEXT,
                timestamp REAL
            );

            CREATE TABLE IF NOT EXISTS screenshots (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                student_id TEXT,
                image_data TEXT,
                trigger TEXT DEFAULT 'periodic',
                timestamp REAL
            );
        """)
        await db.commit()
        # seed admin
        await db.execute("""
            INSERT OR IGNORE INTO admins (id, username, password_hash, created_at)
            VALUES (?, ?, ?, ?)
        """, (str(uuid.uuid4()), "admin", "aegis2024", time.time()))
        await db.commit()
    logger.info("Database initialized")

# ── Auth helpers ──────────────────────────────────────────────────────────────
def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=8),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Broadcast to admins ───────────────────────────────────────────────────────
async def broadcast_to_admins(data: dict):
    dead = []
    for ws in admin_connections:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.append(ws)
    for ws in dead:
        admin_connections.remove(ws)

# ── Risk engine ────────────────────────────────────────────────────────────────
def calculate_risk_delta(violation_type: str) -> int:
    return RISK_WEIGHTS.get(violation_type, 5)

def update_attention_score(session_id: str, violation_type: str) -> float:
    state = session_states.get(session_id, {})
    current = state.get("attention_score", 100.0)
    penalty_map = {
        "tab_switch": 3, "window_blur": 2, "face_missing": 8,
        "multiple_faces": 15, "looking_away": 2, "voice_detected": 5,
    }
    penalty = penalty_map.get(violation_type, 1)
    new_score = max(0, current - penalty)
    if session_id in session_states:
        session_states[session_id]["attention_score"] = new_score
    return new_score

# ── REST Endpoints ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.0.0", "timestamp": time.time()}

@app.post("/auth/login")
async def login(body: AdminLogin):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT username FROM admins WHERE username=? AND password_hash=?",
            (body.username, body.password)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(body.username)
    return {"token": token, "username": body.username}

@app.get("/exams")
async def get_exams(admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM exams ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]

@app.post("/exams")
async def create_exam(body: CreateExam, admin=Depends(verify_token)):
    exam_id = str(uuid.uuid4())
    code = str(uuid.uuid4())[:6].upper()
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO exams VALUES (?,?,?,?,?,?,?,?,?,?)",
            (exam_id, body.title, code, body.duration_minutes,
             body.allowed_tabs, "active", admin, now, None, None)
        )
        await db.commit()
    return {"exam_id": exam_id, "session_code": code, "title": body.title}

@app.get("/exams/{exam_id}")
async def get_exam(exam_id: str, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM exams WHERE id=?", (exam_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
    return dict(row)

@app.get("/sessions")
async def get_sessions(exam_id: Optional[str] = None, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if exam_id:
            async with db.execute(
                "SELECT * FROM sessions WHERE exam_id=? ORDER BY started_at DESC", (exam_id,)
            ) as cur:
                rows = await cur.fetchall()
        else:
            async with db.execute("SELECT * FROM sessions ORDER BY started_at DESC") as cur:
                rows = await cur.fetchall()
    return [dict(r) for r in rows]

@app.get("/sessions/{session_id}")
async def get_session(session_id: str, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(row)

@app.get("/sessions/{session_id}/violations")
async def get_violations(session_id: str, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM violations WHERE session_id=? ORDER BY timestamp ASC", (session_id,)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]

@app.get("/sessions/{session_id}/screenshots")
async def get_screenshots(session_id: str, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, session_id, student_id, trigger, timestamp FROM screenshots WHERE session_id=? ORDER BY timestamp ASC",
            (session_id,)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]

@app.get("/screenshots/{screenshot_id}/image")
async def get_screenshot_image(screenshot_id: str, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT image_data FROM screenshots WHERE id=?", (screenshot_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return {"image_data": row[0]}

@app.get("/sessions/{session_id}/report")
async def get_report(session_id: str, admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)) as cur:
            session = await cur.fetchone()
        async with db.execute(
            "SELECT * FROM violations WHERE session_id=? ORDER BY timestamp ASC", (session_id,)
        ) as cur:
            violations = await cur.fetchall()
        async with db.execute(
            "SELECT id, trigger, timestamp FROM screenshots WHERE session_id=? ORDER BY timestamp ASC",
            (session_id,)
        ) as cur:
            screenshots = await cur.fetchall()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session_dict = dict(session)
    violations_list = [dict(v) for v in violations]

    # Generate AI summary
    summary = generate_summary(session_dict, violations_list)
    risk_breakdown = {}
    for v in violations_list:
        vtype = v["violation_type"]
        risk_breakdown[vtype] = risk_breakdown.get(vtype, 0) + 1

    return {
        "session": session_dict,
        "violations": violations_list,
        "screenshots": [dict(s) for s in screenshots],
        "summary": summary,
        "risk_breakdown": risk_breakdown,
        "total_violations": len(violations_list),
    }

@app.get("/dashboard/stats")
async def dashboard_stats(admin=Depends(verify_token)):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM sessions WHERE status='active'") as cur:
            active = (await cur.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM sessions") as cur:
            total = (await cur.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM violations") as cur:
            total_violations = (await cur.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM sessions WHERE flagged=1") as cur:
            flagged = (await cur.fetchone())[0]
    return {
        "active_sessions": active,
        "total_sessions": total,
        "total_violations": total_violations,
        "flagged_students": flagged,
        "live_count": len(active_connections),
    }

# ── Event endpoints (called by extension) ────────────────────────────────────
@app.post("/event/heartbeat")
async def heartbeat(payload: HeartbeatPayload):
    session_id = payload.session_id
    async with aiosqlite.connect(DB_PATH) as db:
        # Upsert session
        async with db.execute("SELECT id FROM sessions WHERE id=?", (session_id,)) as cur:
            exists = await cur.fetchone()
        if not exists:
            await db.execute(
                "INSERT INTO sessions (id,exam_id,student_id,status,risk_score,attention_score,flagged,started_at,last_heartbeat) VALUES (?,?,?,?,?,?,?,?,?)",
                (session_id, payload.exam_id, payload.student_id, "active",
                 payload.risk_score, payload.attention_score, 0, payload.timestamp, payload.timestamp)
            )
        else:
            await db.execute(
                "UPDATE sessions SET last_heartbeat=?, attention_score=?, risk_score=?, status='active' WHERE id=?",
                (payload.timestamp, payload.attention_score, payload.risk_score, session_id)
            )
        await db.commit()

    session_states[session_id] = {
        "student_id": payload.student_id,
        "exam_id": payload.exam_id,
        "attention_score": payload.attention_score,
        "risk_score": payload.risk_score,
        "last_seen": payload.timestamp,
    }

    await broadcast_to_admins({
        "type": "heartbeat",
        "session_id": session_id,
        "student_id": payload.student_id,
        "attention_score": payload.attention_score,
        "risk_score": payload.risk_score,
        "timestamp": payload.timestamp,
    })
    return {"ok": True}

@app.post("/event/violation")
async def record_violation(payload: ViolationPayload):
    vid = str(uuid.uuid4())
    ts = payload.timestamp or time.time()
    risk_delta = calculate_risk_delta(payload.violation_type)
    attention = update_attention_score(payload.session_id, payload.violation_type)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO violations VALUES (?,?,?,?,?,?,?,?,?)",
            (vid, payload.session_id, payload.student_id, payload.exam_id,
             payload.violation_type, payload.severity, risk_delta,
             json.dumps(payload.metadata), ts)
        )
        # Update session risk
        await db.execute(
            "UPDATE sessions SET risk_score = MIN(100, risk_score + ?), attention_score=? WHERE id=?",
            (risk_delta, attention, payload.session_id)
        )
        # Auto-flag if high risk
        await db.execute(
            """UPDATE sessions SET flagged=1 WHERE id=?
               AND risk_score >= 60
               AND (SELECT COUNT(*) FROM violations WHERE session_id=?) >= 3""",
            (payload.session_id, payload.session_id)
        )
        await db.commit()

    logger.info(f"VIOLATION [{payload.violation_type}] session={payload.session_id} risk+{risk_delta}")

    await broadcast_to_admins({
        "type": "violation",
        "session_id": payload.session_id,
        "student_id": payload.student_id,
        "violation_type": payload.violation_type,
        "severity": payload.severity,
        "risk_delta": risk_delta,
        "attention_score": attention,
        "timestamp": ts,
    })
    return {"ok": True, "risk_delta": risk_delta}

@app.post("/event/screenshot")
async def save_screenshot(payload: ScreenshotPayload):
    sid = str(uuid.uuid4())
    ts = payload.timestamp or time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO screenshots VALUES (?,?,?,?,?,?)",
            (sid, payload.session_id, payload.student_id,
             payload.image_data, payload.trigger, ts)
        )
        await db.commit()
    await broadcast_to_admins({
        "type": "screenshot",
        "session_id": payload.session_id,
        "screenshot_id": sid,
        "trigger": payload.trigger,
        "thumbnail": payload.image_data[:500] if payload.image_data else "",
        "timestamp": ts,
    })
    return {"ok": True, "screenshot_id": sid}

# ── WebSocket for admin dashboard live feed ───────────────────────────────────
@app.websocket("/ws/admin")
async def admin_ws(websocket: WebSocket):
    await websocket.accept()
    admin_connections.append(websocket)
    logger.info(f"Admin connected, total={len(admin_connections)}")
    try:
        # Send current state snapshot
        await websocket.send_text(json.dumps({
            "type": "init",
            "active_sessions": [
                {"session_id": k, **v}
                for k, v in session_states.items()
            ]
        }))
        while True:
            # Keep alive
            data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        if websocket in admin_connections:
            admin_connections.remove(websocket)
        logger.info(f"Admin disconnected, total={len(admin_connections)}")

# ── WebSocket for extension (student) ─────────────────────────────────────────
@app.websocket("/ws/student/{session_id}")
async def student_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_connections[session_id] = websocket
    logger.info(f"Student connected: {session_id}")
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "violation":
                payload = ViolationPayload(**msg)
                await record_violation(payload)
            elif msg_type == "screenshot":
                payload = ScreenshotPayload(**msg)
                await save_screenshot(payload)
            elif msg_type == "heartbeat":
                payload = HeartbeatPayload(**msg)
                await heartbeat(payload)
            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except (WebSocketDisconnect, Exception) as e:
        logger.info(f"Student disconnected: {session_id} ({e})")
    finally:
        active_connections.pop(session_id, None)
        session_states.pop(session_id, None)
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE sessions SET status='ended', ended_at=? WHERE id=?",
                (time.time(), session_id)
            )
            await db.commit()
        await broadcast_to_admins({"type": "student_disconnected", "session_id": session_id})

# ── AI summary generator ──────────────────────────────────────────────────────
def generate_summary(session: dict, violations: list) -> str:
    if not violations:
        return "No suspicious activity detected during this exam session."

    counts = {}
    for v in violations:
        vt = v["violation_type"]
        counts[vt] = counts.get(vt, 0) + 1

    lines = []
    total_risk = session.get("risk_score", 0)
    attention = session.get("attention_score", 100)

    if counts.get("tab_switch", 0) > 2:
        lines.append(f"switched tabs {counts['tab_switch']} times")
    if counts.get("multiple_faces", 0):
        lines.append(f"triggered multiple-face detection {counts['multiple_faces']} time(s)")
    if counts.get("face_missing", 0) > 2:
        lines.append(f"was not visible on camera {counts['face_missing']} times")
    if counts.get("looking_away", 0) > 3:
        lines.append(f"looked away from the screen {counts['looking_away']} times")
    if counts.get("voice_detected", 0):
        lines.append(f"triggered voice/audio detection {counts['voice_detected']} time(s)")
    if counts.get("copy_attempt", 0):
        lines.append(f"attempted to copy content {counts['copy_attempt']} time(s)")
    if counts.get("devtools_opened", 0):
        lines.append(f"opened developer tools {counts['devtools_opened']} time(s)")
    if counts.get("phone_detected", 0):
        lines.append(f"had a phone detected in frame {counts['phone_detected']} time(s)")

    if not lines:
        return f"Student had {len(violations)} minor violations with a risk score of {total_risk:.0f}/100 and attention score of {attention:.0f}/100."

    summary = f"Student {', '.join(lines)}."
    if total_risk >= 70:
        summary += " HIGH RISK — recommend manual review."
    elif total_risk >= 40:
        summary += " Moderate risk level detected."
    else:
        summary += f" Overall attention score: {attention:.0f}/100."

    return summary

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
