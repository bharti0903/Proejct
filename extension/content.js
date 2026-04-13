(function () {
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
    } catch (error) {
      console.log("Bootstrap sync skipped:", error);
    }
  }

  function showPageAlert(message, type = "warning") {
    const existing = document.getElementById("daat-page-alert");
    if (existing) existing.remove();

    const alertBox = document.createElement("div");
    alertBox.id = "daat-page-alert";
    alertBox.textContent = message;

    const bg =
      type === "danger" ? "#dc2626" :
      type === "warning" ? "#f59e0b" :
      "#2563eb";

    alertBox.style.position = "fixed";
    alertBox.style.top = "20px";
    alertBox.style.right = "20px";
    alertBox.style.zIndex = "999999";
    alertBox.style.padding = "14px 18px";
    alertBox.style.borderRadius = "12px";
    alertBox.style.background = bg;
    alertBox.style.color = "white";
    alertBox.style.fontSize = "14px";
    alertBox.style.fontWeight = "700";
    alertBox.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
    alertBox.style.maxWidth = "340px";

    document.body.appendChild(alertBox);

    setTimeout(() => {
      alertBox.remove();
    }, 5000);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "SHOW_PAGE_ALERT") {
      showPageAlert(message.text, message.alertType || "warning");
    }
  });

  tryBootstrapFromWebsite();
})();