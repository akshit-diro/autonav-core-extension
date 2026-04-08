document.addEventListener("DOMContentLoaded", () => {
  // ─── Elements ──────────────────────────────────────────────────────────────
  const statusEl = document.getElementById("status");
  const domBtn = document.getElementById("domBtn");
  const screenshotBtn = document.getElementById("screenshotBtn");
  const messageBtn = document.getElementById("messageBtn");
  const getBtn = document.getElementById("getBtn");
  const postBtn = document.getElementById("postBtn");
  const loadPopupBtn = document.getElementById("loadPopupBtn");
  const apiUrlInput = document.getElementById("apiUrl");
  const saveBtn = document.getElementById("saveBtn");
  const logArea = document.getElementById("logArea");

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
      setStatus("Loading state summary...", "info");
      log("Gathering all stored data...", "LOAD POPUP");

      const config = await chrome.storage.local.get(null);

      const screenshotStatus = config.screenshotBase64
        ? `Yes (${config.screenshotBase64.length.toLocaleString()} base64 chars)`
        : "No";

      log("API URL: " + (config.apiUrl || "not set"), "LOAD POPUP");
      log("Screenshot stored: " + screenshotStatus, "LOAD POPUP");
      log("Storage keys: " + Object.keys(config).join(", ") || "none", "LOAD POPUP");
      log("Extension version: 1.0", "LOAD POPUP");
      log("Manifest version: 3", "LOAD POPUP");

      setStatus("State summary loaded", "success");
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      log("Load error: " + error.message);
    } finally {
      loadPopupBtn.disabled = false;
    }
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
