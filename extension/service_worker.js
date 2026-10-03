importScripts('brand.js');
const BRAND_NAME = globalThis.ReachardBrand.name;
const DEFAULT_API_BASE_URL = "https://contacts.reachard.co";
const DEFAULT_WEB_BASE_URL = "https://reachard.co";
const SUPPORTED_URLS = ["https://*/*", "http://*/*"];
const API_UNREACHABLE_ERROR = "Could not reach the contacts API. Check connection settings.";
const SESSION_EXPIRED_ERROR = "Session expired. Sign in again.";
let customizeWriteQueue = Promise.resolve();
// These queues serialize live work only. Credentials and retry records are durable.
let sessionStorageQueue = Promise.resolve();
let requestStorageQueue = Promise.resolve();

function withSessionStorage(operation) {
  const result = sessionStorageQueue.then(operation, operation);
  sessionStorageQueue = result.catch(() => {});
  return result;
}

function withRequestStorage(operation) {
  const result = requestStorageQueue.then(operation, operation);
  requestStorageQueue = result.catch(() => {});
  return result;
}

async function readSession() {
  return withSessionStorage(async () => {
    await migrateSensitiveStorageUnlocked();
    const [local, settings] = await Promise.all([
      chrome.storage.local.get(['extensionApiToken', 'accountStatus']),
      chrome.storage.sync.get(['apiBaseUrl', 'webBaseUrl'])
    ]);
    const webBaseUrl = normalizeWebBaseUrl(settings.webBaseUrl);
    return { token: String(local.extensionApiToken || '').trim(), account: local.accountStatus,
      webBaseUrl, apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl, webBaseUrl) };
  });
}

function sessionChanged() {
  return { ok: false, status: 409, error: 'Your account changed. Please try again.' };
}

async function sessionIsCurrent(session) {
  return withSessionStorage(async () => {
    const current = await chrome.storage.local.get(['extensionApiToken']);
    return Boolean(session.token) && current.extensionApiToken === session.token;
  });
}

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false}).catch(error => console.warn(error.message));

chrome.action.onClicked.addListener((tab) => {
  if (!Number.isInteger(tab.id) || !Number.isInteger(tab.windowId)) return;
  // Opening must happen synchronously inside the toolbar click's user gesture.
  chrome.sidePanel.open({windowId:tab.windowId}).catch(error => console.warn(error.message));
  void activateCurrentPage(tab);
});

