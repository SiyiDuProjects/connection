const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const DEFAULT_WEB_BASE_URL = "https://contacts.gaid.studio";
const LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/*";

chrome.runtime.onInstalled.addListener(() => {
  refreshLinkedInTabs();
});

chrome.runtime.onStartup.addListener(() => {
  refreshLinkedInTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || "Unexpected error" }));
  return true;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleExternalMessage(message, sender)
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
    case "GET_ACCOUNT_STATUS":
      return getAccountStatus();
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function handleExternalMessage(message, sender) {
  if (message?.type !== "CONNECT_EXTENSION_TOKEN") {
    return { ok: false, error: "Unknown external message type" };
  }

  if (!sender.url || !isAllowedWebsite(sender.url)) {
    return { ok: false, error: "Website origin is not allowed." };
  }

  const token = String(message.token || "").trim();
  if (!token) {
    return { ok: false, error: "Missing extension token." };
  }

  const apiBaseUrl = cleanUrl(message.apiBaseUrl) || DEFAULT_API_BASE_URL;
  const webBaseUrl = cleanUrl(message.webBaseUrl) || DEFAULT_WEB_BASE_URL;
  await chrome.storage.sync.set({ extensionApiToken: token, apiBaseUrl, webBaseUrl });
  await getAccountStatus();
  return { ok: true };
}

function isAllowedWebsite(url) {
  const origin = new URL(url).origin;
  return [
    "https://contacts.gaid.studio",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ].includes(origin);
}

async function getApiBaseUrl() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl"]);
  return (stored.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function getWebBaseUrl() {
  const stored = await chrome.storage.sync.get(["webBaseUrl"]);
  return (stored.webBaseUrl || DEFAULT_WEB_BASE_URL).replace(/\/+$/, "");
}

async function getAccountStatus() {
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getExtensionApiToken()]);
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website to connect this extension.", action: await loginAction() };
  }

  const response = await fetch(`${baseUrl}/api/account`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const action = response.status === 402 ? await pricingAction() : await loginAction();
    return { ok: false, status: response.status, error: payload.error || "Could not load account status.", action };
  }

  await chrome.storage.sync.set({ accountStatus: payload });
  return { ok: true, account: payload };
}

async function postJson(path, body) {
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getExtensionApiToken()]);
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website to connect this extension.", action: await loginAction() };
  }

  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body || {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
    }
    const action = response.status === 402 ? await pricingAction() : await loginAction();
    const prompt = response.status === 402
      ? "Credits are insufficient. Upgrade or wait for your next monthly grant."
      : "Sign in again to reconnect the extension.";
    return {
      ok: false,
      status: response.status,
      error: `${payload.error || `Request failed with ${response.status}`} ${prompt}`,
      action
    };
  }
  return payload;
}

async function getExtensionApiToken() {
  const stored = await chrome.storage.sync.get(["extensionApiToken"]);
  return String(stored.extensionApiToken || "").trim();
}

async function loginAction() {
  return {
    label: "Sign in on website",
    url: `${await getWebBaseUrl()}/connect-extension?extensionId=${encodeURIComponent(chrome.runtime.id)}`
  };
}

async function pricingAction() {
  return {
    label: "Open pricing",
    url: `${await getWebBaseUrl()}/pricing`
  };
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
