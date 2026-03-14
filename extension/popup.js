/**
 * AEGIS Popup Script
 */
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const setupForm = document.getElementById("setupForm");
const activeView = document.getElementById("activeView");
const alertBox = document.getElementById("alertBox");
const attentionVal = document.getElementById("attentionVal");
const riskVal = document.getElementById("riskVal");
const sessionIdDisplay = document.getElementById("sessionIdDisplay");

function showAlert(msg, type = "error") {
  alertBox.textContent = msg;
  alertBox.className = `alert ${type}`;
  setTimeout(() => (alertBox.className = "alert"), 4000);
}

function setActive(active, sessionId, attention, risk) {
  if (active) {
    statusDot.classList.remove("inactive");
    statusText.textContent = "Monitoring active";
    setupForm.style.display = "none";
    activeView.style.display = "block";
    sessionIdDisplay.textContent = sessionId || "—";
    attentionVal.textContent = Math.round(attention || 100);
    riskVal.textContent = Math.round(risk || 0);
  } else {
    statusDot.classList.add("inactive");
    statusText.textContent = "Not monitoring";
    setupForm.style.display = "block";
    activeView.style.display = "none";
  }
}

// Load initial state
chrome.runtime.sendMessage({ action: "get_status" }, (res) => {
  if (res?.isMonitoring) {
    setActive(true, res.sessionId, res.attentionScore, res.riskScore);
  }
});

// Poll for updates
setInterval(() => {
  chrome.runtime.sendMessage({ action: "get_status" }, (res) => {
    if (res?.isMonitoring) {
      attentionVal.textContent = Math.round(res.attentionScore || 100);
      riskVal.textContent = Math.round(res.riskScore || 0);

      const attn = res.attentionScore || 100;
      const risk = res.riskScore || 0;
      attentionVal.style.color = attn >= 70 ? "#48bb78" : attn >= 40 ? "#ecc94b" : "#fc8181";
      riskVal.style.color = risk <= 30 ? "#48bb78" : risk <= 60 ? "#ecc94b" : "#fc8181";
    }
  });
}, 3000);

startBtn.addEventListener("click", () => {
  const studentId = document.getElementById("studentId").value.trim();
  const examId = document.getElementById("examId").value.trim().toUpperCase();

  if (!studentId) { showAlert("Please enter your Student ID"); return; }
  if (!examId) { showAlert("Please enter the Session Code"); return; }

  startBtn.disabled = true;
  startBtn.textContent = "Connecting...";

  chrome.runtime.sendMessage(
    { action: "start_monitoring", data: { studentId, examId } },
    (res) => {
      startBtn.disabled = false;
      startBtn.textContent = "▶ Start Monitoring";
      if (res?.ok) {
        setActive(true, res.sessionId, 100, 0);
        showAlert("Monitoring started successfully!", "success");
      } else {
        showAlert("Failed to start monitoring. Check backend connection.");
      }
    }
  );
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stop_monitoring" }, (res) => {
    if (res?.ok) {
      setActive(false);
      showAlert("Monitoring stopped.", "success");
    }
  });
});