async function activateCurrentPage(tab) {
  try {
    if (!/^https?:\/\//i.test(tab.url || '')) return;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {type:'GET_REACHARD_PAGE_CONTEXT'});
      if (response?.ok) return;
    } catch { /* A new page has no reader until the user invokes Reachard. */ }
    // Only packaged code runs, with the temporary access granted by activeTab.
    await chrome.scripting.insertCSS({target:{tabId:tab.id},files:['content.css']});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['brand.js','content.js']});
  } catch {
    // Chrome-protected pages cannot be read, even after a toolbar click.
  } finally {
    chrome.runtime.sendMessage({type:'REACHARD_PAGE_ACCESS_UPDATED',tabId:tab.id,windowId:tab.windowId}).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  migrateSensitiveStorage().catch(() => {});
  if (details?.reason === "install") {
    openInstallConnectPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  migrateSensitiveStorage().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_REACHARD_SIDE_PANEL') {
    if (!sender.tab || sender.frameId !== 0) { sendResponse({ok:false,error:'Open from the current page.'}); return; }
    // Keep the user gesture: no awaits before opening the browser-owned panel.
    chrome.sidePanel.open({windowId:sender.tab.windowId}).then(() => sendResponse({ok:true})).catch(error => sendResponse({ok:false,error:error.message}));
    return true;
  }
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

async function resolvePanelSender(message, sender) {
  if (sender.url === chrome.runtime.getURL('sidepanel.html') && Number.isInteger(message?.sourceTabId)) {
    try {
      const tab = await chrome.tabs.get(message.sourceTabId);
      const response = await chrome.tabs.sendMessage(tab.id, {type:'GET_REACHARD_PAGE_CONTEXT'});
      const url = response?.pageContext?.sourceUrl || tab.url || '';
      return {...sender, url, tab:{...tab,url}};
    } catch { return {...sender,url:''}; }
  }
  return sender;
}

async function handleMessage(message, sender) {
  if (message?.type === "SET_EMAIL_CUSTOMIZE") {
    // Capture before joining the save queue, not when a delayed task executes.
    const session = readSession();
    // Attach a rejection handler now even if an earlier save is still pending.
    session.catch(() => {});
    // The final close/pagehide save cannot overtake an older preference write.
    customizeWriteQueue = customizeWriteQueue.catch(() => {}).then(async () =>
      setEmailCustomize(message.payload || {}, await resolvePanelSender(message, sender), await session)
    );
    return customizeWriteQueue;
  }
  sender = await resolvePanelSender(message, sender);
  switch (message?.type) {
    case "REACHARD_PAGE_CHANGED":
      return { ok: true };
    case "GET_EXTENSION_SESSION_STATUS":
      return getLocalSessionStatus(sender);
    case "GET_EXTENSION_PRESENCE":
      return getExtensionPresence(sender);
    case "CONNECT_EXTENSION_TOKEN":
      return connectExtensionSession(message.payload || {}, sender);
    case "CLEAR_EXTENSION_SESSION":
      return clearExtensionSession(sender, { requireAllowedWebsite: false });
    case "CONTACTS_SEARCH":
      return postJson("/api/contacts/search", message.payload, sender);
    case "CONTACTS_REVEAL":
      return postJson("/api/contacts/reveal", message.payload, sender);
    case "EMAIL_DRAFT":
      return postJson("/api/email/draft", message.payload, sender);
    case "GET_ACCOUNT_STATUS":
      return getAccountStatus(sender);
    case "GET_SIGN_IN_ACTION":
      return { ok: true, action: await loginAction(sender) };
    // Acknowledge older clients without storing or broadcasting language.
    case "GET_EXTENSION_LANGUAGE":
    case "SET_EXTENSION_LANGUAGE":
      return { ok: true, language: "en" };
    case "GET_EMAIL_CUSTOMIZE":
      return getEmailCustomize(sender);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function openInstallConnectPage() {
  try {
    await chrome.tabs.create({ url: `${await getWebBaseUrl()}/getting-started?source=extension-install` });
  } catch (error) {
    console.warn(`Could not open ${BRAND_NAME} after install`, error);
  }
}

async function handleExternalMessage(message, sender) {
  if (["GET_EXTENSION_LANGUAGE", "SET_EXTENSION_LANGUAGE"].includes(message?.type)) {
    return { ok: true, language: "en" };
  }

  if (message?.type === "GET_EXTENSION_SESSION_STATUS") {
    return getLocalSessionStatus(sender);
  }
  if (message?.type === "GET_EXTENSION_PRESENCE") return getExtensionPresence(sender);

  if (message?.type === "CLEAR_EXTENSION_SESSION") {
    return clearExtensionSession(sender, { requireAllowedWebsite: true });
  }

  if (message?.type !== "CONNECT_EXTENSION_TOKEN") {
    return { ok: false, error: "Unknown external message type" };
  }

  return connectExtensionSession(message.payload || message, sender);
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
  await withSessionStorage(async () => {
    await chrome.storage.local.remove(['accountStatus']);
    await chrome.storage.sync.remove(['extensionApiToken', 'accountStatus']);
    await chrome.storage.sync.set({ apiBaseUrl, webBaseUrl });
    await chrome.storage.local.set({ extensionApiToken: token });
  });
  await notifySupportedTabsAccountUpdated();
  await returnToSourceTab(message.returnTo, sender);
  return { ok: true };
}

function getExtensionPresence(sender) {
  if (!sender.url || !isAllowedWebsite(sender.url)) {
    return { ok: false, error: "Website origin is not allowed." };
  }
  return { ok: true, installed: true, extensionId: chrome.runtime.id, version: chrome.runtime.getManifest().version };
}

async function getLocalSessionStatus(sender) {
  const presence = getExtensionPresence(sender);
  if (!presence.ok) return presence;

  const session = await readSession();
  const { token, apiBaseUrl } = session;
  if (!token) {
    return { ...presence, hasToken: false, sessionState: 'signed-out' };
  }

  let response;
  try {
    response = await safeFetch(`${apiBaseUrl}/api/account`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(2500)
    });
  } catch { return { ...presence, hasToken: true, sessionState: 'unavailable' }; }
  if (!await sessionIsCurrent(session)) return { ...presence, hasToken: true, sessionState: 'unavailable' };
  if (response.status === 401) {
    if (!await removeSensitiveSession(token)) return { ...presence, hasToken: true, sessionState: 'unavailable' };
    return { ...presence, hasToken: false, sessionState: 'signed-out' };
  }

  const account = response.ok ? await response.json().catch(() => null) : null;
  // Reading the body can outlive a sign-out or a replacement connection.
  if (!await sessionIsCurrent(session)) return { ...presence, hasToken: true, sessionState: 'unavailable' };
  const userId = Number(account?.user?.id);
  if (!account?.ok || !Number.isSafeInteger(userId) || userId <= 0) return { ...presence, hasToken: true, sessionState: 'unavailable' };
  return { ...presence, hasToken: true, sessionState: 'connected', userId };
}

async function clearExtensionSession(sender, options = {}) {
  if (options.requireAllowedWebsite && (!sender.url || !isAllowedWebsite(sender.url))) {
    return { ok: false, error: "Website origin is not allowed." };
  }

  await removeSensitiveSession();
  await notifySupportedTabsAccountUpdated();
  return { ok: true };
}

async function migrateSensitiveStorage() {
  return withSessionStorage(migrateSensitiveStorageUnlocked);
}

async function migrateSensitiveStorageUnlocked() {
  const [legacy, current] = await Promise.all([
    chrome.storage.sync.get(["extensionApiToken", "accountStatus"]),
    chrome.storage.local.get(["extensionApiToken", "accountStatus"])
  ]);
  const sensitive = {};
  if (legacy.extensionApiToken && !current.extensionApiToken) {
    sensitive.extensionApiToken = legacy.extensionApiToken;
  }
  if (legacy.accountStatus && !current.accountStatus) {
    sensitive.accountStatus = legacy.accountStatus;
  }
  if (Object.keys(sensitive).length) await chrome.storage.local.set(sensitive);
  await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
}

async function removeSensitiveSession(expectedToken) {
  return withSessionStorage(async () => {
    const current = await chrome.storage.local.get(['extensionApiToken']);
    if (expectedToken !== undefined && current.extensionApiToken !== expectedToken) return false;
    await Promise.all([
      chrome.storage.local.remove(["extensionApiToken", "accountStatus"]),
      chrome.storage.sync.remove(["extensionApiToken", "accountStatus"])
    ]);
    return true;
  });
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
  // Extension pages do not receive tabs.sendMessage; notify the native panel too.
  chrome.runtime.sendMessage({ type: "ACCOUNT_AUTH_UPDATED" }).catch(() => {});
  try {
    const tabs = await chrome.tabs.query({ url: SUPPORTED_URLS });
    await Promise.allSettled(tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "ACCOUNT_AUTH_UPDATED" });
      } catch (_error) {
        // The content script is not active in every matching tab yet.
      }
    }));
  } catch (error) {
    console.warn("Could not notify supported tabs after sign in", error);
  }
}

