console.log("[AutoNav Background] Service worker loaded");

// ─── Utilities ──────────────────────────────────────────────────────────────
const Utils = (() => {
  function notifyPopup(data) {
    chrome.runtime.sendMessage({ type: "downloadEvent", data }).catch(() => {});
  }

  function createDownloadEntry(event, details) {
    return { event, ...details, timestamp: Date.now() };
  }

  return { notifyPopup, createDownloadEntry };
})();

// ─── State ──────────────────────────────────────────────────────────────────
let downloadMonitoringActive = false;
let downloadLog = [];

// ─── Message Handler Functions ──────────────────────────────────────────────

function handleDomExtracted(message) {
  console.log("[AutoNav Background] Content script extracted", message.count, "elements");
}

function handleContentMessage(message) {
  console.log("[AutoNav Background] Content says:", message.text);
}

function handleToggleDownloadMonitoring(message) {
  downloadMonitoringActive = message.enabled;
  console.log("[AutoNav Background] Download monitoring", message.enabled ? "ENABLED" : "DISABLED");
  return { active: downloadMonitoringActive };
}

function handleGetDownloadLog() {
  return { log: downloadLog, active: downloadMonitoringActive };
}

function handleDownloadCreated(downloadItem) {
  if (!downloadMonitoringActive) return;

  const entry = Utils.createDownloadEntry("created", {
    id: downloadItem.id,
    filename: downloadItem.filename || "pending",
    url: downloadItem.url || "unknown",
    bytesReceived: downloadItem.bytesReceived || 0,
    totalBytes: downloadItem.totalBytes || 0,
    mime: downloadItem.mime || "unknown",
    startTime: downloadItem.startTime,
    state: downloadItem.state
  });

  downloadLog.push(entry);
  console.log("[AutoNav Background] Download created:", entry);
  Utils.notifyPopup(entry);
}

function handleDownloadChanged(downloadDelta) {
  if (!downloadMonitoringActive) return;

  const entry = Utils.createDownloadEntry("changed", {
    id: downloadDelta.id,
    filename: downloadDelta.filename?.current || "unknown",
    state: downloadDelta.state?.current || "unknown",
    bytesReceived: downloadDelta.bytesReceived?.current || 0,
    totalBytes: downloadDelta.totalBytes?.current || 0,
    error: downloadDelta.error?.current || null
  });

  downloadLog.push(entry);
  console.log("[AutoNav Background] Download changed:", entry);
  Utils.notifyPopup(entry);
}

// ─── Event Listener Registrations ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[AutoNav Background] Received message:", message.type, message);

  const handlers = {
    domExtracted: handleDomExtracted,
    contentMessage: handleContentMessage,
    toggleDownloadMonitoring: handleToggleDownloadMonitoring,
    getDownloadLog: handleGetDownloadLog
  };

  const handler = handlers[message.type];
  if (handler) {
    const result = handler(message);
    if (result) sendResponse(result);
  }

  sendResponse({ status: "received" });
});

chrome.downloads.onCreated.addListener(handleDownloadCreated);
chrome.downloads.onChanged.addListener(handleDownloadChanged);
