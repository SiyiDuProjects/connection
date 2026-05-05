(function () {
  const WEB_SOURCE = "gaid-web";
  const EXTENSION_SOURCE = "gaid-extension-bridge";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data || {};
    if (message.source !== WEB_SOURCE || !message.id || !message.type) return;

    chrome.runtime.sendMessage(
      {
        type: message.type,
        payload: message.payload || {}
      },
      (response) => {
        window.postMessage(
          {
            source: EXTENSION_SOURCE,
            id: message.id,
            response: response || { ok: false, error: chrome.runtime.lastError?.message || "No response" }
          },
          window.location.origin
        );
      }
    );
  });

  window.postMessage({ source: EXTENSION_SOURCE, type: "READY" }, window.location.origin);
})();
