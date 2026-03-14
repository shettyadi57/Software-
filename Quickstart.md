# AEGIS Quickstart — Up in 5 minutes

## Prerequisites
- Python 3.10+
- Node.js 18+
- Chrome browser

---

## Step 1 — Backend

```bash
cd AEGIS/backend
pip install fastapi uvicorn aiosqlite pyjwt python-multipart websockets pydantic
python main.py
```
✅ API running at http://localhost:8000

---

## Step 2 — Admin Portal

```bash
cd AEGIS/admin-portal
npm install
npm run dev
```
✅ Dashboard at http://localhost:3000

Login: **admin** / **aegis2024**

---

## Step 3 — Load Extension

1. Open Chrome → go to `chrome://extensions`
2. Toggle **Developer mode** ON (top-right)
3. Click **Load unpacked**
4. Select the `AEGIS/extension` folder
5. Pin AEGIS icon to toolbar

---

## Step 4 — Create an Exam

1. Go to http://localhost:3000 → login
2. Click **Exams** → **+ New Exam**
3. Enter title (e.g. "Demo Exam") and duration
4. Note the **session code** shown (e.g. `AB1C2D`)

---

## Step 5 — Start Monitoring (as Student)

1. Click the AEGIS shield icon in Chrome toolbar
2. Enter Student ID: `STU001`
3. Enter Session Code: `AB1C2D`
4. Click **▶ Start Monitoring**
5. Allow camera & microphone access

---

## Step 6 — Watch Live

Go to http://localhost:3000/dashboard — you'll see the student appear with live scores.

Try:
- Switching tabs → violation logged
- Pressing Ctrl+C → shortcut blocked
- Opening DevTools (F12) → violation logged

---

## Verify the API is working

```bash
# Health check
curl http://localhost:8000/health

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"aegis2024"}'

# Get sessions (use token from above)
curl http://localhost:8000/sessions \
  -H "Authorization: Bearer <token>"
```