function isAllowedWebsite(url) {
  const origin = new URL(url).origin;
  return [
    "https://reachard.co",
    "https://www.reachard.co",
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
  if (url.includes("contacts.reachard.co")) return DEFAULT_WEB_BASE_URL;
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
  if (url.includes("reachard.co") && !url.includes("contacts.reachard.co")) {
    return DEFAULT_API_BASE_URL;
  }
  return url;
}

async function getAccountStatus(sender, session = null) {
  session ||= await readSession();
  const { apiBaseUrl: baseUrl, token } = session;
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
  if (!await sessionIsCurrent(session)) return sessionChanged();
  if (!response.ok) {
    if (response.status === 401) {
      await removeSensitiveSession(token);
      return { ok: false, status: 401, error: SESSION_EXPIRED_ERROR, action: await loginAction(sender) };
    }

    const action = payload.action || (response.status === 402 ? await pricingAction() : null);
    const error = response.status === 402
      ? "No Contact Kits left. Upgrade or wait for your next monthly grant."
      : `${payload.error || "Could not load account status."} Try again shortly.`;
    return { ok: false, status: response.status, error, action };
  }

  const cached = await withSessionStorage(async () => {
    const current = await chrome.storage.local.get(['extensionApiToken']);
    if (current.extensionApiToken !== token) return false;
    await chrome.storage.local.set({ accountStatus: payload });
    return true;
  });
  if (!cached) return sessionChanged();
  return { ok: true, account: payload };
}

async function postJson(path, body, sender) {
  const session = await readSession();
  const { apiBaseUrl: baseUrl, token } = session;
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website.", action: await loginAction(sender) };
  }

  // A verified account ID survives token renewal without sharing another user's retries.
  let userId = Number(session.account?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    const result = await getAccountStatus(sender, session);
    if (!result.ok) return result;
    userId = Number(result.account?.user?.id);
  }
  if (!Number.isSafeInteger(userId) || userId <= 0) return { ok: false, status: 0, error: 'Could not verify your account. Please try again.' };
  const url = `${baseUrl}${path}`;
  const fingerprint = JSON.stringify([baseUrl, userId, path, body || {}]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  const storageKey = `pendingRequest:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const request = await withRequestStorage(async () => {
    const stored = await chrome.storage.local.get([storageKey]);
    if (stored[storageKey]) return stored[storageKey];
    const record = { key: crypto.randomUUID(), createdAt: Date.now() };
    await chrome.storage.local.set({ [storageKey]: record });
    return record;
  });
  // The server retains replay results for seven days. Never silently create a
  // new charge for an unknown outcome beyond that window.
  if (Date.now() - request.createdAt > 6 * 86400000) {
    return { ok: false, status: 409, error: 'An earlier request could not be confirmed. Contact support before retrying this operation.' };
  }
  if (!await sessionIsCurrent(session)) return sessionChanged();
  const idempotencyKey = request.key;
  const forgetRequest = () => withRequestStorage(async () => {
    const stored = await chrome.storage.local.get([storageKey]);
    if (stored[storageKey]?.key === idempotencyKey) await chrome.storage.local.remove([storageKey]);
  });
  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(body || {})
  });
  if (!response.ok && response.networkError) {
    return { ok: false, status: 0, error: API_UNREACHABLE_ERROR, action: await loginAction(sender) };
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) {
      await removeSensitiveSession(token);
    }
    const action = payload.action || (response.status === 401
      ? await loginAction(sender)
      : response.status === 402
        ? await pricingAction()
        : null);
    const prompt = response.status === 401
      ? SESSION_EXPIRED_ERROR
      : response.status === 402
        ? "No Contact Kits left. Upgrade or wait for your next monthly grant."
        : "Try again shortly.";
    // Keep ambiguous responses (including proxy errors and truncated bodies).
    if ([400, 402, 403, 404, 422, 428, 429].includes(response.status) && payload.ok === false) await forgetRequest();
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
  if (payload.ok !== true) return { ok: false, status: 0, error: 'The response was incomplete. Please retry to recover the result.' };
  if (!await sessionIsCurrent(session)) return sessionChanged();
  await forgetRequest();
  return payload;
}

async function getExtensionApiToken() {
  return (await readSession()).token;
}

async function getEmailCustomize(sender) {
  const response = await webJson("/api/settings/custom", {
    method: "GET"
  }, sender);
  if (!response.ok) return response;
  return {
    ok: true,
    custom: normalizeCustomize(response.custom)
  };
}

async function setEmailCustomize(payload, sender, session) {
  const custom = normalizeCustomize(payload);
  const response = await webJson("/api/settings/custom", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(custom)
  }, sender, session);
  if (!response.ok) return response;
  return {
    ok: true,
    custom: normalizeCustomize(response.custom)
  };
}

async function webJson(path, options, sender, session = null) {
  session ||= await readSession();
  const { webBaseUrl: baseUrl, token } = session;
  if (!token) {
    return { ok: false, status: 401, error: "Sign in on the website.", action: await loginAction(sender) };
  }

  if (!await sessionIsCurrent(session)) return sessionChanged();
  const response = await safeFetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok && response.networkError) {
    return { ok: false, status: 0, error: "Could not reach the website. Check connection settings.", action: await loginAction(sender) };
  }

  const payload = await safeJson(response);
  if (!await sessionIsCurrent(session)) return sessionChanged();
  if (!response.ok) {
    if (response.status === 401) {
      await removeSensitiveSession(token);
    }
    return {
      ok: false,
      status: response.status,
      error: payload.error || `Request failed with ${response.status}`,
      action: response.status === 401 ? await loginAction(sender) : null
    };
  }
  return payload;
}

async function loginAction(sender) {
  const url = new URL(`${await getWebBaseUrl()}/connect-extension`);
  url.searchParams.set("extensionId", chrome.runtime.id);
  const returnTo = safeReturnUrl(sender);
  if (returnTo) url.searchParams.set("return", returnTo);
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

function normalizeCustomize(value) {
  const input = value && typeof value === "object" ? value : {};
  const allowed = {
    tone: new Set(["warm", "direct", "formal", "confident"]),
    length: new Set(["short", "concise", "detailed"]),
    goal: new Set(["advice", "referral", "intro"])
  };
  return {
    tone: allowed.tone.has(input.tone) ? input.tone : "warm",
    length: allowed.length.has(input.length) ? input.length : "concise",
    goal: allowed.goal.has(input.goal) ? input.goal : "advice",
    notes: String(input.notes || "").trim().slice(0, 500)
  };
}
