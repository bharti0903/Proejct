(function () {
  console.log("DAAT content script loaded:", window.location.href);

  let lastUrl = location.href;
  let audioUnlocked = false;
  let audioCtx = null;

  let liveSessionMonitorInterval = null;
  let liveWarningShown = false;
  let liveDangerShown = false;
  let lastLiveSessionStartedAt = null;

  async function tryBootstrapFromWebsite() {
    try {
      if (!location.origin.startsWith("http://localhost:5002")) return;

      const response = await fetch("/extension/bootstrap", {
        credentials: "include",
      });

      const data = await response.json();

      if (!data.success) return;

      chrome.storage.local.set({
        backendUrl: data.backendUrl,
        extensionToken: data.extensionToken,
      });

      console.log("Extension bootstrap success");
    } catch (error) {
      console.log("Bootstrap sync skipped:", error);
    }
  }

  function ensureBody(callback, retries = 40) {
    if (document.body) {
      callback();
      return;
    }
    if (retries <= 0) return;
    setTimeout(() => ensureBody(callback, retries - 1), 150);
  }

  function unlockAudio() {
    if (audioUnlocked) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      audioCtx = new AudioCtx();

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      audioUnlocked = true;
      console.log("Audio unlocked");
    } catch (error) {
      console.log("Audio unlock skipped:", error);
    }
  }

  window.addEventListener("click", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });

  function playAlertSound(type) {
    try {
      if (!audioUnlocked || !audioCtx) {
        console.log("Sound blocked until user interaction");
        return;
      }

      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = type === "danger" ? 880 : 660;

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);

      oscillator.connect(gain);
      gain.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.45);
    } catch (error) {
      console.log("Sound skipped:", error);
    }
  }

  function getAlertTheme(type) {
    if (type === "danger") {
      return {
        title: "Danger Limit Reached",
        accent: "#ef4444",
        accentSoft: "rgba(239, 68, 68, 0.22)",
        border: "rgba(248, 113, 113, 0.28)",
        progress: "linear-gradient(90deg, #fca5a5, #ef4444)",
        icon: "⚠",
        shadow: "0 25px 70px rgba(0, 0, 0, 0.48)",
      };
    }

    if (type === "warning") {
      return {
        title: "Warning Limit Reached",
        accent: "#f59e0b",
        accentSoft: "rgba(245, 158, 11, 0.22)",
        border: "rgba(251, 191, 36, 0.28)",
        progress: "linear-gradient(90deg, #fde68a, #f59e0b)",
        icon: "⏰",
        shadow: "0 25px 70px rgba(0, 0, 0, 0.45)",
      };
    }

    return {
      title: "Notification",
      accent: "#3b82f6",
      accentSoft: "rgba(59, 130, 246, 0.22)",
      border: "rgba(96, 165, 250, 0.28)",
      progress: "linear-gradient(90deg, #bfdbfe, #3b82f6)",
      icon: "ℹ",
      shadow: "0 25px 70px rgba(0, 0, 0, 0.42)",
    };
  }

  function removeExistingAlert() {
    const existing = document.getElementById("daat-glass-alert-wrap");
    if (existing) existing.remove();
  }

  function injectAnimationStyles() {
    if (document.getElementById("daat-alert-styles")) return;

    const style = document.createElement("style");
    style.id = "daat-alert-styles";
    style.textContent = `
      @keyframes daatPulseRing {
        0% { transform: scale(0.9); opacity: 0.65; }
        70% { transform: scale(1.35); opacity: 0; }
        100% { transform: scale(1.45); opacity: 0; }
      }
      @keyframes daatGlowShift {
        0% { transform: translateX(-10%) translateY(-8%) rotate(0deg); }
        50% { transform: translateX(8%) translateY(6%) rotate(8deg); }
        100% { transform: translateX(-10%) translateY(-8%) rotate(0deg); }
      }
      @keyframes daatCardPulse {
        0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.06); }
        50% { box-shadow: 0 0 0 10px rgba(255,255,255,0.01); }
        100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.00); }
      }
    `;
    document.head.appendChild(style);
  }

  function showBlockedScreen(message) {
    ensureBody(() => {
      document.documentElement.innerHTML = `
        <head>
          <title>Focus Lock</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: radial-gradient(circle at top left, #1e293b, #020617 60%);
              color: #fff;
              font-family: Inter, Segoe UI, Arial, sans-serif;
              padding: 24px;
            }
            .box {
              width: min(700px, 100%);
              border: 1px solid rgba(255,255,255,0.08);
              background: rgba(15,23,42,0.82);
              backdrop-filter: blur(18px);
              border-radius: 28px;
              padding: 36px;
              box-shadow: 0 25px 70px rgba(0,0,0,0.45);
              text-align: center;
            }
            .badge {
              display: inline-block;
              padding: 8px 14px;
              border-radius: 999px;
              background: rgba(239,68,68,0.18);
              border: 1px solid rgba(248,113,113,0.28);
              color: #fecaca;
              font-weight: 700;
              margin-bottom: 16px;
            }
            h1 {
              margin: 0 0 14px;
              font-size: 42px;
              line-height: 1.1;
            }
            p {
              color: #cbd5e1;
              font-size: 17px;
              line-height: 1.7;
              margin: 0;
            }
            button {
              margin-top: 24px;
              background: #fff;
              color: #0f172a;
              border: none;
              border-radius: 16px;
              padding: 12px 18px;
              font-weight: 800;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="badge">Usage blocked</div>
            <h1>Take a break</h1>
            <p>${message}</p>
            <button onclick="window.location.href='https://www.google.com'">Leave this page</button>
          </div>
        </body>
      `;
    });
  }

  function showPageAlert(message, type = "warning") {
    ensureBody(() => {
      removeExistingAlert();
      injectAnimationStyles();
      playAlertSound(type);

      const theme = getAlertTheme(type);

      const wrap = document.createElement("div");
      wrap.id = "daat-glass-alert-wrap";
      wrap.style.position = "fixed";
      wrap.style.top = "18px";
      wrap.style.left = "50%";
      wrap.style.transform = "translate(-50%, -145%) scale(0.95)";
      wrap.style.opacity = "0";
      wrap.style.zIndex = "2147483647";
      wrap.style.width = "min(600px, calc(100vw - 24px))";
      wrap.style.fontFamily = "Inter, Segoe UI, Roboto, Arial, sans-serif";
      wrap.style.transition =
        "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.34s ease";
      wrap.style.pointerEvents = "auto";

      const card = document.createElement("div");
      card.style.position = "relative";
      card.style.overflow = "hidden";
      card.style.borderRadius = "26px";
      card.style.border = `1px solid ${theme.border}`;
      card.style.background =
        "linear-gradient(135deg, rgba(10,14,24,0.88), rgba(18,24,39,0.82))";
      card.style.backdropFilter = "blur(18px) saturate(140%)";
      card.style.webkitBackdropFilter = "blur(18px) saturate(140%)";
      card.style.boxShadow = theme.shadow;
      card.style.animation = "daatCardPulse 2.4s ease-in-out infinite";

      const glow1 = document.createElement("div");
      glow1.style.position = "absolute";
      glow1.style.width = "240px";
      glow1.style.height = "240px";
      glow1.style.left = "-40px";
      glow1.style.top = "-80px";
      glow1.style.borderRadius = "999px";
      glow1.style.background = theme.accentSoft;
      glow1.style.filter = "blur(36px)";
      glow1.style.animation = "daatGlowShift 7s ease-in-out infinite";
      glow1.style.pointerEvents = "none";

      const glow2 = document.createElement("div");
      glow2.style.position = "absolute";
      glow2.style.width = "220px";
      glow2.style.height = "220px";
      glow2.style.right = "-60px";
      glow2.style.bottom = "-90px";
      glow2.style.borderRadius = "999px";
      glow2.style.background = "rgba(255,255,255,0.06)";
      glow2.style.filter = "blur(32px)";
      glow2.style.pointerEvents = "none";

      const content = document.createElement("div");
      content.style.position = "relative";
      content.style.display = "flex";
      content.style.alignItems = "flex-start";
      content.style.gap = "18px";
      content.style.padding = "20px 20px 16px 20px";

      const iconWrap = document.createElement("div");
      iconWrap.style.position = "relative";
      iconWrap.style.width = "66px";
      iconWrap.style.height = "66px";
      iconWrap.style.minWidth = "66px";
      iconWrap.style.display = "flex";
      iconWrap.style.alignItems = "center";
      iconWrap.style.justifyContent = "center";

      const pulseRing = document.createElement("div");
      pulseRing.style.position = "absolute";
      pulseRing.style.inset = "0";
      pulseRing.style.borderRadius = "20px";
      pulseRing.style.border = `2px solid ${theme.accent}`;
      pulseRing.style.animation = "daatPulseRing 1.8s ease-out infinite";

      const iconBox = document.createElement("div");
      iconBox.textContent = theme.icon;
      iconBox.style.position = "relative";
      iconBox.style.width = "66px";
      iconBox.style.height = "66px";
      iconBox.style.borderRadius = "20px";
      iconBox.style.display = "flex";
      iconBox.style.alignItems = "center";
      iconBox.style.justifyContent = "center";
      iconBox.style.background = `linear-gradient(135deg, ${theme.accentSoft}, rgba(255,255,255,0.08))`;
      iconBox.style.border = `1px solid ${theme.border}`;
      iconBox.style.color = "#ffffff";
      iconBox.style.fontSize = "30px";
      iconBox.style.fontWeight = "800";
      iconBox.style.boxShadow = `0 10px 30px ${theme.accentSoft}`;

      iconWrap.appendChild(pulseRing);
      iconWrap.appendChild(iconBox);

      const textWrap = document.createElement("div");
      textWrap.style.flex = "1";
      textWrap.style.minWidth = "0";

      const badge = document.createElement("div");
      badge.textContent = type === "danger" ? "Immediate attention" : "Take a quick pause";
      badge.style.display = "inline-flex";
      badge.style.alignItems = "center";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "999px";
      badge.style.background = "rgba(255,255,255,0.08)";
      badge.style.border = `1px solid ${theme.border}`;
      badge.style.color = "#e5eefc";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "700";
      badge.style.letterSpacing = "0.25px";
      badge.style.marginBottom = "12px";

      const title = document.createElement("div");
      title.textContent = theme.title;
      title.style.fontSize = "23px";
      title.style.fontWeight = "800";
      title.style.lineHeight = "1.2";
      title.style.color = "#ffffff";
      title.style.marginBottom = "8px";

      const body = document.createElement("div");
      body.textContent = message;
      body.style.fontSize = "16px";
      body.style.lineHeight = "1.68";
      body.style.fontWeight = "500";
      body.style.color = "rgba(255,255,255,0.92)";
      body.style.wordBreak = "break-word";

      const helper = document.createElement("div");
      helper.textContent =
        type === "danger"
          ? "You have crossed your allowed usage. Step away for a few minutes."
          : "You are getting close to your daily threshold. A short break can help.";
      helper.style.marginTop = "12px";
      helper.style.fontSize = "13px";
      helper.style.lineHeight = "1.55";
      helper.style.fontWeight = "600";
      helper.style.color = "rgba(226,232,240,0.82)";

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "10px";
      actions.style.marginTop = "15px";
      actions.style.flexWrap = "wrap";

      const focusBtn = document.createElement("button");
      focusBtn.textContent = type === "danger" ? "Block this page" : "Stay Focused";
      focusBtn.style.border = "none";
      focusBtn.style.cursor = "pointer";
      focusBtn.style.padding = "10px 16px";
      focusBtn.style.borderRadius = "14px";
      focusBtn.style.fontSize = "13px";
      focusBtn.style.fontWeight = "800";
      focusBtn.style.letterSpacing = "0.2px";
      focusBtn.style.color = "#0f172a";
      focusBtn.style.background = "#ffffff";

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Dismiss";
      closeBtn.style.border = `1px solid ${theme.border}`;
      closeBtn.style.cursor = "pointer";
      closeBtn.style.padding = "10px 16px";
      closeBtn.style.borderRadius = "14px";
      closeBtn.style.fontSize = "13px";
      closeBtn.style.fontWeight = "800";
      closeBtn.style.color = "#ffffff";
      closeBtn.style.background = "rgba(255,255,255,0.08)";

      const cornerClose = document.createElement("button");
      cornerClose.innerHTML = "&times;";
      cornerClose.style.border = "none";
      cornerClose.style.background = "rgba(255,255,255,0.08)";
      cornerClose.style.color = "#ffffff";
      cornerClose.style.width = "40px";
      cornerClose.style.height = "40px";
      cornerClose.style.minWidth = "40px";
      cornerClose.style.borderRadius = "14px";
      cornerClose.style.cursor = "pointer";
      cornerClose.style.fontSize = "26px";
      cornerClose.style.fontWeight = "700";
      cornerClose.style.lineHeight = "1";
      cornerClose.style.display = "flex";
      cornerClose.style.alignItems = "center";
      cornerClose.style.justifyContent = "center";

      const progressWrap = document.createElement("div");
      progressWrap.style.height = "7px";
      progressWrap.style.width = "100%";
      progressWrap.style.background = "rgba(255,255,255,0.06)";

      const progress = document.createElement("div");
      progress.style.height = "100%";
      progress.style.width = "100%";
      progress.style.background = theme.progress;
      progress.style.transition = "width 6s linear";

      progressWrap.appendChild(progress);

      actions.appendChild(focusBtn);
      actions.appendChild(closeBtn);

      textWrap.appendChild(badge);
      textWrap.appendChild(title);
      textWrap.appendChild(body);
      textWrap.appendChild(helper);
      textWrap.appendChild(actions);

      content.appendChild(iconWrap);
      content.appendChild(textWrap);
      content.appendChild(cornerClose);

      card.appendChild(glow1);
      card.appendChild(glow2);
      card.appendChild(content);
      card.appendChild(progressWrap);

      wrap.appendChild(card);
      document.body.appendChild(wrap);

      requestAnimationFrame(() => {
        wrap.style.transform = "translate(-50%, 0) scale(1)";
        wrap.style.opacity = "1";
      });

      setTimeout(() => {
        progress.style.width = "0%";
      }, 80);

      let removed = false;

      function dismiss() {
        if (removed) return;
        removed = true;
        wrap.style.transform = "translate(-50%, -145%) scale(0.95)";
        wrap.style.opacity = "0";
        setTimeout(() => {
          if (wrap.parentNode) wrap.remove();
        }, 380);
      }

      focusBtn.onclick = () => {
        if (type === "danger") {
          showBlockedScreen("Your danger threshold has been crossed. Leave this page and reset your focus.");
        } else {
          dismiss();
        }
      };

      closeBtn.onclick = dismiss;
      cornerClose.onclick = dismiss;
    });
  }

  async function getStoredExtensionConfig() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["backendUrl", "extensionToken"], (data) => {
          resolve({
            backendUrl: data.backendUrl || "",
            extensionToken: data.extensionToken || "",
          });
        });
      } catch (error) {
        resolve({ backendUrl: "", extensionToken: "" });
      }
    });
  }

  async function checkLiveSessionStatusExactly() {
    try {
      const { backendUrl, extensionToken } = await getStoredExtensionConfig();

      if (!backendUrl || !extensionToken) return;
      if (document.hidden) return;

      const response = await fetch(`${backendUrl}/live-session/status`, {
        method: "GET",
        headers: {
          "x-extension-token": extensionToken,
        },
      });

      const data = await response.json();
      if (!data.success) return;

      if (!data.active) {
        liveWarningShown = false;
        liveDangerShown = false;
        lastLiveSessionStartedAt = null;
        return;
      }

      if (data.startedAt && data.startedAt !== lastLiveSessionStartedAt) {
        lastLiveSessionStartedAt = data.startedAt;
        liveWarningShown = false;
        liveDangerShown = false;
        removeExistingAlert();
        console.log("New exact live session detected");
      }

      if (data.dangerTriggered && !liveDangerShown) {
        liveDangerShown = true;
        showPageAlert(
          `🚨 Danger: Live session reached ${data.elapsedMinutes} min`,
          "danger"
        );
        return;
      }

      if (data.warningTriggered && !liveWarningShown) {
        liveWarningShown = true;
        showPageAlert(
          `⚠ Warning: Live session reached ${data.elapsedMinutes} min`,
          "warning"
        );
      }
    } catch (error) {
      console.log("Exact live session check skipped:", error);
    }
  }

  function startLiveSessionMonitor() {
    if (liveSessionMonitorInterval) {
      clearInterval(liveSessionMonitorInterval);
    }

    checkLiveSessionStatusExactly();
    liveSessionMonitorInterval = setInterval(checkLiveSessionStatusExactly, 1000);
  }

  function notifyPageReady() {
    try {
      chrome.runtime.sendMessage({
        type: "CONTENT_READY",
        url: location.href,
      });
    } catch (error) {
      console.log("CONTENT_READY send skipped:", error);
    }
  }

  function handleUrlChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    removeExistingAlert();
    notifyPageReady();
  }

  function installSpaNavigationHooks() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      setTimeout(handleUrlChange, 50);
      return result;
    };

    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments);
      setTimeout(handleUrlChange, 50);
      return result;
    };

    window.addEventListener("popstate", () => {
      setTimeout(handleUrlChange, 50);
    });

    document.addEventListener("yt-navigate-finish", () => {
      setTimeout(handleUrlChange, 50);
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "PING_CONTENT") {
      sendResponse({ ok: true, url: location.href });
      return true;
    }

    if (message?.type === "SHOW_PAGE_ALERT") {
      console.log("DAAT SHOW_PAGE_ALERT received:", message);
      showPageAlert(message.text, message.alertType || "warning");
      sendResponse({ ok: true, shown: true });
      return true;
    }

    if (message?.type === "BLOCK_CURRENT_PAGE") {
      showBlockedScreen(message.text || "This page has been blocked for your focus.");
      sendResponse({ ok: true, blocked: true });
      return true;
    }
  });

  installSpaNavigationHooks();
  notifyPageReady();
  tryBootstrapFromWebsite().finally(() => {
    startLiveSessionMonitor();
  });
})();