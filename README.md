# Code Review: `v2.1-autonav-ext-ak`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MANIFEST (MV3)                           │
│  Permissions: storage, activeTab, scripting, downloads      │
│  Content Script: content.js (all_urls)                      │
│  Background: background.js (service worker)                 │
│  Popup: popup.html + popup.js                               │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     chrome.tabs.sendMessage     ┌──────────────┐
│   POPUP      │ ──────────────────────────────►  │  CONTENT JS  │
│  (UI Layer)  │ ◄──────────────────────────────  │ (DOM Layer)  │
│              │    chrome.runtime.sendMessage    │              │
│              │                                  └──────────────┘
│              │     chrome.runtime.sendMessage   ┌──────────────┐
│              │ ──────────────────────────────►  │  BACKGROUND  │
│              │ ◄──────────────────────────────  │   (Worker)   │
│              │    downloadEvent notifications   │              │
└──────────────┘                                  └──────────────┘
```

---

## File-by-File Breakdown

### 1. `manifest.json` — Extension Config

| Field | Value | Purpose |
|-------|-------|---------|
| `manifest_version` | 3 | Chrome MV3 |
| `permissions` | `storage`, `activeTab`, `scripting`, `downloads` | Storage persistence, tab access, dynamic script injection, download monitoring |
| `content_scripts` | `content.js` on `<all_urls>` | Injects into every page automatically |
| `background` | `background.js` as service worker | Runs in background, handles download events, message routing |
| `action` | `popup.html` | Click extension icon opens popup UI |

---

### 2. `content.js` — DOM Operations (runs on every web page)

**Constants:**
- `DESIRED_ELEMENTS = ["INPUT", "SELECT", "A", "BUTTON", "TEXTAREA"]` — what counts as interactive

**Message Router** (`chrome.runtime.onMessage`):
| Message Type | Handler Function | Response |
|-------------|-----------------|----------|
| `extractDom` | `extractInteractiveElements()` | `{count, sample}` |
| `getElementsList` | `getElementsList()` | `{elements: [...]}` — all interactive elements with labels |
| `getFillElementsList` | `getFillElementsList()` | `{elements: [...]}` — only fillable textboxes |
| `clickByIndex` | `clickByIndex(index)` | `{success, description}` |
| `fillBySelector` | `fillBySelector(selector, text)` | `{success, description}` |
| `sendMessageToBackground` | Sends `contentMessage` back | `{status: "message sent"}` |

**Functions:**

| Function | What It Does | Key Details |
|----------|-------------|-------------|
| `extractInteractiveElements()` | Counts all interactive elements on page | Uses `iterateDOM()` + `querySelectorAll`, returns count + first element sample |
| `iterateDOM(element)` | Recursive DOM traversal | Walks child nodes, no-op placeholder (legacy from m58) |
| `getElementsList()` | Builds dropdown data for click | Each entry: `{index, tagName, type, id, name, text, label, selector}` |
| `getFillElementsList()` | Builds dropdown data for fill | **Filters** to only `<textarea>` or `<input>` with type in `[text, email, password, search, tel, url, number]` |
| `clickByIndex(index)` | Scrolls to element, focuses, clicks | 300ms scroll delay, orange outline highlight for 1s |
| `fillBySelector(selector, text)` | Simulates character-by-character typing | Clears field first, dispatches `keydown`, `keypress`, `input` events per char, green highlight for 1s |

---

### 3. `background.js` — Service Worker (background process)

**State:**
- `downloadMonitoringActive` — toggle flag
- `downloadLog` — array of download events

**Message Router** (`chrome.runtime.onMessage`):
| Message Type | Action |
|-------------|--------|
| `domExtracted` | Logs element count |
| `contentMessage` | Logs message text from content script |
| `toggleDownloadMonitoring` | Sets `downloadMonitoringActive` flag |
| `getDownloadLog` | Returns `{log, active}` |

**Download Listeners:**
| Listener | Trigger | What It Does |
|----------|---------|-------------|
| `chrome.downloads.onCreated` | New download starts | Creates log entry, sends `downloadEvent` to popup |
| `chrome.downloads.onChanged` | Download state changes | Logs progress %, completion, interruption; sends `downloadEvent` to popup |

Both listeners are **gated** by `downloadMonitoringActive` flag — no logging when disabled.

---

### 4. `popup.html` — UI Layout

```
┌──────────────────────────────────┐
│        Auto Nav Tools            │
│  [Status: Ready]                 │
│                                  │
│  [1. Extract DOM]                │
│  [2. Take Screenshot]            │
│  [3. Content → Background Msg]   │
│  [6. Load Popup]                 │
│  [9. Toggle Download Monitor]    │
│                                  │
│  ┌─ API Config ──────────────┐   │
│  │ [API URL input]            │   │
│  │ [Save Config]              │   │
│  │ [4. Make GET Request]      │   │
│  │ [5. Make POST Request]     │   │
│  └────────────────────────────┘   │
│                                    │
│  ┌─ Click Config ────────────┐   │
│  │ [Element dropdown]         │   │
│  │ [Refresh Element List]     │   │
│  │ [7. Click Element]         │   │
│  └────────────────────────────┘   │
│                                    │
│  ┌─ Fill Config ─────────────┐   │
│  │ [Textbox dropdown]         │   │
│  │ [Refresh Textbox List]     │   │
│  │ [Text to fill input]       │   │
│  │ [8. Fill Textbox]          │   │
│  └────────────────────────────┘   │
│                                    │
│  [Log area (dark terminal)]       │
└──────────────────────────────────┘
```

---

### 5. `popup.js` — UI Logic

**Helpers:**
| Function | Purpose |
|----------|---------|
| `setStatus(msg, type)` | Updates status bar (info/success/error) |
| `log(msg, section)` | Appends to popup log area + `console.log` |
| `getConfig()` / `setConfig()` | Wraps `chrome.storage.local` |

**Button Handlers (9 total):**

| # | Button | Flow |
|---|--------|------|
| 1 | **Extract DOM** | Inject `content.js` → send `extractDom` → display count |
| 2 | **Screenshot** | `chrome.tabs.captureVisibleTab` → strip base64 → store in `chrome.storage.local` |
| 3 | **Content → Background** | Inject `content.js` → send `sendMessageToBackground` → content sends message back |
| 4 | **GET Request** | `fetch(apiUrl)` → log response |
| 5 | **POST Request** | `fetch(apiUrl, {method: "POST", body: JSON})` → log response |
| 6 | **Load Popup** | Inject `showOverlay` func into page → floating panel with page info |
| 7 | **Click Element** | Parse dropdown value → send `clickByIndex` → content clicks element |
| 8 | **Fill Textbox** | Parse dropdown selector → send `fillBySelector` → content simulates typing |
| 9 | **Toggle Download** | Send `toggleDownloadMonitoring` → toggle button text |

**Incoming Message Listeners (2):**
| Source | Message Type | Action |
|--------|-------------|--------|
| Content script | `domExtracted`, `contentMessage` | Log to popup |
| Background worker | `downloadEvent` | Parse download state, log to popup |

**Page Overlay** (`showOverlay`):
- Injected via `chrome.scripting.executeScript({func: showOverlay})`
- Creates a floating div at top-right of page
- Shows: URL, title, interactive element count, body height, viewport width, timestamp
- Close button removes it

---

## Communication Flow

```
POPUP                          CONTENT.JS                    BACKGROUND.JS
  │                               │                               │
  │── chrome.tabs.sendMessage ──►│                               │
  │   "extractDom"                │── chrome.runtime.sendMessage ──►│
  │                               │   "domExtracted"              │
  │◄── response {count} ─────────│                               │
  │                               │                               │
  │── chrome.tabs.sendMessage ──►│                               │
  │   "clickByIndex"              │                               │
  │                               │◄── response {success} ────────│
  │◄── response {success} ───────│                               │
  │                               │                               │
  │                               │                               │
  │                               │                               │── downloads.onCreated
  │                               │                               │── downloads.onChanged
  │◄── chrome.runtime.sendMessage ────────────────────────────────│
  │   "downloadEvent"             │                               │
```

---

## Key Patterns Used

1. **Dynamic script injection** — `chrome.scripting.executeScript` before messaging (avoids "receiving end does not exist" errors)
2. **Dual logging** — Every `log()` call writes to popup DOM + browser console
3. **Visual feedback** — Orange outline for clicks, green background for fills
4. **Event simulation** — Fill dispatches `keydown`, `keypress`, `input`, `change`, `blur` (framework compatibility)
5. **CSS selector-based targeting** — Fill uses selectors; Click uses index
6. **Filtered element lists** — Click shows all interactive; Fill shows only textboxes
