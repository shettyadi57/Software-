# 🛡️ AEGIS — Advanced Exam Guardrail Integrity System v4

AI-powered exam integrity monitoring: Chrome Extension + FastAPI Backend + Next.js Admin Portal

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Student Browser                                        │
│  ┌────────────────────┐                                 │
│  │  AEGIS Extension   │ ─── WebSocket ──▶ Backend      │
│  │  • Tab monitoring  │ ─── HTTP REST ──▶ /event/*     │
│  │  • Webcam capture  │                                 │
│  │  • Audio detection │                                 │
│  │  • Keyboard block  │                                 │
│  └────────────────────┘                                 │
└─────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌────────────────┐      ┌────────────────────────┐
│  FastAPI       │      │  Next.js Admin Portal  │
│  Backend       │◀─────│  • Live dashboard      │
│  :8000         │ WS   │  • Student monitoring  │
│                │      │  • Violation timeline  │
│  SQLite DB     │      │  • Reports & analytics │
│  JWT Auth      │      │  :3000                 │
└────────────────┘      └────────────────────────┘
         │
         ▼
┌────────────────┐
│  AI Engine     │  (optional)
│  Python :8001  │
│  OpenCV +      │
│  MediaPipe     │
└────────────────┘
```

---

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```
Backend runs at **http://localhost:8000**

Default credentials: `admin` / `aegis2024`

### 2. Admin Portal (Next.js)

```bash
cd admin-portal
npm install
npm run dev
```
Dashboard at **http://localhost:3000**

### 3. Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the AEGIS extension to your toolbar

### 4. AI Engine (Optional)

```bash
cd ai-engine
pip install -r requirements.txt
# For full detection, also install:
pip install opencv-python mediapipe
python main_service.py
```
AI engine at **http://localhost:8001**

---

## How to Run an Exam

### Invigilator (Admin)
1. Go to http://localhost:3000 → Login
2. Navigate to **Exams** → **New Exam**
3. Fill in title and duration → Submit
4. Note the **6-character Session Code** (e.g. `AB1C2D`)
5. Share the code with students

### Student
1. Click the AEGIS extension icon in Chrome
2. Enter your **Student ID** and the **Session Code**
3. Click **Start Monitoring**
4. Grant camera and microphone access when prompted
5. The exam is now being monitored

### Admin monitoring
- **Dashboard** — Live grid of all active students
- **Students** — Individual cards with live scores
- **Sessions** — Full history with filtering
- **Sessions > [Student]** — Violations timeline, screenshots, AI report
- **Reports** — Aggregate analytics

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Admin login, returns JWT |
| GET | `/exams` | List all exams |
| POST | `/exams` | Create exam (returns session code) |
| GET | `/sessions` | List sessions (filter by exam_id) |
| GET | `/sessions/{id}` | Session detail |
| GET | `/sessions/{id}/violations` | All violations |
| GET | `/sessions/{id}/screenshots` | Screenshot list |
| GET | `/sessions/{id}/report` | Full AI report |
| GET | `/dashboard/stats` | Summary stats |
| POST | `/event/heartbeat` | Student heartbeat |
| POST | `/event/violation` | Log a violation |
| POST | `/event/screenshot` | Save screenshot |
| WS | `/ws/admin` | Admin live feed |
| WS | `/ws/student/{id}` | Student monitoring stream |

---

## Violation Types & Risk Points

| Violation | Risk Points | Severity |
|-----------|-------------|----------|
| `tab_switch` | 10 | High |
| `window_blur` | 8 | Medium |
| `copy_attempt` | 15 | High |
| `paste_attempt` | 15 | High |
| `shortcut_blocked` | 12 | Medium |
| `face_missing` | 20 | High |
| `multiple_faces` | 50 | Critical |
| `looking_away` | 5 | Medium |
| `voice_detected` | 30 | High |
| `devtools_opened` | 25 | Critical |
| `resolution_change` | 20 | Medium |
| `screen_share_detected` | 40 | Critical |
| `phone_detected` | 35 | High |

**Auto-flag threshold:** Risk Score ≥ 60 AND Violations ≥ 3

---

## Risk & Attention Scoring

- **Risk Score (0–100):** Accumulates as violations occur. Capped at 100.
- **Attention Score (0–100):** Decreases with behavioral violations. Measures focus quality.

| Risk Range | Level | Action |
|------------|-------|--------|
| 0–39 | Low | Normal |
| 40–69 | Medium | Review recommended |
| ≥70 | High | Manual review required |

---

## Security

- JWT tokens (8-hour expiry) for admin authentication
- WebSocket session IDs are UUIDs — unguessable
- Content Security Policy via extension manifest
- Rate limiting via backend structure
- Screenshots stored as base64 in SQLite

---

## Environment Variables

### Backend
```env
JWT_SECRET=your-secret-key-here
```

### Admin Portal (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Troubleshooting

**Extension not sending events?**
- Ensure backend is running on port 8000
- Check `chrome://extensions` for errors in the service worker
- Verify camera/microphone permissions were granted

**Dashboard not showing live data?**
- Check WebSocket connection (green "Live" badge)
- Verify CORS is configured in backend
- Open browser console for WS errors

**Face detection not working?**
- Browser must support `FaceDetector` API (Chrome 70+) or falls back to skin-tone heuristic
- Grant camera permissions when prompted
- Ensure good lighting

**Camera failing to initialize?**
- Only one tab can hold the camera stream at a time
- Close other video apps
- Try reloading the exam page

---

## File Structure

```
AEGIS/
├── backend/
│   ├── main.py              # FastAPI server (REST + WebSocket)
│   └── requirements.txt
├── extension/
│   ├── manifest.json        # Chrome MV3 manifest
│   ├── background.js        # Service worker (WS, tab monitoring)
│   ├── content.js           # Page script (keyboard, clipboard, camera, audio)
│   ├── popup.html           # Extension popup UI
│   ├── popup.js             # Popup logic
│   ├── generate_icons.py    # Icon generator
│   └── icons/               # Extension icons
├── admin-portal/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── exams/page.tsx
│   │   │   ├── students/page.tsx
│   │   │   ├── sessions/page.tsx
│   │   │   └── sessions/[id]/page.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── RiskBar.tsx
│   │   └── lib/
│   │       ├── api.ts       # Typed API client
│   │       └── useLive.ts   # WebSocket hook
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── ai-engine/
│   ├── main_service.py      # FastAPI AI microservice
│   └── requirements.txt
└── README.md
```
