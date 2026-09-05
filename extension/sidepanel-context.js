// Runs only in the native side panel. Page extraction stays in content.js.
window.ReachardPanelContext = {
  async start(onChange) {
    const { id: windowId } = await chrome.windows.getCurrent();
    let generation = 0;
    let activeTabId = null;
    let stopped = false;
    const refresh = async () => {
      const request = ++generation;
      try {
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (stopped || request !== generation) return;
        activeTabId = tab?.id ?? null;
        // Clear a previous tab immediately, before awaiting its replacement's content script.
        onChange({ tabId: activeTabId, windowId, pending: true });
        let pageContext = null;
        try {
          if (activeTabId !== null) {
            const response = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_REACHARD_PAGE_CONTEXT' });
            pageContext = response?.ok ? response.pageContext : null;
          }
        } catch { /* Browser pages and tabs not refreshed after install have no content script. */ }
        if (stopped || request !== generation) return;
        onChange({ tabId: activeTabId, windowId, pageContext });
      } catch {
        if (!stopped && request === generation) onChange({ tabId: null, windowId, pageContext: null });
      }
    };
    const activated = info => { if (info.windowId === windowId) void refresh(); };
    const updated = (id, change) => { if (id === activeTabId && (change.status || change.url)) void refresh(); };
    const removed = id => { if (id === activeTabId) void refresh(); };
    const message = (value, sender) => {
      if (value?.type === 'REACHARD_PAGE_CHANGED' && sender.tab?.id === activeTabId) void refresh();
    };
    chrome.tabs.onActivated.addListener(activated);
    chrome.tabs.onUpdated.addListener(updated);
    chrome.tabs.onRemoved.addListener(removed);
    chrome.runtime.onMessage.addListener(message);
    await refresh();
    return () => {
      stopped = true;
      generation++;
      chrome.tabs.onActivated.removeListener(activated);
      chrome.tabs.onUpdated.removeListener(updated);
      chrome.tabs.onRemoved.removeListener(removed);
      chrome.runtime.onMessage.removeListener(message);
    };
  }
};
