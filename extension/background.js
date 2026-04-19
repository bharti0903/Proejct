const FLUSH_ALARM = "flushTracking";
const SUMMARY_ALARM = "refreshFocusSummary";
const LIVE_SESSION_ALARM = "liveSessionCheck";
const MIN_MINUTES_TO_SAVE = 0.01;
const IDLE_THRESHOLD_SECONDS = 60;

let currentTabId = null;
let currentTabStart = null;
let currentTabData = null;
let browserFocused = true;
let userIdleState = "active";
let latestSummary = {
  focusMode: {
    active: false,
    blockedSites: [],
    remainingMs: 0,
  },
};

let liveWarningShown = false;
let liveDangerShown = false;
let lastLiveSessionStartedAt = null;

function createAlarms() {
  chrome.alarms.clear(FLUSH_ALARM, () => {
    chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.05 });
  });

  chrome.alarms.clear(SUMMARY_ALARM, () => {
    chrome.alarms.create(SUMMARY_ALARM, { periodInMinutes: 1 });
  });

  chrome.alarms.clear(LIVE_SESSION_ALARM, () => {
    chrome.alarms.create(LIVE_SESSION_ALARM, { periodInMinutes: 0.05 });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  createAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  createAlarms();
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  userIdleState = newState;

  if (newState === "idle" || newState === "locked") {
    await flushCurrentTab({ resetAfterFlush: false });
  } else if (newState === "active") {
    captureActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const isFocused = windowId !== chrome.windows.WINDOW_ID_NONE;

  if (!isFocused) {
    browserFocused = false;
    await flushCurrentTab({ resetAfterFlush: false });
  } else {
    browserFocused = true;
    captureActiveTab();
  }
});

chrome.tabs.onActivated.addListener(async () => {
  await flushCurrentTab({ resetAfterFlush: true });
  captureActiveTab();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    await enforceFocusModeOnTab(tab);
    await flushCurrentTab({ resetAfterFlush: true });
    captureActiveTab();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    await flushCurrentTab({ resetAfterFlush: false });
  }

  if (alarm.name === SUMMARY_ALARM) {
    await refreshTodaySummary().catch((error) => {
      console.log("refreshTodaySummary error:", error);
    });
  }

  if (alarm.name === LIVE_SESSION_ALARM) {
    await checkLiveSessionAlerts();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_TODAY_SUMMARY") {
    refreshTodaySummary()
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "Failed to fetch summary",
        })
      );

    return true;
  }

  if (message?.type === "CONTENT_READY") {
    console.log("Content ready on:", message.url);
    sendResponse({ success: true });
    return true;
  }
});

function shouldIgnoreUrl(url) {
  if (!url) return true;

  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("moz-extension://") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
}

function resetCurrentTab() {
  currentTabId = null;
  currentTabStart = null;
  currentTabData = null;
}

async function captureActiveTab() {
  if (!browserFocused) return;
  if (userIdleState !== "active") return;

  try {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tabs || !tabs.length) return;

    const tab = tabs[0];
    if (!tab.id || !tab.url) return;

    if (shouldIgnoreUrl(tab.url)) {
      resetCurrentTab();
      return;
    }

    await enforceFocusModeOnTab(tab);

    const parsedUrl = new URL(tab.url);

    currentTabId = tab.id;
    currentTabStart = Date.now();
    currentTabData = {
      title: tab.title || "",
      url: tab.url || "",
      domain: parsedUrl.hostname || "",
    };
  } catch (error) {
    console.log("captureActiveTab error:", error);
  }
}

async function pingContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "PING_CONTENT",
    });
    return Boolean(response?.ok);
  } catch (error) {
    return false;
  }
}

async function ensureContentScriptReady(tabId) {
  let ready = await pingContentScript(tabId);
  if (ready) return true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    console.log("Manual content injection failed:", error);
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
  ready = await pingContentScript(tabId);
  return ready;
}

async function showPageAlertOnTab(tabId, text, alertType) {
  if (!tabId) return;

  const ready = await ensureContentScriptReady(tabId);
  if (!ready) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_PAGE_ALERT",
      text,
      alertType,
    });
  } catch (error) {
    console.log("SHOW_PAGE_ALERT send failed:", error);
  }
}

async function blockCurrentPageOnTab(tabId, text) {
  if (!tabId) return;

  const ready = await ensureContentScriptReady(tabId);
  if (!ready) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "BLOCK_CURRENT_PAGE",
      text,
    });
  } catch (error) {
    console.log("BLOCK_CURRENT_PAGE send failed:", error);
  }
}

