document.addEventListener("DOMContentLoaded", () => {
  // ─── Elements ──────────────────────────────────────────────────────────────
  const statusEl = document.getElementById("status");
  const domBtn = document.getElementById("domBtn");
  const screenshotBtn = document.getElementById("screenshotBtn");
  const messageBtn = document.getElementById("messageBtn");
  const getBtn = document.getElementById("getBtn");
  const postBtn = document.getElementById("postBtn");
  const loadPopupBtn = document.getElementById("loadPopupBtn");
  const clickBtn = document.getElementById("clickBtn");
  const fillBtn = document.getElementById("fillBtn");
  const fillValueInput = document.getElementById("fillValue");
  const fillElementDropdown = document.getElementById("fillElementDropdown");
  const refreshFillElementsBtn = document.getElementById("refreshFillElementsBtn");
  const elementDropdown = document.getElementById("elementDropdown");
  const refreshElementsBtn = document.getElementById("refreshElementsBtn");
  const apiUrlInput = document.getElementById("apiUrl");
  const saveBtn = document.getElementById("saveBtn");
  const logArea = document.getElementById("logArea");
  const downloadMonitorBtn = document.getElementById("downloadMonitorBtn");

  let downloadMonitoringActive = false;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function setStatus(message, type = "info") {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  function log(message, section = null) {
    const separator = section ? "\n======== [" + section + "] ========\n" : "";
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `${separator}[${timestamp}] ${message}`;

    // Log to popup
    logArea.textContent += logLine;
    logArea.scrollTop = logArea.scrollHeight;

    // Log to browser console
    console.log(`[AutoNav]${section ? " [" + section + "]" : ""}`, message);
  }

  async function getConfig() {
    const result = await chrome.storage.local.get(["apiUrl"]);
    return result.apiUrl || "https://httpbin.org/get";
  }

  async function setConfig(data) {
    await chrome.storage.local.set(data);
  }

  // ─── Load Config on Open ──────────────────────────────────────────────────
  getConfig().then((url) => {
    apiUrlInput.value = url;
    log("Config loaded: " + url);
  });

  // ─── 1. Extract Interactive DOM Elements ───────────────────────────────────
  domBtn.addEventListener("click", async () => {
    try {
      domBtn.disabled = true;
      setStatus("Extracting elements...", "info");
      log("Triggering DOM extraction in content script...", "DOM EXTRACT");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Inject content script if not already loaded
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const response = await chrome.tabs.sendMessage(tab.id, { type: "extractDom" });

      if (response && response.count) {
        setStatus(`Extracted ${response.count} elements`, "success");
        log(`Received ${response.count} interactive elements`);
        log(`Sample: ${JSON.stringify(response.sample).substring(0, 100)}...`);
      } else {
        setStatus("No response from content script", "error");
        log("No response received");
      }
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Error: " + error.message);
    } finally {
      domBtn.disabled = false;
    }
  });

  // ─── 2. Take Screenshot ───────────────────────────────────────────────────
  screenshotBtn.addEventListener("click", async () => {
    try {
      screenshotBtn.disabled = true;
      setStatus("Capturing screenshot...", "info");
      log("Capturing visible tab screenshot...", "SCREENSHOT");

      const dataUrl = await chrome.tabs.captureVisibleTab(
        chrome.windows.WINDOW_ID_CURRENT,
        { format: "png" }
      );

      const base64 = dataUrl.split(",")[1];
      await setConfig({ screenshotBase64: base64 });

      setStatus(`Screenshot saved (${base64.length} chars)`, "success");
      log(`Screenshot captured: ${base64.length} base64 characters stored in chrome.storage.local`);
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Screenshot error: " + error.message);
    } finally {
      screenshotBtn.disabled = false;
    }
  });

  // ─── 3. Send Content → Background Message ─────────────────────────────────
  messageBtn.addEventListener("click", async () => {
    try {
      messageBtn.disabled = true;
      setStatus("Sending message to content script...", "info");
      log("Requesting content script to send message back...", "CONTENT MSG");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Inject content script if not already loaded
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      await chrome.tabs.sendMessage(tab.id, { type: "sendMessageToBackground" });

      setStatus("Message sent! Check logs.", "success");
      log("Content script will now send message to background");
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Message error: " + error.message);
    } finally {
      messageBtn.disabled = false;
    }
  });

  // ─── 4. Make GET Request ──────────────────────────────────────────────────
  getBtn.addEventListener("click", async () => {
    try {
      getBtn.disabled = true;
      const url = apiUrlInput.value || "https://httpbin.org/get";
      setStatus(`GET ${url}...`, "info");
      log(`Making GET request to: ${url}`, "GET REQUEST");

      const response = await fetch(url);
      const data = await response.json();

      setStatus("GET request successful", "success");
      log(`Response: ${JSON.stringify(data).substring(0, 150)}...`);
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("GET error: " + error.message);
    } finally {
      getBtn.disabled = false;
    }
  });

  // ─── 5. Make POST Request ─────────────────────────────────────────────────
  postBtn.addEventListener("click", async () => {
    try {
      postBtn.disabled = true;
      const url = apiUrlInput.value || "https://httpbin.org/post";
      setStatus(`POST ${url}...`, "info");
      log(`Making POST request to: ${url}`, "POST REQUEST");

      const payload = {
        timestamp: Date.now(),
        message: "Hello from extension",
        screenshotStored: true
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      setStatus("POST request successful", "success");
      log(`Response: ${JSON.stringify(data).substring(0, 150)}...`);
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("POST error: " + error.message);
    } finally {
      postBtn.disabled = false;
    }
  });

  // ─── 6. Load Popup ────────────────────────────────────────────────────────
  loadPopupBtn.addEventListener("click", async () => {
    try {
      loadPopupBtn.disabled = true;
      setStatus("Opening overlay...", "info");
      log("Injecting page overlay...", "LOAD POPUP");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showOverlay
      });

      setStatus("Overlay displayed on page", "success");
      log("Overlay injected into page DOM", "LOAD POPUP");
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Overlay error: " + error.message);
    } finally {
      loadPopupBtn.disabled = false;
    }
  });

  // ─── Refresh Element List ─────────────────────────────────────────────────
  refreshElementsBtn.addEventListener("click", async () => {
    try {
      refreshElementsBtn.disabled = true;
      setStatus("Scanning page elements...", "info");
      log("Extracting interactive elements for dropdown...", "REFRESH");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const response = await chrome.tabs.sendMessage(tab.id, { type: "getElementsList" });

      elementDropdown.innerHTML = "";

      if (response && response.elements && response.elements.length > 0) {
        response.elements.forEach((el, i) => {
          const option = document.createElement("option");
          option.value = JSON.stringify({ index: i, id: el.id, selector: el.selector });
          option.textContent = el.label;
          elementDropdown.appendChild(option);
        });
        setStatus(`Loaded ${response.elements.length} elements`, "success");
        log(`Dropdown populated with ${response.elements.length} elements`, "REFRESH");
      } else {
        elementDropdown.innerHTML = '<option value="">-- No elements found --</option>';
        setStatus("No interactive elements found", "error");
        log("Page has no interactive elements", "REFRESH");
      }
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Refresh error: " + error.message);
    } finally {
      refreshElementsBtn.disabled = false;
    }
  });

  // ─── 7. Click Element on Page ─────────────────────────────────────────────
  clickBtn.addEventListener("click", async () => {
    try {
      clickBtn.disabled = true;
      const selected = elementDropdown.value;

      if (!selected) {
        setStatus("Select an element first (click Refresh)", "error");
        log("No element selected", "CLICK");
        clickBtn.disabled = false;
        return;
      }

      const target = JSON.parse(selected);
      setStatus(`Clicking element (index ${target.index})...`, "info");
      log(`Clicking element: index=${target.index}`, "CLICK");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "clickByIndex",
        index: target.index
      });

      if (response && response.success) {
        setStatus(`Clicked: ${response.description}`, "success");
        log(`Successfully clicked: ${response.description}`, "CLICK");
      } else {
        setStatus("Click failed: " + (response?.error || "unknown"), "error");
        log(`Click failed: ${response?.error}`, "CLICK");
      }
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Click error: " + error.message);
    } finally {
      clickBtn.disabled = false;
    }
  });

  // ─── Refresh Fill Element List ────────────────────────────────────────────
  refreshFillElementsBtn.addEventListener("click", async () => {
    try {
      refreshFillElementsBtn.disabled = true;
      setStatus("Scanning page textboxes...", "info");
      log("Extracting fillable elements for dropdown...", "REFILL");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const response = await chrome.tabs.sendMessage(tab.id, { type: "getFillElementsList" });

      fillElementDropdown.innerHTML = "";

      if (response && response.elements && response.elements.length > 0) {
        response.elements.forEach((el, i) => {
          const option = document.createElement("option");
          option.value = el.selector;
          option.textContent = el.label;
          fillElementDropdown.appendChild(option);
        });
        setStatus(`Loaded ${response.elements.length} textboxes`, "success");
        log(`Fill dropdown populated with ${response.elements.length} textboxes`, "REFILL");
      } else {
        fillElementDropdown.innerHTML = '<option value="">-- No textboxes found --</option>';
        setStatus("No fillable textboxes found", "error");
        log("Page has no fillable textbox elements", "REFILL");
      }
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Refresh fill error: " + error.message);
    } finally {
      refreshFillElementsBtn.disabled = false;
    }
  });

  // ─── 8. Fill Textbox on Page ──────────────────────────────────────────────
  fillBtn.addEventListener("click", async () => {
    try {
      fillBtn.disabled = true;
      const selector = fillElementDropdown.value;
      const fillText = fillValueInput.value;

      if (!selector) {
        setStatus("Select a textbox first (click Refresh)", "error");
        log("No textbox selected", "FILL");
        fillBtn.disabled = false;
        return;
      }

      if (!fillText && fillText !== "") {
        setStatus("Enter text to fill", "error");
        log("No fill text provided", "FILL");
        fillBtn.disabled = false;
        return;
      }

      setStatus(`Filling textbox (${selector})...`, "info");
      log(`Filling textbox: selector="${selector}" with "${fillText}"`, "FILL");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "fillBySelector",
        selector: selector,
        text: fillText
      });

      if (response && response.success) {
        setStatus(`Filled: ${response.description}`, "success");
        log(`Successfully filled: ${response.description}`, "FILL");
      } else {
        setStatus("Fill failed: " + (response?.error || "unknown"), "error");
        log(`Fill failed: ${response?.error}`, "FILL");
      }
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Fill error: " + error.message);
    } finally {
      fillBtn.disabled = false;
    }
  });

  // ─── 9. Toggle Download Monitor ───────────────────────────────────────────
  downloadMonitorBtn.addEventListener("click", async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "toggleDownloadMonitoring",
        enabled: downloadMonitorBtn.textContent.includes("Enable")
      });

      downloadMonitoringActive = response.active;
      downloadMonitorBtn.textContent = downloadMonitoringActive
        ? "9. Disable Download Monitor"
        : "9. Enable Download Monitor";

      setStatus(`Download monitoring ${downloadMonitoringActive ? "ENABLED" : "DISABLED"}`, "success");
      log(`Download monitor ${downloadMonitoringActive ? "activated" : "deactivated"}`, "DOWNLOAD");
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Download monitor error: " + error.message);
    }
  });

  // ─── Listen for download events from background ───────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "downloadEvent") {
      const d = message.data;
      if (d.event === "created") {
        log(`Download started: ${d.filename} (${(d.totalBytes / 1024).toFixed(1)}KB)`, "DOWNLOAD");
      } else if (d.event === "changed") {
        if (d.state === "complete") {
          log(`Download complete: ${d.filename}`, "DOWNLOAD");
        } else if (d.state === "interrupted") {
          log(`Download interrupted: ${d.filename}`, "DOWNLOAD");
        } else if (d.state === "in_progress") {
          log(`Download in progress: ${d.filename} (${((d.bytesReceived / d.totalBytes) * 100).toFixed(0)}%)`, "DOWNLOAD");
        }
      }
    }
    sendResponse({ status: "received" });
  });

  // ─── Save Config ──────────────────────────────────────────────────────────
  saveBtn.addEventListener("click", async () => {
    await setConfig({ apiUrl: apiUrlInput.value });
    setStatus("Config saved", "success");
    log("Config saved: " + apiUrlInput.value, "SAVE CONFIG");
  });

  // ─── Listen for messages from content script ──────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "domExtracted") {
      log(`Content script extracted: ${message.count} elements`, "ASYNC MSG");
    } else if (message.type === "contentMessage") {
      log(`Message from content: ${message.text}`, "ASYNC MSG");
    }
    sendResponse({ status: "received" });
  });
});

// ─── Page Overlay (injected via scripting API) ─────────────────────────────
function showOverlay() {
  // Remove existing overlay if present
  const existing = document.getElementById("autonav-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "autonav-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    width: "400px",
    maxHeight: "80vh",
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    zIndex: "2147483647",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "16px 20px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  });
  header.innerHTML = `<h3 style="margin:0;font-size:16px;">Auto Nav - State</h3>
    <button id="overlay-close" style="background:rgba(255,255,255,0.2);border:none;color:white;
    width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;">×</button>`;

  // Content area
  const content = document.createElement("div");
  Object.assign(content.style, {
    padding: "20px",
    overflowY: "auto",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#333"
  });

  // Gather data (runs in content script context, no chrome.storage access)
  const pageData = {
    url: window.location.href,
    title: document.title,
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
    </div>
  `;

  // Close button handler
  header.querySelector("#overlay-close").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.appendChild(header);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}
