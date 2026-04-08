// ─── Config ─────────────────────────────────────────────────────────────────
const Config = {
  desiredElements: ["INPUT", "SELECT", "A", "BUTTON", "TEXTAREA"],
  fillableInputTypes: ["text", "email", "password", "search", "tel", "url", "number"],
  logSnippetLength: 100,
  textSnippetLength: 40,
  hrefSnippetLength: 40,
  scrollDelay: 300,
  feedbackDuration: 1000,
  clickOutline: "3px solid #ff5722",
  fillBackground: "#e8f5e9"
};

// ─── Utils ──────────────────────────────────────────────────────────────────
const Utils = (() => {
  function buildElementInfo(el, index, opts = {}) {
    const tagName = el.tagName.toLowerCase();
    const type = el.type || "";
    const id = el.id || "";
    const name = el.name || "";
    const text = (opts.textOverride || el.innerText || el.textContent || el.value || "").trim().substring(0, Config.textSnippetLength);
    const href = opts.href || (el.href ? el.href.substring(0, Config.hrefSnippetLength) : "");

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
    const scrollDelay = opts.scrollDelay ?? Config.scrollDelay;
    const feedbackStyle = opts.feedbackStyle || "outline";
    const feedbackValue = opts.feedbackValue || Config.clickOutline;
    const feedbackDuration = opts.feedbackDuration ?? Config.feedbackDuration;

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
    if (tagName === "input") return Config.fillableInputTypes.includes(el.type || "");
    return false;
  }

  return { buildElementInfo, scrollAndHighlight, isFillableElement };
})();

// ─── Actions ────────────────────────────────────────────────────────────────
const Actions = (() => {
  function extractInteractiveElements() {
    const allData = [];
    iterateDOM(document.body);

    document.querySelectorAll(Config.desiredElements.join(",")).forEach((el) => {
      allData.push({
        tagName: el.tagName, type: el.type || "", id: el.id || "",
        name: el.name || "", text: (el.innerText || el.textContent || "").trim().substring(0, Config.logSnippetLength),
        href: el.href || ""
      });
    });

    return { count: allData.length, sample: allData[0] || null };
  }

  function iterateDOM(element) {
    for (const childNode of element.childNodes) {
      if (childNode instanceof Element && Config.desiredElements.includes(childNode.tagName)) {
        // Collected via querySelectorAll above
      }
      iterateDOM(childNode);
    }
  }

  function getElementsList() {
    const elements = [];
    document.querySelectorAll(Config.desiredElements.join(",")).forEach((el, i) => {
      elements.push(Utils.buildElementInfo(el, i, {
        href: el.href ? el.href.substring(0, Config.hrefSnippetLength) : ""
      }));
    });
    return { elements };
  }

  function getFillElementsList() {
    const elements = [];
    document.querySelectorAll(Config.desiredElements.join(",")).forEach((el) => {
      if (!Utils.isFillableElement(el)) return;
      const text = (el.placeholder || el.value || "").trim().substring(0, Config.textSnippetLength);
      const info = Utils.buildElementInfo(el, elements.length, { textOverride: text });
      info.label = `[${elements.length}] <${info.tagName}${info.type ? ` type="${info.type}"` : ""}${info.id ? ` #${info.id}` : ""}${info.name ? ` name="${info.name}"` : ""}${info.text ? ` placeholder="${info.text}"` : ""}>`;
      elements.push(info);
    });
    return { elements };
  }

  function clickByIndex(index) {
    const allInteractive = document.querySelectorAll(Config.desiredElements.join(","));
    if (index < 0 || index >= allInteractive.length) {
      return { success: false, error: `Index ${index} out of range (0-${allInteractive.length - 1})` };
    }

    const element = allInteractive[index];
    const tagName = element.tagName.toLowerCase();
    const text = (element.innerText || element.textContent || element.value || "").trim().substring(0, Config.logSnippetLength);

    Utils.scrollAndHighlight(element, {
      action: (el) => {
        el.focus();
        el.click();
        console.log("[AutoNav Content] Clicked element:", el.outerHTML.substring(0, Config.logSnippetLength));
      },
      feedbackStyle: "outline",
      feedbackValue: Config.clickOutline
    });

    return { success: true, description: `<${tagName}> "${text}" (index ${index})`, tagName, index };
  }

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
      feedbackValue: Config.fillBackground
    });

    const desc = `<${tagName}${type ? ` type="${type}"` : ""}> filled with "${text.substring(0, Config.textSnippetLength)}${text.length > Config.textSnippetLength ? "..." : ""}"`;
    return { success: true, description: desc, tagName, selector };
  }

  return { extractInteractiveElements, iterateDOM, getElementsList, getFillElementsList, clickByIndex, fillBySelector };
})();

// ─── Handlers ───────────────────────────────────────────────────────────────
const Handlers = (() => {
  function handleExtractDom() {
    const result = Actions.extractInteractiveElements();
    console.log("[AutoNav Content] Extracted", result.count, "elements");
    chrome.runtime.sendMessage({ type: "domExtracted", count: result.count });
    return result;
  }

  function handleGetElementsList() {
    const list = Actions.getElementsList();
    console.log("[AutoNav Content] Returning", list.elements.length, "elements for dropdown");
    return list;
  }

  function handleGetFillElementsList() {
    const list = Actions.getFillElementsList();
    console.log("[AutoNav Content] Returning", list.elements.length, "fillable elements for dropdown");
    return list;
  }

  function handleClickByIndex(message) {
    const result = Actions.clickByIndex(message.index);
    console.log("[AutoNav Content] Click result:", result);
    return result;
  }

  function handleFillBySelector(message) {
    const result = Actions.fillBySelector(message.selector, message.text);
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

  return {
    handleExtractDom, handleGetElementsList, handleGetFillElementsList,
    handleClickByIndex, handleFillBySelector, handleSendMessageToBackground
  };
})();

// ─── Listeners ──────────────────────────────────────────────────────────────
const Listeners = (() => {
  const handlerMap = {
    extractDom: Handlers.handleExtractDom,
    getElementsList: Handlers.handleGetElementsList,
    getFillElementsList: Handlers.handleGetFillElementsList,
    clickByIndex: Handlers.handleClickByIndex,
    fillBySelector: Handlers.handleFillBySelector,
    sendMessageToBackground: Handlers.handleSendMessageToBackground
  };

  function init() {
    chrome.runtime.onMessage.addListener(onMessage);
  }

  function onMessage(message, sender, sendResponse) {
    console.log("[AutoNav Content] Received message:", message.type);
    const handler = handlerMap[message.type];
    if (handler) {
      const result = handler(message);
      sendResponse(result);
    }
    return true;
  }

  return { init };
})();

// ─── Init ───────────────────────────────────────────────────────────────────
console.log("[AutoNav Content] Loaded on:", window.location.href);
Listeners.init();
