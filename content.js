// ─── Configuration ──────────────────────────────────────────────────────────
const DESIRED_ELEMENTS = ["INPUT", "SELECT", "A", "BUTTON", "TEXTAREA"];
const FILLABLE_INPUT_TYPES = ["text", "email", "password", "search", "tel", "url", "number"];

console.log("[AutoNav Content] Loaded on:", window.location.href);

// ─── Utilities ──────────────────────────────────────────────────────────────
const Utils = (() => {
  function buildElementInfo(el, index, opts = {}) {
    const tagName = el.tagName.toLowerCase();
    const type = el.type || "";
    const id = el.id || "";
    const name = el.name || "";
    const text = (opts.textOverride || el.innerText || el.textContent || el.value || "").trim().substring(0, 40);
    const href = opts.href || (el.href ? el.href.substring(0, 40) : "");

    let label = opts.labelPrefix !== undefined ? opts.labelPrefix : `[${index}] <${tagName}`;
    if (type) label += ` type="${type}"`;
    if (id) label += ` #${id}`;
    if (name) label += ` name="${name}"`;
    if (text) label += ` "${text}"`;
    if (href) label += ` → ${href}`;
    label += ">";

    let selector = tagName;
    if (id) selector = `#${id}`;
    else if (name) selector += `[name="${name}"]`;

    return { index, tagName, type, id, name, text, label, selector };
  }

  function scrollAndHighlight(el, opts = {}) {
    const scrollDelay = opts.scrollDelay ?? 300;
    const feedbackStyle = opts.feedbackStyle || "outline";
    const feedbackValue = opts.feedbackValue || "3px solid #ff5722";
    const feedbackDuration = opts.feedbackDuration ?? 1000;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    return new Promise((resolve) => {
      setTimeout(() => {
        if (opts.action) opts.action(el);
        const original = el.style[feedbackStyle];
        el.style[feedbackStyle] = feedbackValue;
        el.style.transition = `${feedbackStyle} 0.3s`;
        setTimeout(() => {
          el.style[feedbackStyle] = original;
          resolve();
        }, feedbackDuration);
      }, scrollDelay);
    });
  }

  function isFillableElement(el) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === "textarea") return true;
    if (tagName === "input") return FILLABLE_INPUT_TYPES.includes(el.type || "");
    return false;
  }

  return { buildElementInfo, scrollAndHighlight, isFillableElement };
})();

// ─── Message Handler Functions ──────────────────────────────────────────────

function handleExtractDom() {
  const result = extractInteractiveElements();
  console.log("[AutoNav Content] Extracted", result.count, "elements");
  chrome.runtime.sendMessage({ type: "domExtracted", count: result.count });
  return result;
}

function handleGetElementsList() {
  const list = getElementsList();
  console.log("[AutoNav Content] Returning", list.elements.length, "elements for dropdown");
  return list;
}

function handleGetFillElementsList() {
  const list = getFillElementsList();
  console.log("[AutoNav Content] Returning", list.elements.length, "fillable elements for dropdown");
  return list;
}

function handleClickByIndex(message) {
  const result = clickByIndex(message.index);
  console.log("[AutoNav Content] Click result:", result);
  return result;
}

function handleFillBySelector(message) {
  const result = fillBySelector(message.selector, message.text);
  console.log("[AutoNav Content] Fill result:", result);
  return result;
}

function handleSendMessageToBackground() {
  console.log("[AutoNav Content] Sending message to background");
  chrome.runtime.sendMessage({
    type: "contentMessage",
    text: "Hello from content script on " + window.location.href
  });
  return { status: "message sent" };
}

// ─── Message Listener Registration ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[AutoNav Content] Received message:", message.type);

  const handlers = {
    extractDom: handleExtractDom,
    getElementsList: handleGetElementsList,
    getFillElementsList: handleGetFillElementsList,
    clickByIndex: handleClickByIndex,
    fillBySelector: handleFillBySelector,
    sendMessageToBackground: handleSendMessageToBackground
  };

  const handler = handlers[message.type];
  if (handler) {
    const result = handler(message);
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

  return { count: allData.length, sample: allData[0] || null };
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
    const info = Utils.buildElementInfo(el, i, {
      href: el.href ? el.href.substring(0, 40) : ""
    });
    elements.push(info);
  });

  return { elements };
}

// ─── Get Fillable Elements List for Dropdown ────────────────────────────────

function getFillElementsList() {
  const elements = [];
  const allInteractive = document.querySelectorAll(DESIRED_ELEMENTS.join(","));

  allInteractive.forEach((el) => {
    if (!Utils.isFillableElement(el)) return;

    const text = (el.placeholder || el.value || "").trim().substring(0, 40);
    const info = Utils.buildElementInfo(el, elements.length, { textOverride: text });
    info.label = `[${elements.length}] <${info.tagName}${info.type ? ` type="${info.type}"` : ""}${info.id ? ` #${info.id}` : ""}${info.name ? ` name="${info.name}"` : ""}${info.text ? ` placeholder="${info.text}"` : ""}>`;
    elements.push(info);
  });

  return { elements };
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

  Utils.scrollAndHighlight(element, {
    action: (el) => {
      el.focus();
      el.click();
      console.log("[AutoNav Content] Clicked element:", el.outerHTML.substring(0, 100));
    },
    feedbackStyle: "outline",
    feedbackValue: "3px solid #ff5722"
  });

  return { success: true, description: `<${tagName}> "${text}" (index ${index})`, tagName, index };
}

// ─── Fill Textbox by CSS Selector ───────────────────────────────────────────

function fillBySelector(selector, text) {
  const element = document.querySelector(selector);

  if (!element) {
    return { success: false, error: `Element not found with selector: ${selector}` };
  }

  const tagName = element.tagName.toLowerCase();
  const type = element.type || "";

  if (!Utils.isFillableElement(element)) {
    return { success: false, error: `Element "${selector}" is <${tagName}${type ? ` type="${type}"` : ""}> — not a fillable textbox` };
  }

  Utils.scrollAndHighlight(element, {
    action: (el) => {
      el.focus();
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      for (let i = 0; i < text.length; i++) {
        el.value += text[i];
        el.dispatchEvent(new KeyboardEvent("keydown", { key: text[i], bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keypress", { key: text[i], bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }

      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      console.log("[AutoNav Content] Filled element with:", text);
    },
    feedbackStyle: "background",
    feedbackValue: "#e8f5e9"
  });

  const desc = `<${tagName}${type ? ` type="${type}"` : ""}> filled with "${text.substring(0, 30)}${text.length > 30 ? "..." : ""}"`;

  return { success: true, description: desc, tagName, selector };
}
