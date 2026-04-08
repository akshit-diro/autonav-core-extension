console.log("[AutoNav Background] Service worker loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[AutoNav Background] Received message:", message.type, message);

  if (message.type === "domExtracted") {
    console.log("[AutoNav Background] Content script extracted", message.count, "elements");
  } else if (message.type === "contentMessage") {
    console.log("[AutoNav Background] Content says:", message.text);
  }

  sendResponse({ status: "received" });
});
