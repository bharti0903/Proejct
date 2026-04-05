const backendUrlInput = document.getElementById("backendUrl");
const extensionTokenInput = document.getElementById("extensionToken");
const msg = document.getElementById("msg");
const saveBtn = document.getElementById("saveBtn");

function showMessage(text, isSuccess) {
  msg.textContent = text;
  msg.className = "msg " + (isSuccess ? "success" : "error");
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    chrome.storage.local.get(["backendUrl", "extensionToken"], (data) => {
      if (chrome.runtime.lastError) {
        showMessage("Load failed: " + chrome.runtime.lastError.message, false);
        return;
      }

      backendUrlInput.value = data.backendUrl || "http://localhost:5002";
      extensionTokenInput.value = data.extensionToken || "";
    });
  } catch (error) {
    showMessage(
      "Chrome API not available. Open this page from the extension options.",
      false
    );
  }
});

saveBtn.addEventListener("click", () => {
  const backendUrl = backendUrlInput.value.trim();
  const extensionToken = extensionTokenInput.value.trim();

  if (!backendUrl) {
    showMessage("Backend URL is required", false);
    return;
  }

  if (!extensionToken) {
    showMessage("Extension token is required", false);
    return;
  }

  try {
    chrome.storage.local.set(
      {
        backendUrl,
        extensionToken,
      },
      () => {
        if (chrome.runtime.lastError) {
          showMessage("Save failed: " + chrome.runtime.lastError.message, false);
          return;
        }

        showMessage("Saved successfully", true);
      }
    );
  } catch (error) {
    showMessage("Save failed. Open this page from the extension options.", false);
  }
});