(function () {
  const WEB_SOURCE = "reachard-web";
  const EXTENSION_SOURCE = "reachard-extension-bridge";
  const SESSION_MESSAGE_TYPES = new Set([
    "GET_EXTENSION_SESSION_STATUS",
    "CONNECT_EXTENSION_TOKEN",
    "CLEAR_EXTENSION_SESSION",
    "GET_EXTENSION_LANGUAGE",
    "SET_EXTENSION_LANGUAGE"
  ]);
  const CONTEXT_REFRESHED_ERROR =
    "Extension context was refreshed. Reload this tab and try again.";

  function postResponse(id, response) {
    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        id,
        response
      },
      window.location.origin
    );
  }

  function stopStaleBridge(id) {
    window.removeEventListener("message", handleMessage);
    postResponse(id, { ok: false, error: CONTEXT_REFRESHED_ERROR });
  }

  function handleMessage(event) {
    if (event.source !== window) return;
    const message = event.data || {};
    if (message.source !== WEB_SOURCE || !message.id || !message.type) return;
    if (!SESSION_MESSAGE_TYPES.has(message.type)) {
      postResponse(message.id, { ok: false, error: "Unsupported website bridge message." });
      return;
    }

    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      stopStaleBridge(message.id);
      return;
    }

    try {
      chrome.runtime.sendMessage(
        {
          type: message.type,
          payload: message.payload || {}
        },
        (response) => {
          let runtimeError = "";
          try {
            runtimeError = chrome.runtime?.lastError?.message || "";
          } catch (_error) {
            stopStaleBridge(message.id);
            return;
          }

          postResponse(
            message.id,
            response || { ok: false, error: runtimeError || "No response" }
          );
        }
      );
    } catch (_error) {
      stopStaleBridge(message.id);
    }
  }

  window.addEventListener("message", handleMessage);

  window.postMessage({ source: EXTENSION_SOURCE, type: "READY" }, window.location.origin);
})();
