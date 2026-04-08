// ─── Config ─────────────────────────────────────────────────────────────────
const Config = {
  get elements() {
    return [
      "domBtn", "screenshotBtn", "messageBtn", "getBtn", "postBtn",
      "loadPopupBtn", "clickBtn", "fillBtn", "fillValue",
      "fillElementDropdown", "refreshFillElementsBtn", "elementDropdown",
      "refreshElementsBtn", "apiUrl", "saveBtn", "logArea",
      "downloadMonitorBtn", "status"
    ];
  },
  defaultApiUrl: "https://httpbin.org/get",
  screenshotFormat: "png",
  logSnippetLength: 150,
  sampleSnippetLength: 100
};

// ─── State ──────────────────────────────────────────────────────────────────
const State = {
  downloadMonitoringActive: false
};

// ─── Utils ──────────────────────────────────────────────────────────────────
const Utils = (() => {
  let statusEl, logArea;

  function init(statusElement, logElement) {
    statusEl = statusElement;
    logArea = logElement;
  }

  function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  function log(message, section = null) {
    if (!logArea) return;
    const separator = section ? `\n======== [${section}] ========\n` : "";
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `${separator}[${timestamp}] ${message}`;
    logArea.textContent += logLine;
    logArea.scrollTop = logArea.scrollHeight;
    console.log(`[AutoNav]${section ? " [" + section + "]" : ""}`, message);
  }

  async function getConfig() {
    const result = await chrome.storage.local.get(["apiUrl"]);
    return result.apiUrl || Config.defaultApiUrl;
  }

  async function setConfig(data) {
    await chrome.storage.local.set(data);
  }

  async function withButton(btn, section, asyncFn) {
    try {
      btn.disabled = true;
      await asyncFn();
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Error: " + error.message, section);
    } finally {
      btn.disabled = false;
    }
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 ? tabs[0] : null;
  }

  async function injectAndMessage(tabId, message) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tabId, message);
  }

  function populateDropdown(selectEl, elements, valueFn, textFn, emptyMsg) {
    selectEl.innerHTML = "";
    if (elements && elements.length > 0) {
      elements.forEach((el, i) => {
        const option = document.createElement("option");
        option.value = valueFn(el, i);
        option.textContent = textFn(el, i);
        selectEl.appendChild(option);
      });
    } else {
      selectEl.innerHTML = `<option value="">-- ${emptyMsg} --</option>`;
    }
  }

  return { init, setStatus, log, getConfig, setConfig, withButton, getActiveTab, injectAndMessage, populateDropdown };
})();

// ─── DOM ────────────────────────────────────────────────────────────────────
const DOM = (() => {
  const cache = {};

  function init() {
    Config.elements.forEach((id) => {
      cache[id] = document.getElementById(id);
    });
  }

  function get(key) {
    return cache[key];
  }

  return { init, get };
})();

