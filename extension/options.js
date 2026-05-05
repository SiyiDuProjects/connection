const apiInput = document.getElementById("apiBaseUrl");
const webInput = document.getElementById("webBaseUrl");
const stateEl = document.getElementById("connectionState");
const detailsEl = document.getElementById("accountDetails");
const statusEl = document.getElementById("status");

const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const DEFAULT_WEB_BASE_URL = "https://gaid.studio";

boot();

async function boot() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl", "webBaseUrl", "extensionApiToken"]);
  webInput.value = normalizeWebBaseUrl(stored.webBaseUrl);
  apiInput.value = normalizeApiBaseUrl(stored.apiBaseUrl, webInput.value);
  if (webInput.value !== stored.webBaseUrl || apiInput.value !== stored.apiBaseUrl) {
    await chrome.storage.sync.set({ apiBaseUrl: apiInput.value, webBaseUrl: webInput.value });
  }
  await renderStatus();
}

document.getElementById("connect").addEventListener("click", async () => {
  const urls = await saveUrls();
  if (!urls) return;

  const extensionId = chrome.runtime.id;
  const connectUrl = new URL(`${urls.webBaseUrl}/connect-extension`);
  connectUrl.searchParams.set("extensionId", extensionId);
  connectUrl.searchParams.set("return", chrome.runtime.getURL("options.html"));
  await chrome.tabs.create({ url: connectUrl.toString() });
});

document.getElementById("pricing").addEventListener("click", async () => {
  const urls = await saveUrls();
  if (!urls) return;
  await chrome.tabs.create({ url: `${urls.webBaseUrl}/pricing` });
});

document.getElementById("refresh").addEventListener("click", renderStatus);

document.getElementById("clearToken").addEventListener("click", async () => {
  await chrome.storage.sync.remove(["extensionApiToken", "accountStatus"]);
  statusEl.textContent = "Signed out locally. You can sign in again from the website.";
  await renderStatus();
});

async function saveUrls() {
  const webBaseUrl = normalizeWebBaseUrl(webInput.value);
  const apiBaseUrl = normalizeApiBaseUrl(apiInput.value, webBaseUrl);

  try {
    const apiOrigin = new URL(apiBaseUrl).origin;
    const webOrigin = new URL(webBaseUrl).origin;
    const granted = await chrome.permissions.request({
      origins: [`${apiOrigin}/*`, `${webOrigin}/*`]
    });
    if (!granted) {
      statusEl.textContent = "Permission was not granted for the website or API URL.";
      return null;
    }

    await chrome.storage.sync.set({ apiBaseUrl, webBaseUrl });
    return { apiBaseUrl, webBaseUrl };
  } catch (_error) {
    statusEl.textContent = "Enter valid website and API URLs.";
    return null;
  }
}

async function renderStatus() {
  stateEl.textContent = "Checking...";
  detailsEl.textContent = "Reading the current extension connection.";

  const response = await chrome.runtime.sendMessage({ type: "GET_ACCOUNT_STATUS" });
  if (!response?.ok) {
    stateEl.textContent = response?.status === 0 ? "API unreachable" : "Signed out";
    detailsEl.textContent = response?.error || "Sign in on the website.";
    return;
  }

  const plan = response.account?.subscription?.planName || "Free";
  const credits = response.account?.credits?.balance ?? 0;
  const email = response.account?.user?.email || "Signed in account";
  stateEl.textContent = "Signed in";
  detailsEl.textContent = `${email} · ${plan} · ${credits} credits remaining`;
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
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
