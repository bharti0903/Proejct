const todayTotalEl = document.getElementById("todayTotal");
const sessionCountEl = document.getElementById("sessionCount");
const topCategoryEl = document.getElementById("topCategory");
const usageStatusEl = document.getElementById("usageStatus");
const focusStatusEl = document.getElementById("focusStatus");
const focusRemainingEl = document.getElementById("focusRemaining");
const blockedCountEl = document.getElementById("blockedCount");
const errorMsgEl = document.getElementById("errorMsg");
const refreshBtn = document.getElementById("refreshBtn");

const liveAlertCard = document.getElementById("liveAlertCard");
const liveAlertBadge = document.getElementById("liveAlertBadge");
const liveAlertTitle = document.getElementById("liveAlertTitle");
const liveAlertMessage = document.getElementById("liveAlertMessage");
const liveAlertClose = document.getElementById("liveAlertClose");

let remainingMs = 0;
let timerInterval = null;

function formatRemaining(ms) {
  if (!ms || ms <= 0) return "0m 0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function setError(message) {
  errorMsgEl.textContent = message || "";
}

function startCountdown() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (remainingMs <= 0) {
      focusRemainingEl.textContent = "0m 0s";
      clearInterval(timerInterval);
      return;
    }

    remainingMs -= 1000;
    focusRemainingEl.textContent = formatRemaining(remainingMs);
  }, 1000);
}

function hideLiveAlert() {
  liveAlertCard.classList.add("hidden");
}

function showLiveAlert({ type = "info", title = "Notification", message = "" }) {
  liveAlertCard.className = "notification-card";
  liveAlertCard.classList.add(type);

  liveAlertBadge.textContent =
    type === "danger" ? "Danger" :
    type === "warning" ? "Warning" : "Info";

  liveAlertTitle.textContent = title;
  liveAlertMessage.textContent = message;
}

function renderSummary(data) {
  const summary = data.summary || {};
  const focusMode = data.focusMode || { active: false, blockedSites: [], remainingMs: 0 };

  todayTotalEl.textContent = summary.todayTotalFormatted || "--";
  sessionCountEl.textContent = summary.sessionCount ?? "--";
  topCategoryEl.textContent = summary.topCategory || "--";
  usageStatusEl.textContent = summary.usageStatus || "--";

  if (focusMode.active) {
    focusStatusEl.textContent = "Active";
    focusStatusEl.className = "status focus-active";
    remainingMs = Number(focusMode.remainingMs || 0);
    focusRemainingEl.textContent = formatRemaining(remainingMs);
    blockedCountEl.textContent = Array.isArray(focusMode.blockedSites)
      ? focusMode.blockedSites.length
      : 0;
    startCountdown();
  } else {
    focusStatusEl.textContent = "Inactive";
    focusStatusEl.className = "status focus-inactive";
    focusRemainingEl.textContent = "--";
    blockedCountEl.textContent = "0";
    if (timerInterval) clearInterval(timerInterval);
  }

  if (summary.usageStatus === "Limit Reached") {
    showLiveAlert({
      type: "danger",
      title: "Danger Limit Reached",
      message: `Today's usage is ${summary.todayTotalFormatted || "--"}. Close distracting sites and take a break.`,
    });
  } else if (summary.usageStatus === "Approaching Limit") {
    showLiveAlert({
      type: "warning",
      title: "Warning Limit Reached",
      message: `You're close to your daily limit. Today's usage is ${summary.todayTotalFormatted || "--"}.`,
    });
  } else {
    hideLiveAlert();
  }
}

async function loadSummary() {
  setError("");

  chrome.runtime.sendMessage({ type: "GET_TODAY_SUMMARY" }, (response) => {
    if (chrome.runtime.lastError) {
      setError(chrome.runtime.lastError.message);
      return;
    }

    if (!response || !response.success) {
      setError(response?.error || "Failed to load summary");
      return;
    }

    renderSummary(response.data);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadSummary();
  liveAlertClose.addEventListener("click", hideLiveAlert);
});

refreshBtn.addEventListener("click", loadSummary);