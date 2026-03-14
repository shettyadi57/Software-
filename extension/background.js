/**
 * AEGIS Extension - Background Service Worker
 * Manages WebSocket connection, tab monitoring, and event dispatching
 */

const BACKEND_WS = "ws://localhost:8000";
const BACKEND_HTTP = "http://localhost:8000";
const HEARTBEAT_INTERVAL_MS = 10000;
const SCREENSHOT_INTERVAL_MS = 30000;

let ws = null;
let sessionId = null;
let studentId = null;
let examId = null;
let riskScore = 0;
let attentionScore = 100;
let reconnectAttempts = 0;
let heartbeatTimer = null;
let screenshotTimer = null;
let isMonitoring = false;
let examTabId = null;

// ── Utility ──────────────────────────────────────────────────────────────────
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function log(level, msg, data = {}) {
  const entry = { level, msg, data, ts: Date.now() };
  console[level === "error" ? "error" : "log"](`[AEGIS BG] ${msg}`, data);
}

// ── WebSocket management ─────────────────────────────────────────────────────
function connectWS() {
  if (!sessionId) return;
  try {
    ws = new WebSocket(`${BACKEND_WS}/ws/student/${sessionId}`);

    ws.onopen = () => {
      log("info", "WebSocket connected");
      reconnectAttempts = 0;
      sendHeartbeat();
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "pong") return;
        if (msg.type === "command" && msg.action === "stop") {
          stopMonitoring();
        }
      } catch (e) {
        log("error", "WS parse error", e);
      }
    };

    ws.onerror = (e) => log("error", "WebSocket error", e);

    ws.onclose = () => {
      log("info", "WebSocket closed, scheduling reconnect");
      if (isMonitoring) {
        const delay = Math.min(30000, 2000 * Math.pow(2, reconnectAttempts));
        reconnectAttempts++;
        setTimeout(connectWS, delay);
      }
    };
  } catch (e) {
    log("error", "Failed to create WebSocket", e);
  }
}

function sendWS(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (e) {
      log("error", "WS send failed", e);
    }
  }
  // Fallback to HTTP
  sendHTTP(data);
  return false;
}