async function checkLiveSessionAlerts() {
  try {
    const { backendUrl, extensionToken } = await chrome.storage.local.get([
      "backendUrl",
      "extensionToken",
    ]);

    if (!backendUrl || !extensionToken) {
      console.log("Missing backend URL or extension token");
      return;
    }

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
      console.log("New live session detected, reset alert flags");
    }

    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tabs || !tabs.length) return;

    const activeTab = tabs[0];
    if (!activeTab.id || !activeTab.url || shouldIgnoreUrl(activeTab.url)) return;

    if (data.dangerTriggered && !liveDangerShown) {
      liveDangerShown = true;

      await showPageAlertOnTab(
        activeTab.id,
        `🚨 Danger: Live session limit crossed at ${data.elapsedMinutes} min`,
        "danger"
      );

      await blockCurrentPageOnTab(
        activeTab.id,
        "Your live session crossed the danger limit. This page is blocked to protect your focus."
      );
    } else if (data.warningTriggered && !liveWarningShown) {
      liveWarningShown = true;

      await showPageAlertOnTab(
        activeTab.id,
        `⚠ Warning: Live session reached ${data.elapsedMinutes} min`,
        "warning"
      );
    }
  } catch (error) {
    console.log("checkLiveSessionAlerts error:", error);
  }
}

async function flushCurrentTab({ resetAfterFlush = false } = {}) {
  try {
    if (!currentTabId || !currentTabStart || !currentTabData) return;

    if (shouldIgnoreUrl(currentTabData.url)) {
      resetCurrentTab();
      return;
    }

    const now = Date.now();
    const durationMs = now - currentTabStart;
    const minutes = durationMs / 1000 / 60;

    if (minutes < MIN_MINUTES_TO_SAVE) {
      return;
    }

    const trackedTabId = currentTabId;

    const { backendUrl, extensionToken } = await chrome.storage.local.get([
      "backendUrl",
      "extensionToken",
    ]);

    if (!backendUrl || !extensionToken) {
      return;
    }

    const response = await fetch(`${backendUrl}/extension/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-token": extensionToken,
      },
      body: JSON.stringify({
        minutes: Number(minutes.toFixed(4)),
        domain: currentTabData.domain,
        title: currentTabData.title,
        url: currentTabData.url,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (data?.alert?.dangerTriggered) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png",
        title: "Danger Limit Reached",
        message: `You crossed your danger threshold. Today: ${
          data.alert.todayTotalFormatted || "N/A"
        }`,
      });

      await showPageAlertOnTab(
        trackedTabId,
        `🚨 Danger: Limit crossed. Today: ${
          data.alert.todayTotalFormatted || "N/A"
        }`,
        "danger"
      );

      await blockCurrentPageOnTab(
        trackedTabId,
        "You crossed your danger limit. This page is now blocked to protect your focus."
      );
    } else if (data?.alert?.warningTriggered) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png",
        title: "Warning Limit Reached",
        message: `You reached your warning threshold. Today: ${
          data.alert.todayTotalFormatted || "N/A"
        }`,
      });

      await showPageAlertOnTab(
        trackedTabId,
        `⚠ Warning: Approaching limit. Today: ${
          data.alert.todayTotalFormatted || "N/A"
        }`,
        "warning"
      );
    }

    if (resetAfterFlush) {
      resetCurrentTab();
    } else {
      currentTabStart = now;
    }
  } catch (error) {
    console.log("flushCurrentTab error:", error);
  }
}

async function refreshTodaySummary() {
  const { backendUrl, extensionToken } = await chrome.storage.local.get([
    "backendUrl",
    "extensionToken",
  ]);

  if (!backendUrl || !extensionToken) {
    throw new Error("Missing backend URL or extension token");
  }

  const response = await fetch(`${backendUrl}/extension/today-summary`, {
    method: "GET",
    headers: {
      "x-extension-token": extensionToken,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to fetch summary");
  }

  latestSummary = data;
  return data;
}

async function enforceFocusModeOnTab(tab) {
  try {
    const summary = await refreshTodaySummary().catch(() => latestSummary);

    if (!summary?.focusMode?.active) return;
    if (!tab?.url || shouldIgnoreUrl(tab.url)) return;

    const hostname = new URL(tab.url).hostname.toLowerCase();
    const blockedSites = Array.isArray(summary.focusMode.blockedSites)
      ? summary.focusMode.blockedSites
      : [];

    const shouldBlock = blockedSites.some(
      (site) => hostname === site || hostname.endsWith(`.${site}`)
    );

    if (!shouldBlock) return;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title: "Focus Mode Active",
      message: "This site is blocked during your focus session.",
    });

    await chrome.tabs.update(tab.id, {
      url:
        "data:text/html;charset=utf-8," +
        encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Focus Mode Active</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
              background: #020617;
              color: #e2e8f0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .box {
              max-width: 650px;
              background: rgba(15, 23, 42, 0.92);
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 24px;
              padding: 32px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            }
            h1 {
              margin-top: 0;
              font-size: 32px;
            }
            p {
              color: #cbd5e1;
              line-height: 1.7;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Focus Mode Active</h1>
            <p>This site is blocked during your current focus session.</p>
          </div>
        </body>
        </html>
      `),
    });
  } catch (error) {
    console.log("enforceFocusModeOnTab error:", error);
  }
}