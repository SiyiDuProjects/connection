const input = document.getElementById("apiBaseUrl");
const webInput = document.getElementById("webBaseUrl");
const tokenInput = document.getElementById("apiToken");
const status = document.getElementById("status");
const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const DEFAULT_WEB_BASE_URL = "http://localhost:3000";

chrome.storage.sync.get(["apiBaseUrl", "webBaseUrl", "extensionApiToken"]).then((stored) => {
  input.value = stored.apiBaseUrl || DEFAULT_API_BASE_URL;
  webInput.value = stored.webBaseUrl || DEFAULT_WEB_BASE_URL;
  tokenInput.value = stored.extensionApiToken || "";
});

document.getElementById("save").addEventListener("click", async () => {
  const apiBaseUrl = cleanUrl(input.value) || DEFAULT_API_BASE_URL;
  const webBaseUrl = cleanUrl(webInput.value) || DEFAULT_WEB_BASE_URL;
  const extensionApiToken = tokenInput.value.trim();

  try {
    const origin = new URL(apiBaseUrl).origin;
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      status.textContent = "Permission was not granted for this server URL.";
      return;
    }

    await chrome.storage.sync.set({ apiBaseUrl, webBaseUrl, extensionApiToken });
    status.textContent = "Saved.";
  } catch (_error) {
    status.textContent = "Enter valid URLs.";
  }

  setTimeout(() => {
    status.textContent = "";
  }, 1800);
});

document.getElementById("connect").addEventListener("click", async () => {
  const webBaseUrl = cleanUrl(webInput.value) || DEFAULT_WEB_BASE_URL;
  await chrome.tabs.create({ url: `${webBaseUrl}/dashboard/extension` });
});

document.getElementById("clearToken").addEventListener("click", async () => {
  tokenInput.value = "";
  await chrome.storage.sync.remove(["extensionApiToken"]);
  status.textContent = "Signed out.";
});

function cleanUrl(value) {
  return value.trim().replace(/\/+$/, "");
}
