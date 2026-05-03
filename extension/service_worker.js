const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/*";

chrome.runtime.onInstalled.addListener(() => {
  refreshLinkedInTabs();
});

chrome.runtime.onStartup.addListener(() => {
  refreshLinkedInTabs();
});

refreshLinkedInTabs();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || "Unexpected error" }));
  return true;
});

async function refreshLinkedInTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: LINKEDIN_JOBS_URL });
    await Promise.allSettled(tabs.map(injectIntoTab));
  } catch (error) {
    console.warn("Could not refresh LinkedIn content scripts", error);
  }
}

async function injectIntoTab(tab) {
  if (!tab.id) return;

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["content.css"]
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
}

async function handleMessage(message) {
  switch (message?.type) {
    case "CONTACTS_SEARCH":
      return postJson("/api/contacts/search", message.payload);
    case "CONTACTS_REVEAL":
      return postJson("/api/contacts/reveal", message.payload);
    case "EMAIL_DRAFT":
      return postJson("/api/email/draft", message.payload);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function getApiBaseUrl() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl"]);
  return (stored.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function postJson(path, body) {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: `${new URL(baseUrl).host}: ${payload.error || `Request failed with ${response.status}`}` };
  }
  return payload;
}
