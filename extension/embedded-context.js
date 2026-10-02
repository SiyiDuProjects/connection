// The worker derives the source tab from this extension frame's sender. No page
// postMessage bridge or caller-supplied tab ID can redirect privileged requests.
window.ReachardPanelContext = {
  close() { return chrome.runtime.sendMessage({ type: 'CLOSE_REACHARD_EMBEDDED_PANEL' }); },
  async start(onChange) {
    let tabId = null;
    let generation = 0;
    let stopped = false;
    const refresh = async () => {
      const request = ++generation;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'GET_REACHARD_EMBEDDED_CONTEXT' });
        if (stopped || request !== generation) return;
        tabId = result.tabId ?? null;
        onChange({ tabId, windowId: result.windowId, pageContext: result.ok ? result.pageContext : null });
      } catch {
        if (!stopped && request === generation) onChange({ tabId, pageContext: null });
      }
    };
    const message = (value, sender) => {
      if (value?.type === 'REACHARD_PAGE_CHANGED' && (tabId === null || sender.tab?.id === tabId)) void refresh();
    };
    chrome.runtime.onMessage.addListener(message);
    await refresh();
    return () => { stopped = true; generation++; chrome.runtime.onMessage.removeListener(message); };
  }
};
document.getElementById('close-reachard').addEventListener('click', () => void window.ReachardPanelContext.close());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented) void window.ReachardPanelContext.close();
});
