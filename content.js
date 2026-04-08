// ─── Configuration ──────────────────────────────────────────────────────────
const DESIRED_ELEMENTS = ["INPUT", "SELECT", "A", "BUTTON", "TEXTAREA"];

console.log("[AutoNav Content] Loaded on:", window.location.href);

// ─── Message Listener ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[AutoNav Content] Received message:", message.type);

  if (message.type === "extractDom") {
    const result = extractInteractiveElements();
    console.log("[AutoNav Content] Extracted", result.count, "elements");
    chrome.runtime.sendMessage({
      type: "domExtracted",
      count: result.count
    });
    sendResponse(result);
  } else if (message.type === "sendMessageToBackground") {
    console.log("[AutoNav Content] Sending message to background");
    chrome.runtime.sendMessage({
      type: "contentMessage",
      text: "Hello from content script on " + window.location.href
    });
    sendResponse({ status: "message sent" });
  }

  return true; // Keep message channel open for async response
});

// ─── DOM Extraction ─────────────────────────────────────────────────────────
function extractInteractiveElements() {
  const allData = [];
  iterateDOM(document.body);

  document.querySelectorAll(DESIRED_ELEMENTS.join(",")).forEach((el) => {
    allData.push({
      tagName: el.tagName,
      type: el.type || "",
      id: el.id || "",
      name: el.name || "",
      text: (el.innerText || el.textContent || "").trim().substring(0, 50),
      href: el.href || ""
    });
  });

  return {
    count: allData.length,
    sample: allData[0] || null
  };
}

function iterateDOM(element) {
  for (const childNode of element.childNodes) {
    if (childNode instanceof Element && DESIRED_ELEMENTS.includes(childNode.tagName)) {
      // Element already collected via querySelectorAll above
    }
    iterateDOM(childNode);
  }
}