async function sendHTTP(data) {
  const endpointMap = {
    violation: "/event/violation",
    screenshot: "/event/screenshot",
    heartbeat: "/event/heartbeat",
  };
  const endpoint = endpointMap[data.type] || "/event/violation";
  try {
    await fetch(`${BACKEND_HTTP}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    log("error", "HTTP fallback failed", e);
  }
}

// ── Event dispatching ─────────────────────────────────────────────────────────
function sendViolation(violationType, severity = "medium", metadata = {}) {
  if (!isMonitoring || !sessionId) return;
  const risk = getRiskDelta(violationType);
  riskScore = Math.min(100, riskScore + risk);
  attentionScore = Math.max(0, attentionScore - getAttentionPenalty(violationType));

  const payload = {
    type: "violation",
    session_id: sessionId,
    student_id: studentId,
    exam_id: examId,
    violation_type: violationType,
    severity,
    metadata,
    timestamp: Date.now() / 1000,
  };
  sendWS(payload);
  log("info", `Violation: ${violationType}`, { risk, riskScore });
}

function getRiskDelta(vt) {
  const w = { tab_switch: 10, window_blur: 8, copy_attempt: 15, paste_attempt: 15,
    shortcut_blocked: 12, face_missing: 20, multiple_faces: 50, looking_away: 5,
    voice_detected: 30, devtools_opened: 25, resolution_change: 20, phone_detected: 35 };
  return w[vt] || 5;
}

function getAttentionPenalty(vt) {
  const p = { tab_switch: 3, window_blur: 2, face_missing: 8, multiple_faces: 15,
    looking_away: 2, voice_detected: 5 };
  return p[vt] || 1;
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
function sendHeartbeat() {
  if (!isMonitoring || !sessionId) return;
  sendWS({
    type: "heartbeat",
    session_id: sessionId,
    student_id: studentId,
    exam_id: examId,
    attention_score: attentionScore,
    risk_score: riskScore,
    status: "active",
    timestamp: Date.now() / 1000,
  });
}

// ── Tab monitoring ────────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener((info) => {
  if (!isMonitoring) return;
  if (examTabId && info.tabId !== examTabId) {
    sendViolation("tab_switch", "high", { switched_to_tab: info.tabId });
    showAlert("Tab Switch Detected", "Please stay on the exam tab!");
  }
});

chrome.tabs.onCreated.addListener(() => {
  if (!isMonitoring) return;
  sendViolation("tab_switch", "high", { action: "new_tab_created" });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (!isMonitoring) return;
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    sendViolation("window_blur", "medium", { action: "window_lost_focus" });
  }
});

// ── Screenshot capture ────────────────────────────────────────────────────────
async function captureScreenshot(trigger = "periodic") {
  if (!isMonitoring || !examTabId) return;
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "jpeg",
      quality: 60,
    });
    sendWS({
      type: "screenshot",
      session_id: sessionId,
      student_id: studentId,
      exam_id: examId,
      image_data: dataUrl,
      trigger,
      timestamp: Date.now() / 1000,
    });
  } catch (e) {
    log("error", "Screenshot capture failed", e);
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
function showAlert(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: `⚠️ AEGIS: ${title}`,
    message,
    priority: 2,
  });
}

// ── Start / Stop monitoring ───────────────────────────────────────────────────
async function startMonitoring(data) {
  sessionId = data.sessionId || generateSessionId();
  studentId = data.studentId || "unknown";
  examId = data.examId || "default";
  riskScore = 0;
  attentionScore = 100;
  isMonitoring = true;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) examTabId = tabs[0].id;

  connectWS();

  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  screenshotTimer = setInterval(() => captureScreenshot("periodic"), SCREENSHOT_INTERVAL_MS);

  chrome.storage.local.set({ aegis_active: true, sessionId, studentId, examId });
  log("info", "Monitoring started", { sessionId, studentId, examId });
  return { ok: true, sessionId };
}

function stopMonitoring() {
  isMonitoring = false;
  clearInterval(heartbeatTimer);
  clearInterval(screenshotTimer);
  if (ws) { ws.close(); ws = null; }
  chrome.storage.local.set({ aegis_active: false });
  log("info", "Monitoring stopped");
}

// ── Message handler (from popup / content scripts) ────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.action) {
      case "start_monitoring":
        const result = await startMonitoring(msg.data);
        sendResponse(result);
        break;
      case "stop_monitoring":
        stopMonitoring();
        sendResponse({ ok: true });
        break;
      case "get_status":
        sendResponse({ isMonitoring, riskScore, attentionScore, sessionId });
        break;
      case "violation":
        sendViolation(msg.violationType, msg.severity, msg.metadata);
        sendResponse({ ok: true });
        break;
      case "webcam_frame":
        // Forward webcam/face detection results from content script
        if (msg.data?.faceCount === 0) {
          sendViolation("face_missing", "high", { detail: "no_face_in_frame" });
        } else if (msg.data?.faceCount > 1) {
          sendViolation("multiple_faces", "critical", { count: msg.data.faceCount });
        } else if (msg.data?.lookingAway) {
          sendViolation("looking_away", "medium", msg.data);
        }
        if (msg.data?.phoneSuspected) {
          sendViolation("phone_detected", "high", msg.data);
        }
        sendResponse({ ok: true });
        break;
      case "audio_event":
        sendViolation("voice_detected", "high", { amplitude: msg.amplitude });
        sendResponse({ ok: true });
        break;
      case "screenshot_trigger":
        await captureScreenshot(msg.trigger || "manual");
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ error: "unknown action" });
    }
  })();
  return true; // async response
});

// ── Dev tools detection via alarm ────────────────────────────────────────────
chrome.alarms.create("devtools_check", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "devtools_check" && isMonitoring) {
    // Injected via content script
  }
});

// ── Restore state on service worker restart ───────────────────────────────────
chrome.storage.local.get(["aegis_active", "sessionId", "studentId", "examId"], (data) => {
  if (data.aegis_active) {
    sessionId = data.sessionId;
    studentId = data.studentId;
    examId = data.examId;
    isMonitoring = true;
    connectWS();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    screenshotTimer = setInterval(() => captureScreenshot("periodic"), SCREENSHOT_INTERVAL_MS);
    log("info", "Monitoring restored after SW restart");
  }
});
