(function () {
  const ROOT_ID = "fc-linkedin-root";
  const PANEL_ID = "fc-linkedin-panel";
  const BUTTON_ID = "fc-linkedin-button";
  const DEBUG_ATTR = "data-fc-linkedin-loaded";
  const CLEANUP_KEY = "__fcLinkedInCleanup";

  let state = {
    loading: false,
    error: "",
    action: null,
    contacts: [],
    job: null,
    revealed: new Map(),
    revealing: new Set()
  };

  function isJobPage() {
    if (location.hostname !== "www.linkedin.com") return false;
    if (location.pathname.startsWith("/jobs/view/")) return true;
    if (location.pathname.startsWith("/jobs/collections/")) return true;
    if (location.pathname.startsWith("/jobs/search-results/")) {
      return new URLSearchParams(location.search).has("currentJobId");
    }
    if (location.pathname.startsWith("/jobs/search/")) {
      return new URLSearchParams(location.search).has("currentJobId");
    }
    return false;
  }

  function textFrom(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return "";
  }

  function getJobContext() {
    const title = textFrom([
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__title",
      ".top-card-layout__title",
      'a[href*="/jobs/view/"]',
      "h1"
    ]);

    const companyName = textFrom([
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".top-card-layout__second-subline a",
      'a[href*="/company/"][href*="/life/"] p a',
      'a[href*="/company/"][href*="/life/"]'
    ]) || companyNameFromAriaLabel();

    const locationText = textFrom([
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__primary-description-container",
      ".topcard__flavor-row .topcard__flavor--bullet",
      ".top-card-layout__second-subline"
    ]);

    return {
      companyName,
      jobTitle: title,
      jobLocation: locationText,
      jobUrl: location.href
    };
  }

  function companyNameFromAriaLabel() {
    const companyElement = document.querySelector('[aria-label^="Company,"]');
    const label = companyElement?.getAttribute("aria-label") || "";
    return label
      .replace(/^Company,\s*/i, "")
      .replace(/\.$/, "")
      .trim();
  }

  function ensureButton() {
    if (!isJobPage()) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }

    const existing = document.getElementById(BUTTON_ID);
    const target = findJobActionsTarget();
    if (existing && document.body.contains(existing)) {
      const root = document.getElementById(ROOT_ID);
      if (root && target && root.parentElement !== target.row) {
        root.removeAttribute("style");
        setInlineRootClass(root, target);
        placeButtonRoot(root, target);
      } else if (root && target) {
        root.removeAttribute("style");
        setInlineRootClass(root, target);
      } else if (root && !target && !root.classList.contains("fc-floating-entry")) {
        root.removeAttribute("style");
        root.className = "fc-root fc-entry fc-floating-entry";
        document.body.appendChild(root);
      }
      return;
    }

    document.getElementById(ROOT_ID)?.remove();

    const root = document.createElement("div");
    root.className = target ? "" : "fc-root fc-entry fc-floating-entry";
    root.id = ROOT_ID;
    if (target) setInlineRootClass(root, target);

    const button = document.createElement("button");
    button.className = target ? inlineButtonClass(target) : "fc-button";
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Find Contacts";
    button.addEventListener("click", openPanel);

    root.appendChild(button);
    if (target) {
      placeButtonRoot(root, target);
    } else {
      document.body.appendChild(root);
    }
  }

  function findJobActionsTarget() {
    const saveButton = Array.from(document.querySelectorAll("button"))
      .filter((button) => isVisible(button) && isSaveButton(button))
      .sort((first, second) => scoreJobActionButton(second) - scoreJobActionButton(first))[0];

    if (!saveButton) return null;

    const saveWrapper = saveButton.parentElement;
    const row = saveWrapper?.parentElement;
    if (!saveWrapper || !row) return null;

    row.classList.add("fc-actions-row");
    return { row, after: saveWrapper, saveButton };
  }

  function setInlineRootClass(root, target) {
    root.className = `${target.after.className} fc-root fc-entry fc-inline-entry`.trim();
    const button = root.querySelector(`#${BUTTON_ID}`);
    if (button) button.className = inlineButtonClass(target);
  }

  function inlineButtonClass(target) {
    const extraClass = isSearchResultsJobPage() ? " fc-search-results-button" : "";
    return `${target.saveButton.className} fc-button fc-inline-button${extraClass}`.trim();
  }

  function isSearchResultsJobPage() {
    if (!location.pathname.startsWith("/jobs/search-results/")) return false;
    return new URLSearchParams(location.search).has("currentJobId");
  }

  function scoreJobActionButton(button) {
    const rect = button.getBoundingClientRect();
    let score = 0;
    if (button.closest(".jobs-search__job-details")) score += 100;
    if (button.closest(".jobs-details")) score += 80;
    if (button.closest(".job-details-jobs-unified-top-card")) score += 60;
    if (button.closest(".jobs-unified-top-card")) score += 60;
    if (button.closest(".job-card-container")) score -= 100;
    if (button.closest(".jobs-search-results-list, .scaffold-layout__list")) score -= 80;
    if (rect.left > window.innerWidth * 0.35) score += 30;
    if (rect.top < 420) score += 20;
    if (hasSiblingApplyAction(button)) score += 120;
    return score;
  }

  function hasSiblingApplyAction(button) {
    const row = button.parentElement?.parentElement;
    if (!row) return false;

    return Array.from(row.querySelectorAll("a, button")).some((element) => {
      if (element === button) return false;
      const value = [
        element.textContent,
        element.getAttribute("aria-label")
      ].map((text) => text?.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean).join(" ");
      return value.includes("apply");
    });
  }

  function isSaveButton(button) {
    const values = [
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title")
    ].map((value) => value?.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);

    return values.some((value) => value === "save"
      || value === "saved"
      || value === "save the job"
      || value === "saved the job"
      || value.startsWith("save ")
      || value.startsWith("saved "))
      || button.classList.contains("jobs-save-button");
  }

  function placeButtonRoot(root, target) {
    const { row, after } = target;
    if (after.parentElement === row) {
      row.insertBefore(root, after.nextSibling);
      return;
    }
    row.appendChild(root);
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden";
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.className = "fc-root fc-panel";
    panel.id = PANEL_ID;
    document.body.appendChild(panel);
    return panel;
  }

  function renderPanel() {
    const panel = ensurePanel();
    const company = state.job?.companyName || "this company";
    const subtitle = [state.job?.jobTitle, state.job?.jobLocation].filter(Boolean).join(" · ");

    panel.innerHTML = `
      <div class="fc-header">
        <div>
          <h2 class="fc-title">Find Contacts @ ${escapeHtml(company)}</h2>
          <div class="fc-subtitle">${escapeHtml(subtitle || "LinkedIn job page")}</div>
        </div>
        <button class="fc-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="fc-body">${renderBody()}</div>
    `;

    panel.querySelector(".fc-close").addEventListener("click", () => {
      panel.classList.remove("fc-open");
    });

    panel.querySelectorAll("[data-reveal]").forEach((button) => {
      button.addEventListener("click", () => revealEmail(button.dataset.reveal));
    });

    panel.querySelectorAll("[data-draft]").forEach((button) => {
      button.addEventListener("click", () => draftEmail(button.dataset.draft));
    });

    panel.querySelectorAll("[data-action-url]").forEach((button) => {
      button.addEventListener("click", () => {
        window.open(button.dataset.actionUrl, "_blank", "noopener,noreferrer");
      });
    });

  }

  function renderBody() {
    if (state.loading) return `<div class="fc-status">Finding relevant company contacts...</div>`;
    if (state.error) {
      return `
        <div class="fc-status fc-error">${escapeHtml(state.error)}</div>
        ${renderActionButton(state.action)}
      `;
    }
    if (!state.contacts.length) return `<div class="fc-status">No contacts found yet.</div>`;

    return `
      <div class="fc-section-title">Top Matches</div>
      ${state.contacts.map(renderContact).join("")}
    `;
  }

  function renderActionButton(action) {
    if (!action) return "";
    const label = escapeHtml(action.label || "Open website");
    if (action.url) {
      return `<button class="fc-secondary" type="button" data-action-url="${escapeAttr(action.url)}">${label}</button>`;
    }
    return "";
  }

  function renderContact(contact, index) {
    const id = contact.id || contact.linkedinUrl || String(index);
    const email = state.revealed.get(id) || contact.email;
    const isRevealing = state.revealing.has(id);
    const education = contact.education ? ` · ${contact.education}` : "";
    const locationText = contact.location ? ` · ${contact.location}` : "";
    const reasons = Array.isArray(contact.reasons) && contact.reasons.length
      ? contact.reasons.join(" · ")
      : "Ranked by job and company relevance";

    return `
      <article class="fc-contact">
        <p class="fc-contact-name">${index + 1}. ${escapeHtml(contact.name || "Unknown contact")}</p>
        <p class="fc-contact-meta">${escapeHtml(contact.title || "Company contact")}${escapeHtml(education)}${escapeHtml(locationText)}</p>
        <div class="fc-reasons">${escapeHtml(reasons)}</div>
        ${email ? `<div class="fc-email">${escapeHtml(email)}</div>` : ""}
        <div class="fc-actions">
          ${email ? "" : `<button class="fc-secondary" type="button" data-reveal="${escapeAttr(id)}" ${isRevealing ? "disabled" : ""}>${isRevealing ? "Revealing..." : "Reveal Email"}</button>`}
          <button class="fc-secondary" type="button" data-draft="${escapeAttr(id)}">Draft Email</button>
        </div>
      </article>
    `;
  }

  async function openPanel() {
    state.job = getJobContext();
    const panel = ensurePanel();
    panel.classList.add("fc-open");
    state.loading = true;
    state.error = "";
    state.action = null;
    renderPanel();

    try {
      const response = await sendRuntimeMessage({
        type: "CONTACTS_SEARCH",
        payload: state.job
      });
      if (!response?.ok) throw apiError(response, "Could not find contacts.");
      state.contacts = response.contacts || [];
    } catch (error) {
      applyError(error, "Could not find contacts.");
    } finally {
      state.loading = false;
      renderPanel();
    }
  }

  async function revealEmail(contactId) {
    const contact = findContact(contactId);
    if (!contact) return;
    if (state.revealed.has(contactId) || contact.email || state.revealing.has(contactId)) return;

    state.revealing.add(contactId);
    state.error = "";
    state.action = null;
    renderPanel();

    try {
      const response = await sendRuntimeMessage({
        type: "CONTACTS_REVEAL",
        payload: { contact, job: state.job }
      });
      if (!response?.ok) throw apiError(response, "Could not reveal email.");
      state.revealed.set(contactId, response.email);
      renderPanel();
    } catch (error) {
      applyError(error, "Could not reveal email.");
      renderPanel();
    } finally {
      state.revealing.delete(contactId);
      renderPanel();
    }
  }

  async function draftEmail(contactId) {
    const contact = findContact(contactId);
    if (!contact) return;

    const email = state.revealed.get(contactId) || contact.email;
    if (!email) {
      state.error = "Reveal this contact's email before drafting.";
      state.action = null;
      renderPanel();
      return;
    }

    try {
      const response = await sendRuntimeMessage({
        type: "EMAIL_DRAFT",
        payload: { contact: { ...contact, email }, job: state.job }
      });
      if (!response?.ok) throw apiError(response, "Could not draft email.");
      window.open(response.gmailUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      applyError(error, "Could not draft email.");
      renderPanel();
    }
  }

  function apiError(response, fallback) {
    const error = new Error(response?.error || fallback);
    error.action = response?.action || null;
    return error;
  }

  function applyError(error, fallback) {
    state.error = error.message || fallback;
    state.action = error.action || null;
  }

  function findContact(contactId) {
    return state.contacts.find((contact, index) => {
      const id = contact.id || contact.linkedinUrl || String(index);
      return id === contactId;
    });
  }

  async function sendRuntimeMessage(message) {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      throw new Error("Extension context was refreshed. Reload this LinkedIn tab and try again.");
    }

    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (String(error?.message || "").includes("Extension context invalidated")) {
        throw new Error("Extension context was refreshed. Reload this LinkedIn tab and try again.");
      }
      throw error;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function boot() {
    window[CLEANUP_KEY]?.();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();

    document.documentElement.setAttribute(DEBUG_ATTR, "true");
    ensureButton();
    const observer = new MutationObserver(() => ensureButton());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", ensureButton, true);
    window.addEventListener("resize", ensureButton);

    let lastUrl = location.href;
    const intervalId = window.setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        document.getElementById(ROOT_ID)?.remove();
      }
      ensureButton();
    }, 1000);

    window[CLEANUP_KEY] = () => {
      observer.disconnect();
      window.removeEventListener("scroll", ensureButton, true);
      window.removeEventListener("resize", ensureButton);
      window.clearInterval(intervalId);
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
    };
  }

  if (document.body) {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
})();
