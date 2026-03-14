# AEGIS Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  STUDENT BROWSER                                                     │
│                                                                      │
│  ┌─────────────────────────────────────────────┐                    │
│  │  AEGIS Chrome Extension (Manifest V3)        │                    │
│  │                                             │                    │
│  │  background.js (Service Worker)             │                    │
│  │    • WebSocket connection manager           │                    │
│  │    • Retry logic + HTTP fallback            │                    │
│  │    • Tab/window event listeners             │                    │
│  │    • Screenshot capture (tabs API)          │                    │
│  │    • Heartbeat scheduler (10s)              │                    │
│  │    • Risk score accumulator                 │                    │
│  │                                             │                    │
│  │  content.js (Injected into exam page)       │                    │
│  │    • Keyboard shortcut blocker (30+)        │                    │
│  │    • Clipboard copy/paste/cut blocker       │                    │
│  │    • Context menu disabled                  │                    │
│  │    • DevTools detector (size heuristic)     │                    │
│  │    • Screen resolution monitor              │                    │
│  │    • Webcam capture (MediaDevices API)      │                    │
│  │      └─ FaceDetector API (Chrome)           │                    │
│  │      └─ Skin-tone fallback heuristic        │                    │
│  │    • Audio/voice detection (WebAudio API)   │                    │
│  │      └─ RMS threshold: 25                   │                    │
│  │      └─ Check interval: 2s                  │                    │
│  │                                             │                    │
│  │  popup.html/js                              │                    │
│  │    • Student ID + Session Code entry        │                    │
│  │    • Live attention/risk display            │                    │
│  │    • Start/stop monitoring                  │                    │
│  └────────────────┬────────────────────────────┘                    │
└───────────────────│──────────────────────────────────────────────────┘
                    │
              WebSocket / HTTP REST
                    │
┌───────────────────▼──────────────────────────────────────────────────┐
│  FASTAPI BACKEND  (:8000)                                            │
│                                                                      │
│  WebSocket Handlers                                                  │
│    /ws/student/{session_id}  ←── student events stream              │
│    /ws/admin                 ←── admin dashboard live feed          │
│                                                                      │
│  REST API                                                            │
│    POST /auth/login          JWT token issuance                      │
│    CRUD /exams               Exam management + session codes         │
│    GET  /sessions            Session listing + filtering             │
│    GET  /sessions/{id}/*     Violations, screenshots, reports        │
│    POST /event/*             heartbeat | violation | screenshot      │
│    GET  /dashboard/stats     Aggregate summary                       │
│                                                                      │
│  Risk Engine                                                         │
│    • Per-violation risk delta lookup table                           │
│    • Cumulative risk score (capped at 100)                           │
│    • Attention score decay                                           │
│    • Auto-flag: risk ≥ 60 AND violations ≥ 3                        │
│                                                                      │
│  AI Summary Generator                                                │
│    • Natural language session report                                 │
│    • Pattern detection from violation counts                         │
│    • Severity classification                                         │
│                                                                      │
│  Real-time Broadcast                                                 │
│    • All violations/screenshots pushed to all admin WS clients       │
│    • Heartbeat state aggregated in memory                            │
│    • Dead socket cleanup                                             │
│                                                                      │
│  SQLite (aiosqlite)                                                  │
│    admins | exams | sessions | violations | screenshots              │
└───────────────────┬──────────────────────────────────────────────────┘
                    │  REST calls (optional)
┌───────────────────▼──────────────────────────────────────────────────┐
│  AI ENGINE  (:8001)  — Optional Python microservice                  │
│                                                                      │
│  POST /analyze/frame                                                 │
│    • OpenCV Haar cascade face detection (fallback)                   │
│    • MediaPipe FaceDetection + FaceMesh (primary)                    │
│    • Head pose estimation (yaw/pitch from landmarks)                 │
│    • Phone detection (contour shape heuristic)                       │
│    • Attention score calculation                                     │
│                                                                      │
│  POST /analyze/audio                                                 │
│    • RMS classification: silence / noise / speech                    │
│    • Confidence scoring                                              │
└──────────────────────────────────────────────────────────────────────┘
                    ▲
                    │  WebSocket live events
┌───────────────────┴──────────────────────────────────────────────────┐
│  NEXT.JS ADMIN PORTAL  (:3000)                                       │
│                                                                      │
│  Pages                                                               │
│    /login          JWT login form                                    │
│    /dashboard      Live student grid + alert feed                    │
│    /exams          Exam CRUD + session code generation               │
│    /students       All students with live/offline status             │
│    /sessions       Filterable session table                          │
│    /sessions/[id]  Full detail: timeline, violations, screenshots    │
│    /reports        Aggregate analytics, risk histogram               │
│                                                                      │
│  useLive() hook                                                      │
│    • WebSocket /ws/admin                                             │
│    • Auto-reconnect with backoff                                     │
│    • In-memory live state (session_id → scores)                      │
│    • 200-event rolling feed                                          │
│                                                                      │
│  Charts (Chart.js v4)                                                │
│    • Risk timeline line chart                                        │
│    • Violation breakdown bar chart                                   │
│    • Risk distribution doughnut                                      │
│    • Risk score histogram                                            │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Exam Start
1. Admin creates exam → backend returns 6-char session code
2. Admin shares code with students verbally or via exam platform
3. Student enters code + student ID into AEGIS extension popup
4. Extension generates UUID session ID, opens WebSocket to backend
5. Backend creates/upserts session record in SQLite
6. Admin dashboard receives `init` snapshot over /ws/admin

### During Exam (every 10 seconds)
```
Extension → POST /event/heartbeat
  {session_id, student_id, exam_id, attention_score, risk_score, timestamp}
Backend → upsert sessions table
Backend → broadcast to all admin WS clients
```

### Violation Detected
```
content.js detects event (tab switch, face missing, voice, etc.)
  → chrome.runtime.sendMessage({action: "violation", ...})
background.js → sendWS({type: "violation", ...})
Backend → INSERT violations table
Backend → UPDATE sessions SET risk_score = MIN(100, risk_score + delta)
Backend → check auto-flag condition
Backend → broadcast to admin WS clients
Admin dashboard → alert feed entry + live card update
```

### Screenshot Capture
```
background.js (every 30s) → chrome.tabs.captureVisibleTab()
  → sendWS({type: "screenshot", image_data: base64, trigger: "periodic"})
content.js (every 5s) → canvasEl.toDataURL() from webcam
  → chrome.runtime.sendMessage({action: "screenshot_trigger", trigger: "webcam_frame"})
Backend → INSERT screenshots table (full base64 stored)
Admin → view via /sessions/{id}/screenshots → click to load image
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Admin API | JWT Bearer token (8hr expiry, HS256) |
| Student WS | UUID session ID (unforgeable) |
| Extension | Chrome MV3 isolated context, host permissions scoped |
| Transport | HTTP/WS (upgrade to HTTPS/WSS in production) |
| Data | SQLite file — add encryption at rest for production |
| Anti-tamper | DevTools detection, resolution monitoring |

## Scaling Notes

For production deployment:
- Replace SQLite with PostgreSQL + connection pooling
- Add Redis for pub/sub (replace in-memory admin_connections list)
- Add HTTPS/WSS via nginx reverse proxy
- Add rate limiting (e.g. slowapi) on /event/* endpoints
- Store screenshots in S3/R2 instead of SQLite BLOB
- Add auth middleware on student WebSocket (verify session code)
