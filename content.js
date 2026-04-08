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
  } else if (message.type === "getElementsList") {
    const list = getElementsList();
    console.log("[AutoNav Content] Returning", list.elements.length, "elements for dropdown");
    sendResponse(list);
  } else if (message.type === "clickByIndex") {
    const result = clickByIndex(message.index);
    console.log("[AutoNav Content] Click result:", result);
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

// ─── Get Elements List for Dropdown ─────────────────────────────────────────
function getElementsList() {
  const elements = [];
  const allInteractive = document.querySelectorAll(DESIRED_ELEMENTS.join(","));

  allInteractive.forEach((el, i) => {
    const tagName = el.tagName.toLowerCase();
    const type = el.type || "";
    const id = el.id || "";
    const name = el.name || "";
    const text = (el.innerText || el.textContent || el.value || "").trim().substring(0, 40);
    const href = el.href ? el.href.substring(0, 40) : "";

    // Build readable label
    let label = `[${i}] <${tagName}`;
    if (type) label += ` type="${type}"`;
    if (id) label += ` #${id}`;
    if (name) label += ` name="${name}"`;
    if (text) label += ` "${text}"`;
    if (href) label += ` → ${href}`;
    label += ">";

    // Build CSS selector
    let selector = tagName;
    if (id) selector = `#${id}`;
    else if (name) selector += `[name="${name}"]`;

    elements.push({
      index: i,
      tagName: tagName,
      type: type,
      id: id,
      name: name,
      text: text,
      label: label,
      selector: selector
    });
  });

  return { elements: elements };
}

// ─── Click Element by Index ─────────────────────────────────────────────────
function clickByIndex(index) {
  const allInteractive = document.querySelectorAll(DESIRED_ELEMENTS.join(","));

  if (index < 0 || index >= allInteractive.length) {
    return { success: false, error: `Index ${index} out of range (0-${allInteractive.length - 1})` };
  }

  const element = allInteractive[index];
  const tagName = element.tagName.toLowerCase();
  const text = (element.innerText || element.textContent || element.value || "").trim().substring(0, 50);

  // Scroll into view
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Brief delay for scroll animation
  setTimeout(() => {
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
    description: `<${tagName}> "${text}" (index ${index})`,
    tagName: tagName,
    index: index
  };
}
