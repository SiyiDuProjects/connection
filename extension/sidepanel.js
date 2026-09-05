window.ReachardController = { start() {
  const PANEL_ID = "fc-linkedin-panel";
  const DEFAULT_EMAIL_CUSTOMIZE = {
    tone: "warm",
    length: "concise",
    goal: "advice",
    notes: ""
  };
  const MESSAGES = {
    emailWithReachard: "Email with Reachard",
    findWithReachard: "Find with Reachard",
    close: "Close",
    thisCompany: "this company",
    linkedInProfile: "LinkedIn profile",
    linkedInPeopleProfile: "LinkedIn people profile",
    companyContext: "Company context",
    noContacts: "No contacts found yet.",
    findJobContacts: "Find contacts for this role",
    findCompanyContacts: "Find company contacts",
    prepareContact: "Prepare this contact",
    revealEmail: "Reveal work email",
    checkingEmail: "Checking email...",
    viewJob: "View job",
    viewCompany: "View company",
    viewProfile: "View profile",
    optionalRole: "Optional role or ask",
    rolePlaceholder: "Software Engineer Intern, product team, or leave blank",
    contactKitLeft: "email lookup remaining",
    contactKitsLeft: "email lookups remaining",
    openWebsite: "Open website",
    companyContact: "Company contact",
    selectedProfile: "Selected LinkedIn profile",
    rankedReason: "Ranked by role and company relevance",
    unlockedContact: "Unlocked contact",
    relevantContact: "Relevant contact",
    kitUnlocked: "Work email found",
    unlockPrompt: "Unlock to see email and personalized outreach",
    unlocking: "Unlocking...",
    unlockKit: "Find work email",
    writing: "Writing...",
    regenerate: "Regenerate outreach",
    writeOutreach: "Write outreach",
    outreachIncluded: "Personalized outreach included",
    used: "Used:",
    missing: "Missing:",
    review: "Review:",
    aiUnavailable: "AI was unavailable, so a safe template was used.",
    openEmailApp: "Open email app",
    unsupportedPage: "This page is not supported yet.",
    couldNotReadCompany: "Could not read the company name from this page.",
    couldNotReadPage: "Could not read the page.",
    couldNotFindContacts: "Could not find contacts.",
    couldNotUnlock: "Could not unlock contact.",
    unlockBeforeWriting: "Unlock this contact before writing outreach.",
    couldNotDraft: "Could not draft email.",
    signInWebsite: "Sign in on the website.",
    logInToReachard: "Log In to Reachard",
    viewContacts: "View contacts",
    closeSearch: "Close",
    searchingContacts: "Finding contacts...",
    searchingCompany: "Searching relevant people at {company}",
    contactsAtCompany: "Contacts at {company}",
    extensionRefreshed: "Extension context was refreshed. Reload this tab and try again.",
    customize: "Email preferences",
    finishSetup: "Finish setup",
    openSupportedPage: "Open a job, company, or LinkedIn profile page to search.",
    tone: "Tone",
    warm: "Warm",
    direct: "Direct",
    formal: "Formal",
    confident: "Confident",
    length: "Length",
    short: "Short",
    concise: "Concise",
    detailed: "Detailed",
    goal: "Goal",
    askAdvice: "Ask advice",
    exploreReferral: "Explore referral",
    requestIntro: "Request intro",
    extraStyleNotes: "Extra style notes",
    styleNotesPlaceholder: "Example: sound less formal, mention curiosity about product work.",
    saveStyle: "Save style",
    reset: "Reset",
    draftIntro: "Draft intro",
    couldNotLoadCustom: "Could not load custom settings.",
    couldNotLoadAccount: "Could not load account.",
    couldNotSaveCustom: "Could not save custom settings.",
    customSaved: "Custom settings saved.",
    couldNotResetCustom: "Could not reset custom settings.",
    customReset: "Custom settings reset."
  };

  const PAGE_TYPES = {
    LINKEDIN_JOB: "linkedin_job",
    LINKEDIN_COMPANY: "linkedin_company",
    LINKEDIN_PERSON: "linkedin_person",
    EXTERNAL_JOB: "external_job",
    COMPANY_SITE: "company_site"
  };

  let state = {
    loading: false,
    error: "",
    prompt: null,
    action: null,
    creditsRemaining: null,
    account: null,
    authenticated: null,
    accountLoading: false,
    accountError: "",
    customizeError: "",
    accountNotice: "",
    emailCustomize: { ...DEFAULT_EMAIL_CUSTOMIZE },
    contacts: [],
    searchSheetOpen: false,
    pageContext: null,
    manualJobTitle: "",
    revealed: new Map(),
    revealing: new Set(),
    drafts: new Map(),
    drafting: new Set()
  };
  let customizeTimer = null;
  let customizeSave = null;
  let customizeRevision = 0;
  let savedCustomizeRevision = 0;
  let disposed = false;
  let sourceTabId = null;
  let activeKey = "";
  let accountRequest = 0;
  const pageStates = new Map();

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
    if (disposed) return;
    const panel = ensurePanel();
    window.ReachardUI.render(panel, state, {
      search: runSearch,
      reveal: revealEmail,
      draft: draftEmail,
      showResults(open) { state.searchSheetOpen = open; renderPanel(); },
      customize(value) {
        const next = normalizeCustomize(value);
        const editingNotes = next.notes !== state.emailCustomize.notes;
        state.emailCustomize = next;
        state.customizeError = "";
        customizeRevision++;
        window.clearTimeout(customizeTimer);
        renderPanel();
        if (editingNotes) customizeTimer = window.setTimeout(saveCustomizeFromPanel, 450);
        else void saveCustomizeFromPanel();
      },
      manualRole(value) { state.manualJobTitle = value; renderPanel(); },
      save: saveCustomizeFromPanel,
      async close() {
        void saveCustomizeFromPanel();
        try {
          const { id: windowId } = await chrome.windows.getCurrent();
          await chrome.sidePanel.close({ windowId });
        } catch (error) { state.error = error.message; renderPanel(); }
      },
      editDraft(id, changes) {
        const draft = state.drafts.get(id);
        if (!draft) return;
        state.drafts.set(id, {...draft, ...changes});
        renderPanel();
      },
      openUrl(value) { const url = safeHttpUrl(value); if (url) window.open(url, '_blank', 'noopener,noreferrer'); },
      openMail(id) {
        const draft = state.drafts.get(id);
        const contact = findContact(id);
        const email = state.revealed.get(id) || contact?.email;
        if (draft && email) window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(draft.subject || '')}&body=${encodeURIComponent(draft.body || '')}`;
      }
    });
  }

  function updatePage({ tabId, pageContext, pending }) {
    if (disposed) return;
    if (pending && sourceTabId === tabId) return;
    sourceTabId = tabId;
    const key = `${tabId}:${contextIdentity(pageContext)}`;
    if (key === activeKey) {
      state.pageContext = pageContext || null;
      const wasPending = state.contextPending;
      state.contextPending = Boolean(pending);
      renderPanel();
      if (wasPending && !pending) void loadAccountStatus();
      return;
    }
    if (activeKey && state.pageContext) pageStates.set(activeKey, state);
    const previous = state;
    state = pageStates.get(key) || {
      ...previous, loading: false, error: "", prompt: null, action: null,
      contacts: [], searchSheetOpen: false, manualJobTitle: "",
      revealed: new Map(), revealing: new Set(), drafts: new Map(), drafting: new Set()
    };
    // Account and style are shared; contact results belong to their originating tab and role.
    for (const name of ["emailCustomize", "authenticated", "account", "creditsRemaining", "customizeError"]) state[name] = previous[name];
    state.sourceTabId = tabId;
    state.pageContext = pageContext || null;
    state.contextPending = Boolean(pending);
    activeKey = key;
    while (pageStates.size > 8) pageStates.delete(pageStates.keys().next().value);
    renderPanel();
    if (!pending) void loadAccountStatus();
  }

  async function runSearch() {
    const operationState = state;
    operationState.loading = true;
    operationState.searchSheetOpen = true;
    operationState.error = "";
    operationState.prompt = null;
    operationState.action = null;
    operationState.contacts = [];
    operationState.drafts.clear();
    renderPanel();

    try {
      if (!operationState.pageContext) {
        throw apiError({ ok: false, status: 400, error: t("unsupportedPage") }, t("unsupportedPage"));
      }

      if (operationState.pageContext.type === PAGE_TYPES.LINKEDIN_PERSON) {
        operationState.contacts = [contactFromPersonContext(operationState.pageContext)];
        return;
      }

      if (!operationState.pageContext.companyName && !operationState.pageContext.companyDomain) {
        throw apiError({
          ok: false,
          status: 400,
          error: t("couldNotReadCompany")
        }, t("couldNotReadPage"));
      }

      const response = await sendRuntimeMessage({
        type: "CONTACTS_SEARCH",
        payload: { pageContext: effectivePageContext(operationState) }
      }, operationState.sourceTabId);
      if (!response?.ok) throw apiError(response, t("couldNotFindContacts"));
      setCredits(response, operationState);
      operationState.contacts = response.contacts || [];
    } catch (error) {
      applyError(error, t("couldNotFindContacts"), operationState);
    } finally {
      operationState.loading = false;
      renderPanel();
    }
  }

  async function loadPanelData() {
    await loadEmailCustomize();
  }

  function contextIdentity(context) {
    if (!context) return "";
    return [
      context.type,
      context.sourceUrl || context.jobUrl || context.personLinkedInUrl,
      context.companyName || context.companyDomain,
      context.jobTitle || context.personName
    ].filter(Boolean).join("|");
  }

  async function loadEmailCustomize() {
    const revision = customizeRevision;
    state.accountNotice = "";
    try {
      const response = await sendRuntimeMessage({ type: "GET_EMAIL_CUSTOMIZE" });
      if (customizeRevision !== revision) return;
      if (!response?.ok) {
        state.emailCustomize = { ...DEFAULT_EMAIL_CUSTOMIZE };
        state.authenticated = response?.status === 401 ? false : null;
        state.accountError = response?.error || t("signInWebsite");
        state.action = response?.action || null;
        return;
      }
      state.emailCustomize = normalizeCustomize(response.custom);
      state.authenticated = true;
      state.accountError = "";
    } catch (error) {
      state.emailCustomize = { ...DEFAULT_EMAIL_CUSTOMIZE };
      state.accountError = error.message || t("couldNotLoadCustom");
    }
  }

  async function loadAccountStatus() {
    const request = ++accountRequest;
    state.accountLoading = true;
    state.accountError = "";
    state.accountNotice = "";
    renderPanel();
    try {
      const response = await sendRuntimeMessage({ type: "GET_ACCOUNT_STATUS" });
      if (request !== accountRequest || disposed) return;
      if (!response?.ok) {
        state.account = null;
        state.authenticated = response?.status === 401 ? false : state.authenticated;
        state.accountError = response?.error || t("signInWebsite");
        state.action = response?.action || null;
        return;
      }
      state.account = response.account;
      state.authenticated = true;
      setCredits(response.account);
    } catch (error) {
      if (request !== accountRequest || disposed) return;
      state.accountError = error.message || t("couldNotLoadAccount");
    } finally {
      if (request === accountRequest && !disposed) { state.accountLoading = false; renderPanel(); }
    }
  }

  function contactFromPersonContext(context) {
    return {
      id: context.personLinkedInUrl || context.personName || "linkedin-person",
      provider: "linkedin-profile",
      name: context.personName,
      title: context.personTitle,
      companyName: context.companyName,
      companyDomain: context.companyDomain,
      linkedinUrl: context.personLinkedInUrl,
      email: "",
      reasons: [t("selectedProfile")]
    };
  }

  async function revealEmail(contactId) {
    const operationState = state;
    const contact = findContact(contactId, operationState);
    if (!contact) return;
    if (operationState.revealed.has(contactId) || contact.email || operationState.revealing.has(contactId)) return;

    operationState.revealing.add(contactId);
    operationState.error = "";
    operationState.prompt = null;
    operationState.action = null;
    renderPanel();

    try {
      const response = await sendRuntimeMessage({
        type: "CONTACTS_REVEAL",
        payload: { contact, pageContext: operationState.pageContext }
      }, operationState.sourceTabId);
      if (!response?.ok) throw apiError(response, t("couldNotUnlock"));
      setCredits(response, operationState);
      operationState.revealed.set(contactId, response.email);
      await draftEmail(contactId, operationState);
    } catch (error) {
      applyError(error, t("couldNotUnlock"), operationState);
    } finally {
      operationState.revealing.delete(contactId);
      renderPanel();
    }
  }

  async function draftEmail(contactId, operationState = state) {
    const contact = findContact(contactId, operationState);
    if (!contact) return;

    const email = operationState.revealed.get(contactId) || contact.email;
    if (!email) {
      operationState.error = t("unlockBeforeWriting");
      operationState.prompt = null;
      operationState.action = null;
      renderPanel();
      return;
    }

    operationState.drafting.add(contactId);
    operationState.error = "";
    operationState.prompt = null;
    operationState.action = null;
    renderPanel();

    try {
      if (!await saveCustomizeFromPanel()) throw new Error(operationState.customizeError || t("couldNotSaveCustom"));
      const response = await sendRuntimeMessage({
        type: "EMAIL_DRAFT",
        payload: {
          contact: { ...contact, email },
          pageContext: effectivePageContext(operationState)
        }
      }, operationState.sourceTabId);
      if (!response?.ok) throw apiError(response, t("couldNotDraft"));
      setCredits(response, operationState);
      operationState.drafts.set(contactId, response);
    } catch (error) {
      applyError(error, t("couldNotDraft"), operationState);
    } finally {
      operationState.drafting.delete(contactId);
      renderPanel();
    }
  }

  function effectivePageContext(target = state) {
    return {
      ...(target.pageContext || {}),
      jobTitle: target.pageContext?.jobTitle || target.manualJobTitle.trim()
    };
  }

  function apiError(response, fallback) {
    const error = new Error(response?.error || fallback);
    error.action = response?.action || null;
    error.status = response?.status || null;
    error.credits = response?.credits || null;
    return error;
  }

  function applyError(error, fallback, target = state) {
    setCredits(error, target);
    if (error.status === 401) {
      target.authenticated = false;
      target.prompt = error.message || t("signInWebsite");
      target.error = "";
    } else {
      target.error = error.message || fallback;
      target.prompt = null;
    }
    target.action = error.action || null;
  }

  function setCredits(source, target = state) {
    const remaining = source?.credits?.remaining
      ?? source?.credits?.balance
      ?? source?.onboarding?.billing?.creditsRemaining;
    if (Number.isFinite(Number(remaining))) {
      state.creditsRemaining = Number(remaining);
      target.creditsRemaining = Number(remaining);
    }
  }

  async function saveCustomizeFromPanel() {
    window.clearTimeout(customizeTimer);
    customizeTimer = null;
    if (customizeSave) return customizeSave;
    if (savedCustomizeRevision === customizeRevision) return true;
    // Serialize writes so a slower, older request cannot overwrite the latest choice.
    customizeSave = (async () => {
      while (!disposed && savedCustomizeRevision !== customizeRevision) {
        const revision = customizeRevision;
        const submitted = normalizeCustomize(state.emailCustomize);
        try {
          const response = await sendRuntimeMessage({ type: "SET_EMAIL_CUSTOMIZE", payload: submitted });
          if (!response?.ok) throw new Error(response?.error || t("couldNotSaveCustom"));
          savedCustomizeRevision = revision;
          if (revision === customizeRevision) {
            state.emailCustomize = normalizeCustomize(response.custom || submitted);
            state.customizeError = "";
          }
        } catch (error) {
          if (revision !== customizeRevision) continue;
          state.customizeError = error.message || t("couldNotSaveCustom");
          return false;
        }
      }
      return savedCustomizeRevision === customizeRevision;
    })();
    try { return await customizeSave; }
    finally { customizeSave = null; renderPanel(); }
  }

  function normalizeCustomize(value) {
    const input = value && typeof value === "object" ? value : {};
    const allowed = {
      tone: new Set(["warm", "direct", "formal", "confident"]),
      length: new Set(["short", "concise", "detailed"]),
      goal: new Set(["advice", "referral", "intro"])
    };
    return {
      tone: allowed.tone.has(input.tone) ? input.tone : DEFAULT_EMAIL_CUSTOMIZE.tone,
      length: allowed.length.has(input.length) ? input.length : DEFAULT_EMAIL_CUSTOMIZE.length,
      goal: allowed.goal.has(input.goal) ? input.goal : DEFAULT_EMAIL_CUSTOMIZE.goal,
      notes: String(input.notes || "").slice(0, 500)
    };
  }

  function findContact(contactId, target = state) {
    return target.contacts.find((contact, index) => {
      const id = contact.id || contact.linkedinUrl || String(index);
      return id === contactId;
    });
  }

  async function sendRuntimeMessage(message, tabId = sourceTabId) {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      throw new Error(t("extensionRefreshed"));
    }

    try {
      return await chrome.runtime.sendMessage({ ...message, sourceTabId: tabId });
    } catch (error) {
      if (String(error?.message || "").includes("Extension context invalidated")) {
        throw new Error(t("extensionRefreshed"));
      }
      throw error;
    }
  }

  function safeHttpUrl(value) {
    let url = String(value || "").trim();
    if (!url) return "";
    if (/^(www\.)?linkedin\.com\//i.test(url)) {
      url = `https://${url}`;
    }
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
    } catch (_error) {
      return "";
    }
  }

  function t(key, values = {}) {
    const template = MESSAGES[key] || key;
    return Object.entries(values).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template
    );
  }


  renderPanel();
  const contextSubscription = window.ReachardPanelContext.start(updatePage);
  const refreshAccount = async message => {
    if (message?.type !== "ACCOUNT_AUTH_UPDATED") return;
    if (await saveCustomizeFromPanel()) await loadPanelData();
    await loadAccountStatus();
  };
  chrome.runtime.onMessage.addListener(refreshAccount);
  void loadPanelData().then(renderPanel);
  window.addEventListener("pagehide", () => {
    // Dispatch the latest value before the extension page is destroyed. The worker
    // serializes this after older writes, even if this page can no longer await them.
    if (savedCustomizeRevision !== customizeRevision) {
      void sendRuntimeMessage({ type: "SET_EMAIL_CUSTOMIZE", payload: normalizeCustomize(state.emailCustomize) }).catch(() => {});
    }
    disposed = true;
    window.clearTimeout(customizeTimer);
    chrome.runtime.onMessage.removeListener(refreshAccount);
    void contextSubscription.then(stop => stop());
  }, { once: true });
} };
