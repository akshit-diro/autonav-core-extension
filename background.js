// ─── State ──────────────────────────────────────────────────────────────────
const State = {
  downloadMonitoringActive: false,
  downloadLog: []
};

// ─── Utils ──────────────────────────────────────────────────────────────────
const Utils = (() => {
  function notifyPopup(data) {
    chrome.runtime.sendMessage({ type: "downloadEvent", data }).catch(() => {});
  }

  function createDownloadEntry(event, details) {
    return { event, ...details, timestamp: Date.now() };
  }

  return { notifyPopup, createDownloadEntry };
})();

// ─── Handlers ───────────────────────────────────────────────────────────────
const Handlers = (() => {
  function handleDomExtracted(message) {
    console.log("[AutoNav Background] Content script extracted", message.count, "elements");
  }

  function handleContentMessage(message) {
    console.log("[AutoNav Background] Content says:", message.text);
  }

  function handleToggleDownloadMonitoring(message) {
    State.downloadMonitoringActive = message.enabled;
    console.log("[AutoNav Background] Download monitoring", message.enabled ? "ENABLED" : "DISABLED");
    return { active: State.downloadMonitoringActive };
  }

  function handleGetDownloadLog() {
    return { log: State.downloadLog, active: State.downloadMonitoringActive };
  }

  function handleDownloadCreated(downloadItem) {
    if (!State.downloadMonitoringActive) return;

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

    State.downloadLog.push(entry);
    console.log("[AutoNav Background] Download created:", entry);
    Utils.notifyPopup(entry);
  }

  function handleDownloadChanged(downloadDelta) {
    if (!State.downloadMonitoringActive) return;

    const entry = Utils.createDownloadEntry("changed", {
      id: downloadDelta.id,
      filename: downloadDelta.filename?.current || "unknown",
      state: downloadDelta.state?.current || "unknown",
      bytesReceived: downloadDelta.bytesReceived?.current || 0,
      totalBytes: downloadDelta.totalBytes?.current || 0,
      error: downloadDelta.error?.current || null
    });

    State.downloadLog.push(entry);
    console.log("[AutoNav Background] Download changed:", entry);
    Utils.notifyPopup(entry);
  }

  return {
    handleDomExtracted, handleContentMessage,
    handleToggleDownloadMonitoring, handleGetDownloadLog,
    handleDownloadCreated, handleDownloadChanged
  };
})();

// ─── Listeners ──────────────────────────────────────────────────────────────
const Listeners = (() => {
  const messageHandlerMap = {
    domExtracted: Handlers.handleDomExtracted,
    contentMessage: Handlers.handleContentMessage,
    toggleDownloadMonitoring: Handlers.handleToggleDownloadMonitoring,
    getDownloadLog: Handlers.handleGetDownloadLog
  };

  function init() {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    chrome.downloads.onCreated.addListener(Handlers.handleDownloadCreated);
    chrome.downloads.onChanged.addListener(Handlers.handleDownloadChanged);
  }

  function onRuntimeMessage(message, sender, sendResponse) {
    console.log("[AutoNav Background] Received message:", message.type, message);

    const handler = messageHandlerMap[message.type];
    if (handler) {
      const result = handler(message);
      if (result) sendResponse(result);
    }

    sendResponse({ status: "received" });
  }

  return { init };
})();

// ─── Init ───────────────────────────────────────────────────────────────────
console.log("[AutoNav Background] Service worker loaded");
Listeners.init();
