/**
 * AEGIS Content Script
 * Injected into exam page - blocks shortcuts, monitors clipboard, detects devtools
 */

(function () {
  "use strict";

  let isActive = false;
  let devtoolsCheckInterval = null;

  // Check if AEGIS is active
  chrome.storage.local.get(["aegis_active"], (data) => {
    if (data.aegis_active) {
      isActive = true;
      init();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "activate") { isActive = true; init(); }
    if (msg.action === "deactivate") { isActive = false; cleanup(); }
  });

  function init() {
    attachKeyboardBlocker();
    attachClipboardMonitor();
    attachContextMenuBlocker();
    attachVisibilityMonitor();
    attachDevToolsDetector();
    attachScreenIntegrityMonitor();
    injectCameraAudio();
  }

  function cleanup() {
    clearInterval(devtoolsCheckInterval);
  }

  // ── Keyboard shortcut blocker ─────────────────────────────────────────────
  const BLOCKED_SHORTCUTS = new Set([
    "ctrl+c", "ctrl+v", "ctrl+x", "ctrl+a",
    "ctrl+shift+i", "ctrl+shift+j", "ctrl+shift+c", "ctrl+u",
    "f12", "ctrl+p", "ctrl+s", "ctrl+shift+s",
    "alt+tab", "meta+tab", "ctrl+tab",
    "ctrl+w", "ctrl+t", "ctrl+n",
  ]);

  function attachKeyboardBlocker() {
    document.addEventListener("keydown", (e) => {
      if (!isActive) return;
      const key = buildKeyCombo(e);
      if (BLOCKED_SHORTCUTS.has(key)) {
        e.preventDefault();
        e.stopPropagation();
        sendViolation("shortcut_blocked", "medium", { key });
      }
    }, true);
  }

  function buildKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.metaKey) parts.push("meta");
    parts.push(e.key.toLowerCase());
    return parts.join("+");
  }

  // ── Clipboard monitor ─────────────────────────────────────────────────────
  function attachClipboardMonitor() {
    document.addEventListener("copy", (e) => {
      if (!isActive) return;
      e.preventDefault();
      const text = window.getSelection()?.toString().slice(0, 100) || "";
      sendViolation("copy_attempt", "high", { snippet: text });
    }, true);

    document.addEventListener("cut", (e) => {
      if (!isActive) return;
      e.preventDefault();
      sendViolation("copy_attempt", "high", { type: "cut" });
    }, true);

    document.addEventListener("paste", (e) => {
      if (!isActive) return;
      e.preventDefault();
      sendViolation("paste_attempt", "high", {});
    }, true);
  }

  // ── Context menu blocker ──────────────────────────────────────────────────
  function attachContextMenuBlocker() {
    document.addEventListener("contextmenu", (e) => {
      if (!isActive) return;
      e.preventDefault();
    }, true);
  }

  // ── Visibility monitor ────────────────────────────────────────────────────
  function attachVisibilityMonitor() {
    document.addEventListener("visibilitychange", () => {
      if (!isActive) return;
      if (document.hidden) {
        sendViolation("tab_switch", "high", { visibility: "hidden" });
      }
    });

    window.addEventListener("blur", () => {
      if (!isActive) return;
      sendViolation("window_blur", "medium", {});
    });
  }

  // ── DevTools detector ─────────────────────────────────────────────────────
  function attachDevToolsDetector() {
    const threshold = 200;
    let lastWidth = window.outerWidth;
    let lastHeight = window.outerHeight;

    devtoolsCheckInterval = setInterval(() => {
      if (!isActive) return;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      // Width/height change suggests devtools docked
      if (widthDiff > threshold || heightDiff > threshold) {
        sendViolation("devtools_opened", "critical", { widthDiff, heightDiff });
      }

      // Resolution change
      if (window.screen.width !== lastWidth || window.screen.height !== lastHeight) {
        sendViolation("resolution_change", "medium", {
          from: { w: lastWidth, h: lastHeight },
          to: { w: window.screen.width, h: window.screen.height },
        });
        lastWidth = window.screen.width;
        lastHeight = window.screen.height;
      }
    }, 3000);

    // Debugger breakpoint trick
    const devtoolsElement = new Image();
    Object.defineProperty(devtoolsElement, "id", {
      get: function () {
        if (isActive) sendViolation("devtools_opened", "critical", { method: "getter_trap" });
        return "";
      },
    });
  }

  // ── Screen integrity monitor ──────────────────────────────────────────────
  function attachScreenIntegrityMonitor() {
    // Detect multiple monitors (heuristic: very wide window)
    if (window.screen.availWidth > 3840) {
      sendViolation("resolution_change", "medium", {
        reason: "possible_multi_monitor",
        availWidth: window.screen.availWidth,
      });
    }

    // Detect screen sharing (navigator.mediaDevices.getDisplayMedia active)
    // This is approximated; actual detection needs MediaStream track inspection
    navigator.mediaDevices?.addEventListener?.("devicechange", () => {
      if (!isActive) return;
      sendViolation("screen_share_detected", "high", { event: "device_change" });
    });
  }

  // ── Inject camera + audio scripts ─────────────────────────────────────────
  function injectCameraAudio() {
    chrome.runtime.sendMessage({ action: "get_status" }, (status) => {
      if (status?.isMonitoring) {
        startCamera();
        startAudio();
      }
    });
  }

  // ── Camera (webcam face detection) ────────────────────────────────────────
  let videoEl = null;
  let canvasEl = null;
  let cameraStream = null;
  let faceCheckInterval = null;

  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });

      videoEl = document.createElement("video");
      videoEl.srcObject = cameraStream;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      videoEl.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
      document.body.appendChild(videoEl);

      canvasEl = document.createElement("canvas");
      canvasEl.width = 320;
      canvasEl.height = 240;

      await videoEl.play();

      // Face detection using shape detection API if available, else brightness heuristic
      faceCheckInterval = setInterval(analyzeFrame, 5000);
    } catch (err) {
      sendViolation("face_missing", "critical", { error: err.message, reason: "camera_denied" });
    }
  }

  async function analyzeFrame() {
    if (!videoEl || !canvasEl || !isActive) return;
    try {
      const ctx = canvasEl.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, 320, 240);

      let faceCount = 0;
      let lookingAway = false;
      let phoneSuspected = false;

      // Use Shape Detection API for face detection if available
      if ("FaceDetector" in window) {
        try {
          const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
          const faces = await detector.detect(canvasEl);
          faceCount = faces.length;

          if (faces.length === 1) {
            const face = faces[0];
            const { boundingBox } = face;
            // Heuristic: face too small = looking away
            if (boundingBox.width < 60 || boundingBox.height < 60) {
              lookingAway = true;
            }
          }
        } catch (e) {
          faceCount = estimateFaceCountFromPixels(ctx);
        }
      } else {
        faceCount = estimateFaceCountFromPixels(ctx);
      }

      // Send frame data to background
      chrome.runtime.sendMessage({
        action: "webcam_frame",
        data: { faceCount, lookingAway, phoneSuspected },
      });

      // Also send periodic screenshot of webcam frame
      const frameData = canvasEl.toDataURL("image/jpeg", 0.5);
      chrome.runtime.sendMessage({
        action: "screenshot_trigger",
        trigger: "webcam_frame",
        imageData: frameData,
      });
    } catch (e) {
      console.error("[AEGIS] Frame analysis error:", e);
    }
  }

  function estimateFaceCountFromPixels(ctx) {
    // Simple skin-tone pixel counting heuristic
    const imageData = ctx.getImageData(0, 0, 320, 240);
    const data = imageData.data;
    let skinPixels = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (isSkinTone(r, g, b)) skinPixels++;
    }
    const ratio = skinPixels / (320 * 240 / 16);
    if (ratio < 0.02) return 0;  // No face
    if (ratio > 0.25) return 2;  // Multiple faces
    return 1;
  }

  function isSkinTone(r, g, b) {
    return r > 95 && g > 40 && b > 20 &&
      r - Math.min(g, b) > 15 &&
      Math.abs(r - g) > 15 &&
      r > g && r > b;
  }

  // ── Audio / Voice detection ───────────────────────────────────────────────
  let audioContext = null;
  let audioStream = null;
  let analyserNode = null;
  let audioCheckInterval = null;
  const VOICE_THRESHOLD = 25; // RMS threshold

  async function startAudio() {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(audioStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);

      audioCheckInterval = setInterval(checkAudioLevel, 2000);
    } catch (err) {
      console.warn("[AEGIS] Audio access denied:", err.message);
    }
  }

  function checkAudioLevel() {
    if (!analyserNode || !isActive) return;
    const buffer = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(buffer);
    const rms = Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length);
    if (rms > VOICE_THRESHOLD) {
      chrome.runtime.sendMessage({
        action: "audio_event",
        amplitude: rms,
        threshold: VOICE_THRESHOLD,
      });
    }
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  function sendViolation(type, severity, metadata) {
    chrome.runtime.sendMessage({
      action: "violation",
      violationType: type,
      severity,
      metadata,
    });
  }
})();
