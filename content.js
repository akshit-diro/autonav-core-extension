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
  } else if (message.type === "clickElement") {
    const result = clickElementByDOM(message.clickBy, message.clickValue);
    console.log("[AutoNav Content] Click result:", result);
    sendResponse(result);
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

// ─── Click Element by DOM Identifier ────────────────────────────────────────
function clickElementByDOM(clickBy, clickValue) {
  let element = null;
  let description = "";

  switch (clickBy) {
    case "selector":
      element = document.querySelector(clickValue);
      description = `selector "${clickValue}"`;
      break;

    case "text":
      // Search all interactive elements for matching text content
      const allInteractive = document.querySelectorAll(DESIRED_ELEMENTS.join(","));
      for (const el of allInteractive) {
        const text = (el.innerText || el.textContent || "").trim();
        if (text === clickValue || text.toLowerCase() === clickValue.toLowerCase()) {
          element = el;
          break;
        }
      }
      description = `text "${clickValue}"`;
      break;

    case "id":
      element = document.getElementById(clickValue);
      description = `id "${clickValue}"`;
      break;

    case "index": {
      const allInteractive = document.querySelectorAll(DESIRED_ELEMENTS.join(","));
      const idx = parseInt(clickValue, 10);
      if (!isNaN(idx) && idx >= 0 && idx < allInteractive.length) {
        element = allInteractive[idx];
      }
      description = `index ${idx} of ${allInteractive.length} interactive elements`;
      break;
    }

    default:
      return { success: false, error: `Unknown identification method: ${clickBy}` };
  }

  if (!element) {
    return { success: false, error: `Element not found by ${description}` };
  }

  // Scroll into view
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Brief delay for scroll animation
  setTimeout(() => {
    // Focus and click
    element.focus();
    element.click();

    console.log("[AutoNav Content] Clicked element:", element.outerHTML.substring(0, 100));

    // Visual feedback - brief highlight
    const originalOutline = element.style.outline;
    element.style.outline = "3px solid #ff5722";
    element.style.transition = "outline 0.3s";
    setTimeout(() => {
      element.style.outline = originalOutline;
    }, 1000);
  }, 300);

  return {
    success: true,
    description: description,
    tagName: element.tagName,
    id: element.id || "",
    text: (element.innerText || element.textContent || "").trim().substring(0, 50)
  };
}