// ─── Handlers ───────────────────────────────────────────────────────────────
const Handlers = (() => {
  async function handleExtractDom() {
    Utils.withButton(DOM.get("domBtn"), "DOM EXTRACT", async () => {
      Utils.setStatus("Extracting elements...", "info");
      Utils.log("Triggering DOM extraction in content script...", "DOM EXTRACT");
      const tab = await Utils.getActiveTab();
      const response = await Utils.injectAndMessage(tab.id, { type: "extractDom" });
      if (response && response.count) {
        Utils.setStatus(`Extracted ${response.count} elements`, "success");
        Utils.log(`Received ${response.count} interactive elements`, "DOM EXTRACT");
        Utils.log(`Sample: ${JSON.stringify(response.sample).substring(0, Config.sampleSnippetLength)}...`, "DOM EXTRACT");
      } else {
        Utils.setStatus("No response from content script", "error");
        Utils.log("No response received", "DOM EXTRACT");
      }
    });
  }

  async function handleScreenshot() {
    Utils.withButton(DOM.get("screenshotBtn"), "SCREENSHOT", async () => {
      Utils.setStatus("Capturing screenshot...", "info");
      Utils.log("Capturing visible tab screenshot...", "SCREENSHOT");
      const dataUrl = await chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: Config.screenshotFormat });
      const base64 = dataUrl.split(",")[1];
      await Utils.setConfig({ screenshotBase64: base64 });
      Utils.setStatus(`Screenshot saved (${base64.length} chars)`, "success");
      Utils.log(`Screenshot captured: ${base64.length} base64 chars stored in chrome.storage.local`, "SCREENSHOT");
    });
  }

  async function handleSendContentMessage() {
    Utils.withButton(DOM.get("messageBtn"), "CONTENT MSG", async () => {
      Utils.setStatus("Sending message to content script...", "info");
      Utils.log("Requesting content script to send message back...", "CONTENT MSG");
      const tab = await Utils.getActiveTab();
      await Utils.injectAndMessage(tab.id, { type: "sendMessageToBackground" });
      Utils.setStatus("Message sent! Check logs.", "success");
      Utils.log("Content script will now send message to background", "CONTENT MSG");
    });
  }

  async function handleGetRequest() {
    Utils.withButton(DOM.get("getBtn"), "GET REQUEST", async () => {
      const url = DOM.get("apiUrl").value || Config.defaultApiUrl;
      Utils.setStatus(`GET ${url}...`, "info");
      Utils.log(`Making GET request to: ${url}`, "GET REQUEST");
      const response = await fetch(url);
      const data = await response.json();
      Utils.setStatus("GET request successful", "success");
      Utils.log(`Response: ${JSON.stringify(data).substring(0, Config.logSnippetLength)}...`, "GET REQUEST");
    });
  }

  async function handlePostRequest() {
    Utils.withButton(DOM.get("postBtn"), "POST REQUEST", async () => {
      const url = DOM.get("apiUrl").value || "https://httpbin.org/post";
      Utils.setStatus(`POST ${url}...`, "info");
      Utils.log(`Making POST request to: ${url}`, "POST REQUEST");
      const payload = { timestamp: Date.now(), message: "Hello from extension", screenshotStored: true };
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      Utils.setStatus("POST request successful", "success");
      Utils.log(`Response: ${JSON.stringify(data).substring(0, Config.logSnippetLength)}...`, "POST REQUEST");
    });
  }

  async function handleLoadPopup() {
    Utils.withButton(DOM.get("loadPopupBtn"), "LOAD POPUP", async () => {
      Utils.setStatus("Opening overlay...", "info");
      Utils.log("Injecting page overlay...", "LOAD POPUP");
      const tab = await Utils.getActiveTab();
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: Overlay.show });
      Utils.setStatus("Overlay displayed on page", "success");
      Utils.log("Overlay injected into page DOM", "LOAD POPUP");
    });
  }

  async function handleRefreshElements() {
    Utils.withButton(DOM.get("refreshElementsBtn"), "REFRESH", async () => {
      Utils.setStatus("Scanning page elements...", "info");
      Utils.log("Extracting interactive elements for dropdown...", "REFRESH");
      const tab = await Utils.getActiveTab();
      const response = await Utils.injectAndMessage(tab.id, { type: "getElementsList" });
      Utils.populateDropdown(
        DOM.get("elementDropdown"),
        response?.elements || [],
        (el, i) => JSON.stringify({ index: i, id: el.id, selector: el.selector }),
        (el) => el.label,
        "No elements found"
      );
      if (response?.elements?.length > 0) {
        Utils.setStatus(`Loaded ${response.elements.length} elements`, "success");
        Utils.log(`Dropdown populated with ${response.elements.length} elements`, "REFRESH");
      } else {
        Utils.setStatus("No interactive elements found", "error");
        Utils.log("Page has no interactive elements", "REFRESH");
      }
    });
  }

  async function handleClickElement() {
    Utils.withButton(DOM.get("clickBtn"), "CLICK", async () => {
      const selected = DOM.get("elementDropdown").value;
      if (!selected) {
        Utils.setStatus("Select an element first (click Refresh)", "error");
        Utils.log("No element selected", "CLICK");
        return;
      }
      const target = JSON.parse(selected);
      Utils.setStatus(`Clicking element (index ${target.index})...`, "info");
      Utils.log(`Clicking element: index=${target.index}`, "CLICK");
      const tab = await Utils.getActiveTab();
      const response = await chrome.tabs.sendMessage(tab.id, { type: "clickByIndex", index: target.index });
      if (response?.success) {
        Utils.setStatus(`Clicked: ${response.description}`, "success");
        Utils.log(`Successfully clicked: ${response.description}`, "CLICK");
      } else {
        Utils.setStatus("Click failed: " + (response?.error || "unknown"), "error");
        Utils.log(`Click failed: ${response?.error}`, "CLICK");
      }
    });
  }

  async function handleRefreshFillElements() {
    Utils.withButton(DOM.get("refreshFillElementsBtn"), "REFILL", async () => {
      Utils.setStatus("Scanning page textboxes...", "info");
      Utils.log("Extracting fillable elements for dropdown...", "REFILL");
      const tab = await Utils.getActiveTab();
      const response = await Utils.injectAndMessage(tab.id, { type: "getFillElementsList" });
      Utils.populateDropdown(
        DOM.get("fillElementDropdown"),
        response?.elements || [],
        (el) => el.selector,
        (el) => el.label,
        "No textboxes found"
      );
      if (response?.elements?.length > 0) {
        Utils.setStatus(`Loaded ${response.elements.length} textboxes`, "success");
        Utils.log(`Fill dropdown populated with ${response.elements.length} textboxes`, "REFILL");
      } else {
        Utils.setStatus("No fillable textboxes found", "error");
        Utils.log("Page has no fillable textbox elements", "REFILL");
      }
    });
  }

  async function handleFillTextbox() {
    Utils.withButton(DOM.get("fillBtn"), "FILL", async () => {
      const selector = DOM.get("fillElementDropdown").value;
      const fillText = DOM.get("fillValue").value;
      if (!selector) {
        Utils.setStatus("Select a textbox first (click Refresh)", "error");
        Utils.log("No textbox selected", "FILL");
        return;
      }
      if (!fillText && fillText !== "") {
        Utils.setStatus("Enter text to fill", "error");
        Utils.log("No fill text provided", "FILL");
        return;
      }
      Utils.setStatus(`Filling textbox (${selector})...`, "info");
      Utils.log(`Filling textbox: selector="${selector}" with "${fillText}"`, "FILL");
      const tab = await Utils.getActiveTab();
      const response = await chrome.tabs.sendMessage(tab.id, { type: "fillBySelector", selector, text: fillText });
      if (response?.success) {
        Utils.setStatus(`Filled: ${response.description}`, "success");
        Utils.log(`Successfully filled: ${response.description}`, "FILL");
      } else {
        Utils.setStatus("Fill failed: " + (response?.error || "unknown"), "error");
        Utils.log(`Fill failed: ${response?.error}`, "FILL");
      }
    });
  }

  async function handleToggleDownloadMonitor() {
    Utils.withButton(DOM.get("downloadMonitorBtn"), "DOWNLOAD", async () => {
      const btn = DOM.get("downloadMonitorBtn");
      const response = await chrome.runtime.sendMessage({
        type: "toggleDownloadMonitoring",
        enabled: btn.textContent.includes("Enable")
      });
      State.downloadMonitoringActive = response.active;
      btn.textContent = State.downloadMonitoringActive
        ? "9. Disable Download Monitor"
        : "9. Enable Download Monitor";
      Utils.setStatus(`Download monitoring ${State.downloadMonitoringActive ? "ENABLED" : "DISABLED"}`, "success");
      Utils.log(`Download monitor ${State.downloadMonitoringActive ? "activated" : "deactivated"}`, "DOWNLOAD");
    });
  }

  async function handleSaveConfig() {
    await Utils.setConfig({ apiUrl: DOM.get("apiUrl").value });
    Utils.setStatus("Config saved", "success");
    Utils.log("Config saved: " + DOM.get("apiUrl").value, "SAVE CONFIG");
  }

  function handleDownloadEvent(message) {
    const d = message.data;
    if (d.event === "created") {
      Utils.log(`Download started: ${d.filename} (${(d.totalBytes / 1024).toFixed(1)}KB)`, "DOWNLOAD");
    } else if (d.event === "changed") {
      if (d.state === "complete") {
        Utils.log(`Download complete: ${d.filename}`, "DOWNLOAD");
      } else if (d.state === "interrupted") {
        Utils.log(`Download interrupted: ${d.filename}`, "DOWNLOAD");
      } else if (d.state === "in_progress") {
        Utils.log(`Download in progress: ${d.filename} (${((d.bytesReceived / d.totalBytes) * 100).toFixed(0)}%)`, "DOWNLOAD");
      }
    }
  }

  function handleContentMessage(message) {
    if (message.type === "domExtracted") {
      Utils.log(`Content script extracted: ${message.count} elements`, "ASYNC MSG");
    } else if (message.type === "contentMessage") {
      Utils.log(`Message from content: ${message.text}`, "ASYNC MSG");
    }
  }

  return {
    handleExtractDom, handleScreenshot, handleSendContentMessage,
    handleGetRequest, handlePostRequest, handleLoadPopup,
    handleRefreshElements, handleClickElement, handleRefreshFillElements,
    handleFillTextbox, handleToggleDownloadMonitor, handleSaveConfig,
    handleDownloadEvent, handleContentMessage
  };
})();

