const FLUSH_ALARM = "flushTracking";
const SUMMARY_ALARM = "refreshFocusSummary";
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  chrome.alarms.create(SUMMARY_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  chrome.alarms.create(SUMMARY_ALARM, { periodInMinutes: 1 });
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  userIdleState = newState;

  if (newState === "idle" || newState === "locked") {
    await flushCurrentTab();
  } else if (newState === "active") {
    captureActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const isFocused = windowId !== chrome.windows.WINDOW_ID_NONE;

  if (!isFocused) {
    browserFocused = false;
    await flushCurrentTab();
  } else {
    browserFocused = true;
    captureActiveTab();
  }
});

chrome.tabs.onActivated.addListener(async () => {
  await flushCurrentTab();
  captureActiveTab();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    await enforceFocusModeOnTab(tab);
    await flushCurrentTab();
    captureActiveTab();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    await flushCurrentTab();
    captureActiveTab();
  }

  if (alarm.name === SUMMARY_ALARM) {
    await refreshTodaySummary();
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
});

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

async function flushCurrentTab() {
  try {
    if (!currentTabId || !currentTabStart || !currentTabData) return;
    if (shouldIgnoreUrl(currentTabData.url)) {
      resetCurrentTab();
      return;
    }

    const durationMs = Date.now() - currentTabStart;
    const minutes = durationMs / 1000 / 60;

    if (minutes < MIN_MINUTES_TO_SAVE) {
      resetCurrentTab();
      return;
    }

    const { backendUrl, extensionToken } = await chrome.storage.local.get([
      "backendUrl",
      "extensionToken",
    ]);

    if (!backendUrl || !extensionToken) {
      resetCurrentTab();
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
        message: `You crossed your danger threshold. Today: ${data.alert.todayTotalFormatted || "N/A"}`,
      });
    } else if (data?.alert?.warningTriggered) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png",
        title: "Warning Limit Reached",
        message: `You reached your warning threshold. Today: ${data.alert.todayTotalFormatted || "N/A"}`,
      });
    }
  } catch (error) {
    console.log("flushCurrentTab error:", error);
  } finally {
    resetCurrentTab();
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
      url: "data:text/html;charset=utf-8," + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Focus Mode Active</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f8fafc; color: #0f172a; }
            .box { max-width: 650px; margin: 60px auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
            h1 { margin-bottom: 12px; }
            p { color: #475569; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Focus Mode Active</h1>
            <p>This website is blocked during your current focus session.</p>
            <p>Go back to your productive work and finish strong.</p>
          </div>
        </body>
        </html>
      `),
    });
  } catch (error) {
    console.log("enforceFocusModeOnTab error:", error);
  }
}

function shouldIgnoreUrl(url) {
  if (!url) return true;

  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:") ||
    url.startsWith("data:")
  );
}

function resetCurrentTab() {
  currentTabId = null;
  currentTabStart = null;
  currentTabData = null;
}

captureActiveTab();