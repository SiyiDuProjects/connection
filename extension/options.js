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
  apiInput.value = stored.apiBaseUrl || DEFAULT_API_BASE_URL;
  const webBaseUrl = cleanUrl(stored.webBaseUrl);
  webInput.value = !webBaseUrl || webBaseUrl === DEFAULT_API_BASE_URL
    ? DEFAULT_WEB_BASE_URL
    : webBaseUrl;
  if (webInput.value !== stored.webBaseUrl) {
    await chrome.storage.sync.set({ webBaseUrl: webInput.value });
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
  statusEl.textContent = "Disconnected locally. Revoke the website connection from Dashboard > Extension if needed.";
  await renderStatus();
});

async function saveUrls() {
  const apiBaseUrl = cleanUrl(apiInput.value) || DEFAULT_API_BASE_URL;
  const webBaseUrl = cleanUrl(webInput.value) || DEFAULT_WEB_BASE_URL;

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
    stateEl.textContent = response?.status === 0 ? "API unreachable" : "Not connected";
    detailsEl.textContent = response?.error || "Sign in on the website to connect this extension.";
    return;
  }

  const plan = response.account?.subscription?.planName || "Free";
  const credits = response.account?.credits?.balance ?? 0;
  const email = response.account?.user?.email || "Connected account";
  stateEl.textContent = "Connected";
  detailsEl.textContent = `${email} · ${plan} · ${credits} credits remaining`;
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