// ─── Listeners ──────────────────────────────────────────────────────────────
const Listeners = (() => {
  function init() {
    DOM.get("domBtn").addEventListener("click", Handlers.handleExtractDom);
    DOM.get("screenshotBtn").addEventListener("click", Handlers.handleScreenshot);
    DOM.get("messageBtn").addEventListener("click", Handlers.handleSendContentMessage);
    DOM.get("getBtn").addEventListener("click", Handlers.handleGetRequest);
    DOM.get("postBtn").addEventListener("click", Handlers.handlePostRequest);
    DOM.get("loadPopupBtn").addEventListener("click", Handlers.handleLoadPopup);
    DOM.get("refreshElementsBtn").addEventListener("click", Handlers.handleRefreshElements);
    DOM.get("clickBtn").addEventListener("click", Handlers.handleClickElement);
    DOM.get("refreshFillElementsBtn").addEventListener("click", Handlers.handleRefreshFillElements);
    DOM.get("fillBtn").addEventListener("click", Handlers.handleFillTextbox);
    DOM.get("downloadMonitorBtn").addEventListener("click", Handlers.handleToggleDownloadMonitor);
    DOM.get("saveBtn").addEventListener("click", Handlers.handleSaveConfig);

    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }

  function onRuntimeMessage(message, sender, sendResponse) {
    if (message.type === "downloadEvent") {
      Handlers.handleDownloadEvent(message);
    } else {
      Handlers.handleContentMessage(message);
    }
    sendResponse({ status: "received" });
  }

  return { init };
})();

