const apiInput = document.getElementById("apiBaseUrl");
const webInput = document.getElementById("webBaseUrl");
const stateEl = document.getElementById("connectionState");
const detailsEl = document.getElementById("accountDetails");
const statusEl = document.getElementById("status");

const DEFAULT_API_BASE_URL = "https://contacts.gaid.studio";
const DEFAULT_WEB_BASE_URL = "https://gaid.studio";
const DEFAULT_LANGUAGE = "en";
const I18N = {
  en: {
    account: "Account",
    checking: "Checking...",
    signedOut: "Signed out",
    signedIn: "Signed in",
    apiUnreachable: "API unreachable",
    signInDetails: "Sign in with your website account to unlock Contact Kits from LinkedIn jobs.",
    signInWebsite: "Sign in on the website.",
    websiteUrl: "Website URL",
    apiUrl: "API URL",
    signIn: "Sign in",
    upgrade: "Upgrade",
    refreshStatus: "Refresh status",
    permissionDenied: "Permission was not granted for the website or API URL.",
    invalidUrls: "Enter valid website and API URLs.",
    readingConnection: "Reading the current extension connection.",
    free: "Free",
    signedInAccount: "Signed in account",
    contactKitsRemaining: "Contact Kits remaining"
  },
  zh: {
    account: "账号",
    checking: "检查中...",
    signedOut: "未登录",
    signedIn: "已登录",
    apiUnreachable: "API 无法访问",
    signInDetails: "使用网站账号登录，以便从 LinkedIn 职位页解锁 Contact Kits。",
    signInWebsite: "请先在网站上登录。",
    websiteUrl: "网站 URL",
    apiUrl: "API URL",
    signIn: "登录",
    upgrade: "升级",
    refreshStatus: "刷新状态",
    permissionDenied: "未授予网站或 API URL 权限。",
    invalidUrls: "请输入有效的网站和 API URL。",
    readingConnection: "正在读取当前扩展连接。",
    free: "免费",
    signedInAccount: "已登录账号",
    contactKitsRemaining: "Contact Kits 剩余"
  }
};

let language = DEFAULT_LANGUAGE;

boot();

async function boot() {
  const stored = await chrome.storage.sync.get(["apiBaseUrl", "webBaseUrl", "extensionApiToken", "extensionLanguage"]);
  language = normalizeLanguage(stored.extensionLanguage);
  applyTranslations();
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
  await chrome.tabs.create({ url: connectUrl.toString() });
});

document.getElementById("pricing").addEventListener("click", async () => {
  const urls = await saveUrls();
  if (!urls) return;
  await chrome.tabs.create({ url: `${urls.webBaseUrl}/pricing` });
});

document.getElementById("refresh").addEventListener("click", renderStatus);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.extensionLanguage) return;
  language = normalizeLanguage(changes.extensionLanguage.newValue);
  applyTranslations();
  renderStatus();
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
      statusEl.textContent = t("permissionDenied");
      return null;
    }

    await chrome.storage.sync.set({ apiBaseUrl, webBaseUrl });
    return { apiBaseUrl, webBaseUrl };
  } catch (_error) {
    statusEl.textContent = t("invalidUrls");
    return null;
  }
}

async function renderStatus() {
  stateEl.textContent = t("checking");
  detailsEl.textContent = t("readingConnection");

  const response = await chrome.runtime.sendMessage({ type: "GET_ACCOUNT_STATUS" });
  if (!response?.ok) {
    stateEl.textContent = response?.status === 0 ? t("apiUnreachable") : t("signedOut");
    detailsEl.textContent = response?.error || t("signInWebsite");
    return;
  }

  const plan = response.account?.subscription?.planName || t("free");
  const contactKits = response.account?.credits?.balance ?? 0;
  const email = response.account?.user?.email || t("signedInAccount");
  stateEl.textContent = t("signedIn");
  detailsEl.textContent = `${email} - ${plan} - ${contactKits} ${t("contactKitsRemaining")}`;
}

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
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

function normalizeLanguage(value) {
  return value === "zh" ? "zh" : DEFAULT_LANGUAGE;
}

function t(key) {
  return I18N[normalizeLanguage(language)]?.[key] || I18N.en[key] || key;
}

function applyTranslations() {
  document.documentElement.lang = normalizeLanguage(language);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  if (!stateEl.textContent) stateEl.textContent = t("checking");
  if (!detailsEl.textContent) detailsEl.textContent = t("signInDetails");
}
