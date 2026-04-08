console.log("[AutoNav Background] Service worker loaded");

// ─── Download Monitoring State ──────────────────────────────────────────────
let downloadMonitoringActive = false;
let downloadLog = [];

// ─── Message Router ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[AutoNav Background] Received message:", message.type, message);

  if (message.type === "domExtracted") {
    console.log("[AutoNav Background] Content script extracted", message.count, "elements");
  } else if (message.type === "contentMessage") {
    console.log("[AutoNav Background] Content says:", message.text);
  } else if (message.type === "toggleDownloadMonitoring") {
    downloadMonitoringActive = message.enabled;
    console.log("[AutoNav Background] Download monitoring", message.enabled ? "ENABLED" : "DISABLED");
    sendResponse({ active: downloadMonitoringActive });
  } else if (message.type === "getDownloadLog") {
    sendResponse({ log: downloadLog, active: downloadMonitoringActive });
  }

  sendResponse({ status: "received" });
});

// ─── Download Listeners ─────────────────────────────────────────────────────
chrome.downloads.onCreated.addListener((downloadItem) => {
  if (!downloadMonitoringActive) return;

  const entry = {
    event: "created",
    id: downloadItem.id,
    filename: downloadItem.filename || "pending",
    url: downloadItem.url || "unknown",
    bytesReceived: downloadItem.bytesReceived || 0,
    totalBytes: downloadItem.totalBytes || 0,
    mime: downloadItem.mime || "unknown",
    startTime: downloadItem.startTime,
    state: downloadItem.state
  };

  downloadLog.push(entry);
  console.log("[AutoNav Background] Download created:", entry);

  // Notify all open popups
  chrome.runtime.sendMessage({
    type: "downloadEvent",
    data: entry
  }).catch(() => {}); // Ignore if no popup open
});

chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (!downloadMonitoringActive) return;

  const entry = {
    event: "changed",
    id: downloadDelta.id,
    filename: downloadDelta.filename?.current || "unknown",
    state: downloadDelta.state?.current || "unknown",
    bytesReceived: downloadDelta.bytesReceived?.current || 0,
    totalBytes: downloadDelta.totalBytes?.current || 0,
    error: downloadDelta.error?.current || null,
    timestamp: Date.now()
  };

  downloadLog.push(entry);
  console.log("[AutoNav Background] Download changed:", entry);

  // Notify all open popups
  chrome.runtime.sendMessage({
    type: "downloadEvent",
    data: entry
  }).catch(() => {}); // Ignore if no popup open
});
