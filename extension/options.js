const input = document.getElementById("apiBaseUrl");
const status = document.getElementById("status");

chrome.storage.sync.get(["apiBaseUrl"]).then((stored) => {
  input.value = stored.apiBaseUrl || "https://contacts.gaid.studio";
});

document.getElementById("save").addEventListener("click", async () => {
  const value = input.value.trim().replace(/\/+$/, "");
  const apiBaseUrl = value || "https://contacts.gaid.studio";

  try {
    const origin = new URL(apiBaseUrl).origin;
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      status.textContent = "Permission was not granted for this server URL.";
      return;
    }

    await chrome.storage.sync.set({ apiBaseUrl });
    status.textContent = "Saved.";
  } catch (_error) {
    status.textContent = "Enter a valid server URL.";
  }

  setTimeout(() => {
    status.textContent = "";
  }, 1800);
});
