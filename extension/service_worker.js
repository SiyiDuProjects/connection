const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const DEFAULT_WEB_BASE_URL = "https://gaid.studio";
const SUPPORTED_URLS = ["https://*/*", "http://*/*"];
const API_UNREACHABLE_ERROR = "Could not reach the contacts API. Check connection settings.";
const SESSION_EXPIRED_ERROR = "Session expired. Sign in again.";

chrome.runtime.onInstalled.addListener(() => {
  refreshSupportedTabs();
});

chrome.runtime.onStartup.addListener(() => {
  refreshSupportedTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
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

async function refreshSupportedTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: SUPPORTED_URLS });
    await Promise.allSettled(tabs.map(injectIntoTab));
  } catch (error) {
    console.warn("Could not refresh supported content scripts", error);
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

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_EXTENSION_SESSION_STATUS":
      return getLocalSessionStatus(sender);
    case "CONNECT_EXTENSION_TOKEN":
      return connectExtensionSession(message.payload || {}, sender);
    case "CLEAR_EXTENSION_SESSION":
      return clearExtensionSession(sender);
    case "CONTACTS_SEARCH":
      return postJson("/api/contacts/search", message.payload, sender);
    case "CONTACTS_REVEAL":
      return postJson("/api/contacts/reveal", message.payload, sender);
    case "EMAIL_DRAFT":
      return postJson("/api/email/draft", message.payload, sender);
    case "GET_ACCOUNT_STATUS":
      return getAccountStatus(sender);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function handleExternalMessage(message, sender) {
  if (message?.type === "GET_EXTENSION_SESSION_STATUS") {
    return getLocalSessionStatus(sender);
  }

  if (message?.type === "CLEAR_EXTENSION_SESSION") {
    return clearExtensionSession(sender);
  }

  if (message?.type !== "CONNECT_EXTENSION_TOKEN") {
    return { ok: false, error: "Unknown external message type" };
  }

  return connectExtensionSession(message, sender);
}

async function connectExtensionSession(message, sender) {
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
  await notifySupportedTabsAccountUpdated();
  await returnToSourceTab(message.returnTo, sender);
  return { ok: true };
}

async function getLocalSessionStatus(sender) {
  if (!sender.url || !isAllowedWebsite(sender.url)) {
    return { ok: false, error: "Website origin is not allowed." };
  }

  const token = await getExtensionApiToken();
  return { ok: true, hasToken: Boolean(token) };
}

async function clearExtensionSession(sender) {
  if (!sender.url || !isAllowedWebsite(sender.url)) {
    return { ok: false, error: "Website origin is not allowed." };
  }

  await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
  await notifySupportedTabsAccountUpdated();
  return { ok: true };
}

async function returnToSourceTab(value, sender) {
  const returnUrl = safeReturnUrl({ url: value });
  if (!returnUrl || !sender?.tab?.id) return;

  try {
    await chrome.tabs.update(sender.tab.id, { url: returnUrl });
  } catch (error) {
    console.warn("Could not return to source tab after sign in", error);
  }
}

async function notifySupportedTabsAccountUpdated() {
  try {
    const tabs = await chrome.tabs.query({ url: SUPPORTED_URLS });
    await Promise.allSettled(tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "ACCOUNT_AUTH_UPDATED" });
      } catch (_error) {
        await injectIntoTab(tab);
      }
    }));
  } catch (error) {
    console.warn("Could not notify supported tabs after sign in", error);
  }
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

async function getAccountStatus(sender) {
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getExtensionApiToken()]);
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website.", action: await loginAction(sender) };
  }

  const response = await safeFetch(`${baseUrl}/api/account`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.networkError) {
    return { ok: false, status: 0, error: API_UNREACHABLE_ERROR, action: await loginAction(sender) };
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
      return { ok: false, status: 401, error: SESSION_EXPIRED_ERROR, action: await loginAction(sender) };
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

async function postJson(path, body, sender) {
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getExtensionApiToken()]);
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website.", action: await loginAction(sender) };
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
    return { ok: false, status: 0, error: API_UNREACHABLE_ERROR, action: await loginAction(sender) };
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
    }
    const action = response.status === 401
      ? await loginAction(sender)
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

async function loginAction(sender) {
  const url = new URL(`${await getWebBaseUrl()}/connect-extension`);
  url.searchParams.set("extensionId", chrome.runtime.id);
  return {
    label: "Sign in",
    url: url.toString()
  };
}

function safeReturnUrl(sender) {
  const url = sender?.tab?.url || sender?.url || "";
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    if (parsed.protocol === "chrome-extension:") {
      return parsed.toString();
    }
  } catch (_error) {
    return "";
  }

  return "";
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