// ─── Overlay ────────────────────────────────────────────────────────────────
const Overlay = (() => {
  function show() {
    const existing = document.getElementById("autonav-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "autonav-overlay";
    Object.assign(overlay.style, {
      position: "fixed", top: "20px", right: "20px",
      width: "400px", maxHeight: "80vh", background: "white",
      borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      zIndex: "2147483647",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: "hidden", display: "flex", flexDirection: "column"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "16px 20px",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white", display: "flex", justifyContent: "space-between", alignItems: "center"
    });
    header.innerHTML = `<h3 style="margin:0;font-size:16px;">Auto Nav - State</h3>
      <button id="overlay-close" style="background:rgba(255,255,255,0.2);border:none;color:white;
      width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;">×</button>`;

    const content = document.createElement("div");
    Object.assign(content.style, {
      padding: "20px", overflowY: "auto", fontSize: "13px", lineHeight: "1.6", color: "#333"
    });

    const pageData = {
      url: window.location.href, title: document.title,
      interactiveElements: document.querySelectorAll("INPUT,SELECT,A,BUTTON,TEXTAREA").length,
      bodyHeight: document.body.scrollHeight + "px",
      viewportWidth: window.innerWidth + "px",
      timestamp: new Date().toLocaleTimeString()
    };

    content.innerHTML = `
      <div style="margin-bottom:12px;">
        <strong style="color:#764ba2;">Page Info</strong>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          <tr><td style="padding:4px 8px 4px 0;color:#666;">URL</td><td style="word-break:break-all;">${pageData.url}</td></tr>
          <tr><td style="padding:4px 8px 4px 0;color:#666;">Title</td><td>${pageData.title}</td></tr>
          <tr><td style="padding:4px 8px 4px 0;color:#666;">Interactive Elements</td><td>${pageData.interactiveElements}</td></tr>
          <tr><td style="padding:4px 8px 4px 0;color:#666;">Body Height</td><td>${pageData.bodyHeight}</td></tr>
          <tr><td style="padding:4px 8px 4px 0;color:#666;">Viewport Width</td><td>${pageData.viewportWidth}</td></tr>
          <tr><td style="padding:4px 8px 4px 0;color:#666;">Time</td><td>${pageData.timestamp}</td></tr>
        </table>
      </div>
      <div style="padding:10px;background:#f5f5f5;border-radius:6px;font-size:12px;color:#888;">
        💡 Use the extension popup to extract elements, take screenshots, or make API calls
      </div>`;

    header.querySelector("#overlay-close").addEventListener("click", () => overlay.remove());
    overlay.appendChild(header);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }

  return { show };
})();

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  DOM.init();
  Utils.init(DOM.get("status"), DOM.get("logArea"));

  Utils.getConfig().then((url) => {
    DOM.get("apiUrl").value = url;
    Utils.log("Config loaded: " + url);
  });

  Listeners.init();
});
