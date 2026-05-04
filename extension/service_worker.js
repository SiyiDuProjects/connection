const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const DEFAULT_WEB_BASE_URL = "https://gaid.studio";
const LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/*";
const API_UNREACHABLE_ERROR = "Could not reach the contacts API. Check connection settings.";
const SESSION_EXPIRED_ERROR = "Session expired. Sign in again to reconnect the extension.";

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

  const webBaseUrl = normalizeWebBaseUrl(message.webBaseUrl);
  const apiBaseUrl = normalizeApiBaseUrl(message.apiBaseUrl, webBaseUrl);
  await chrome.storage.sync.set({ extensionApiToken: token, apiBaseUrl, webBaseUrl });
  return { ok: true };
}

function isAllowedWebsite(url) {
  const origin = new URL(url).origin;
  return [
    "https://gaid.studio",
    "https://www.gaid.studio",
    "https://contacts.gaid.studio",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ].includes(origin);
}

async function getApiBaseUrl() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl", "webBaseUrl"]);
  const webBaseUrl = normalizeWebBaseUrl(stored.webBaseUrl);
  const apiBaseUrl = normalizeApiBaseUrl(stored.apiBaseUrl, webBaseUrl);
  if (apiBaseUrl !== stored.apiBaseUrl || webBaseUrl !== stored.webBaseUrl) {
    await chrome.storage.sync.set({ apiBaseUrl, webBaseUrl });
  }
  return apiBaseUrl;
}

async function getWebBaseUrl() {
  const stored = await chrome.storage.sync.get(["webBaseUrl"]);
  const value = normalizeWebBaseUrl(stored.webBaseUrl);
  if (value !== stored.webBaseUrl) {
    await chrome.storage.sync.set({ webBaseUrl: value });
  }
  return value;
}

function normalizeWebBaseUrl(value) {
  const url = cleanUrl(value);
  if (!url) return DEFAULT_WEB_BASE_URL;
  if (url === DEFAULT_API_BASE_URL) return DEFAULT_WEB_BASE_URL;
  if (url.includes("connection-lemon.vercel.app")) return DEFAULT_WEB_BASE_URL;
  if (url.includes("contacts.gaid.studio")) return DEFAULT_WEB_BASE_URL;
  return url;
}

function normalizeApiBaseUrl(value, webBaseUrl) {
  const url = cleanUrl(value);
  const webUrl = cleanUrl(webBaseUrl);
  const isLocalWeb = webUrl.includes("localhost") || webUrl.includes("127.0.0.1");
  if (!url) return DEFAULT_API_BASE_URL;
  if (!isLocalWeb && (url.includes("localhost") || url.includes("127.0.0.1"))) {
    return DEFAULT_API_BASE_URL;
  }
  if (url.includes("gaid.studio") && !url.includes("contacts.gaid.studio")) {
    return DEFAULT_API_BASE_URL;
  }
  return url;
}

async function getAccountStatus() {
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getExtensionApiToken()]);
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website to connect this extension.", action: await loginAction() };
  }

  const response = await safeFetch(`${baseUrl}/api/account`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.networkError) {
    return { ok: false, status: 0, error: API_UNREACHABLE_ERROR, action: await loginAction() };
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
      return { ok: false, status: 401, error: SESSION_EXPIRED_ERROR, action: await loginAction() };
    }

    const action = response.status === 402 ? await pricingAction() : null;
    const error = response.status === 402
      ? "Credits are insufficient. Upgrade or wait for your next monthly grant."
      : `${payload.error || "Could not load account status."} Try again shortly.`;
    return { ok: false, status: response.status, error, action };
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
  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body || {})
  });
  if (!response.ok && response.networkError) {
    return { ok: false, status: 0, error: API_UNREACHABLE_ERROR, action: await loginAction() };
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
    }
    const action = response.status === 401
      ? await loginAction()
      : response.status === 402
        ? await pricingAction()
        : null;
    const prompt = response.status === 401
      ? SESSION_EXPIRED_ERROR
      : response.status === 402
        ? "Credits are insufficient. Upgrade or wait for your next monthly grant."
        : "Try again shortly.";
    return {
      ok: false,
      status: response.status,
      credits: payload.credits || null,
      error: response.status === 401 || response.status === 402
        ? prompt
        : `${payload.error || `Request failed with ${response.status}`} ${prompt}`,
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

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      networkError: true,
      error
    };
  }
}

async function safeJson(response) {
  if (!response?.json) return {};
  return response.json().catch(() => ({}));
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
