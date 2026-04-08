const greetBtn = document.getElementById("greetBtn");
const clickCountEl = document.getElementById("clickCount");

let count = 0;

chrome.storage.local.get(["clickCount"], (result) => {
  count = result.clickCount || 0;
  clickCountEl.textContent = `Clicks: ${count}`;
});

greetBtn.addEventListener("click", () => {
  count++;
  clickCountEl.textContent = `Clicks: ${count}`;
  chrome.storage.local.set({ clickCount: count });
  alert("Hello from the extension! 🎉");
});
