(function () {
  const ROOT_ID = "fc-linkedin-root";
  const PANEL_ID = "fc-linkedin-panel";
  const BUTTON_ID = "fc-linkedin-button";
  const CLEANUP_KEY = "__fcLinkedInCleanup";
  const AUTH_LISTENER_KEY = "__fcLinkedInAuthListener";
  const DEFAULT_LANGUAGE = "en";
  const BUTTON_REFRESH_DELAY_MS = 250;
  const SIDEBAR_POSITION_KEY = "fcSidebarCenterY";
  const PREVIOUS_FINDS_KEY = "reachardPreviousFinds";
  const SIDEBAR_DRAG_MARGIN_PX = 18;
  const SIDEBAR_DRAG_THRESHOLD_PX = 5;
  const DEFAULT_EMAIL_CUSTOMIZE = {
    tone: "warm",
    length: "concise",
    goal: "advice",
    notes: ""
  };
  const I18N = {
    en: {
      emailWithReachard: "Email with Reachard",
      findWithReachard: "Find with Reachard",
      close: "Close",
      thisCompany: "this company",
      linkedInProfile: "LinkedIn profile",
      linkedInPeopleProfile: "LinkedIn people profile",
      companyContext: "Company context",
      noContacts: "No contacts found yet.",
      contact: "Contact",
      topMatches: "Top Matches",
      preparingContact: "Preparing this contact...",
      findingContacts: "Finding relevant company contacts...",
      optionalRole: "Optional role or ask",
      rolePlaceholder: "Software Engineer Intern, product team, or leave blank",
      contactKitLeft: "Contact Kit left",
      contactKitsLeft: "Contact Kits left",
      openWebsite: "Open website",
      companyContact: "Company contact",
      selectedProfile: "Selected LinkedIn profile",
      rankedReason: "Ranked by role and company relevance",
      unlockedContact: "Unlocked contact",
      relevantContact: "Relevant contact",
      kitUnlocked: "Contact Kit unlocked",
      unlockPrompt: "Unlock to see email and personalized outreach",
      unlocking: "Unlocking...",
      unlockKit: "Unlock Contact Kit",
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
      extensionRefreshed: "Extension context was refreshed. Reload this tab and try again."
    },
    zh: {
      emailWithReachard: "用 Reachard 写邮件",
      findWithReachard: "用 Reachard 查找",
      close: "关闭",
      thisCompany: "这家公司",
      linkedInProfile: "LinkedIn 个人主页",
      linkedInPeopleProfile: "LinkedIn 个人资料",
      companyContext: "公司上下文",
      noContacts: "还没有找到联系人。",
      contact: "联系人",
      topMatches: "最佳匹配",
      preparingContact: "正在准备这个联系人...",
      findingContacts: "正在查找相关公司联系人...",
      optionalRole: "可选职位或诉求",
      rolePlaceholder: "软件工程实习生、产品团队，或留空",
      contactKitLeft: "个 Contact Kit 剩余",
      contactKitsLeft: "个 Contact Kits 剩余",
      openWebsite: "打开网站",
      companyContact: "公司联系人",
      selectedProfile: "当前 LinkedIn 个人主页",
      rankedReason: "按职位和公司相关性排序",
      unlockedContact: "已解锁联系人",
      relevantContact: "相关联系人",
      kitUnlocked: "Contact Kit 已解锁",
      unlockPrompt: "解锁后查看邮箱和个性化外联邮件",
      unlocking: "解锁中...",
      unlockKit: "解锁 Contact Kit",
      writing: "撰写中...",
      regenerate: "重新生成外联邮件",
      writeOutreach: "撰写外联邮件",
      outreachIncluded: "包含个性化外联邮件",
      used: "已使用：",
      missing: "缺失：",
      review: "请检查：",
      aiUnavailable: "AI 暂不可用，已使用安全模板。",
      openEmailApp: "打开邮件应用",
      unsupportedPage: "暂不支持这个页面。",
      couldNotReadCompany: "无法从这个页面读取公司名称。",
      couldNotReadPage: "无法读取页面。",
      couldNotFindContacts: "无法查找联系人。",
      couldNotUnlock: "无法解锁联系人。",
      unlockBeforeWriting: "请先解锁这个联系人，再撰写外联邮件。",
      couldNotDraft: "无法生成邮件草稿。",
      signInWebsite: "请先在网站上登录。",
      extensionRefreshed: "扩展上下文已刷新。请重新加载此标签页后再试。"
    }
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
    activeTab: "home",
    error: "",
    prompt: null,
    action: null,
    creditsRemaining: null,
    account: null,
    accountLoading: false,
    accountError: "",
    emailCustomize: { ...DEFAULT_EMAIL_CUSTOMIZE },
    previousFinds: [],
    contacts: [],
    pageContext: null,
    manualJobTitle: "",
    revealed: new Map(),
    revealing: new Set(),
    drafts: new Map(),
    drafting: new Set(),
    language: DEFAULT_LANGUAGE
  };

  function clampSidebarCenterY(value, root) {
    const height = root?.getBoundingClientRect?.().height || 82;
    const min = SIDEBAR_DRAG_MARGIN_PX + (height / 2);
    const max = Math.max(min, window.innerHeight - SIDEBAR_DRAG_MARGIN_PX - (height / 2));
    return Math.min(max, Math.max(min, value));
  }

  function applySidebarPosition(root, centerY) {
    if (!root) return;
    const nextCenterY = clampSidebarCenterY(centerY, root);
    root.style.top = `${nextCenterY}px`;
    root.style.bottom = "auto";
    root.classList.add("fc-sidebar-entry-positioned");
  }

  function saveSidebarPosition(centerY) {
    try {
      chrome.storage.local.set({ [SIDEBAR_POSITION_KEY]: Math.round(centerY) });
    } catch (_error) {
      // Position persistence is non-critical.
    }
  }

  function loadSidebarPosition(root) {
    try {
      chrome.storage.local.get(SIDEBAR_POSITION_KEY, (items) => {
        const centerY = Number(items?.[SIDEBAR_POSITION_KEY]);
        if (Number.isFinite(centerY) && document.body.contains(root)) {
          applySidebarPosition(root, centerY);
        }
      });
    } catch (_error) {
      // Keep the default CSS position if storage is unavailable.
    }
  }

  function makeSidebarDraggable(root, button) {
    let dragging = false;
    let moved = false;
    let pointerId = null;
    let startY = 0;
    let startCenterY = 0;
    let latestCenterY = 0;

    const finishDrag = () => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("fc-sidebar-entry-dragging");
      if (pointerId !== null) {
        try {
          button.releasePointerCapture(pointerId);
        } catch (_error) {
          // Pointer capture may already be released by the browser.
        }
      }
      pointerId = null;
      if (moved) {
        root.dataset.fcSuppressClick = "true";
        window.setTimeout(() => {
          if (root.dataset.fcSuppressClick === "true") delete root.dataset.fcSuppressClick;
        }, 0);
        saveSidebarPosition(latestCenterY);
      }
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = root.getBoundingClientRect();
      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      startY = event.clientY;
      startCenterY = rect.top + (rect.height / 2);
      latestCenterY = startCenterY;
      root.classList.add("fc-sidebar-entry-dragging");
      button.setPointerCapture(event.pointerId);
    });

    button.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaY) > SIDEBAR_DRAG_THRESHOLD_PX) moved = true;
      latestCenterY = clampSidebarCenterY(startCenterY + deltaY, root);
      applySidebarPosition(root, latestCenterY);
      if (moved) event.preventDefault();
    });

    button.addEventListener("pointerup", finishDrag);
    button.addEventListener("pointercancel", finishDrag);
    button.addEventListener("lostpointercapture", finishDrag);
  }

  if (window[AUTH_LISTENER_KEY]) {
    chrome.runtime.onMessage.removeListener(window[AUTH_LISTENER_KEY]);
  }

  window[AUTH_LISTENER_KEY] = (message) => {
    if (message?.type === "LANGUAGE_UPDATED") {
      state.language = normalizeLanguage(message.language);
      ensureButton();
      if (document.getElementById(PANEL_ID)?.classList.contains("fc-open")) {
        renderPanel();
      }
      return;
    }

    if (message?.type === "ACCOUNT_AUTH_UPDATED") {
      state.error = "";
      state.prompt = null;
      state.action = null;
      if (document.getElementById(PANEL_ID)?.classList.contains("fc-open")) {
        openPanel();
      }
    }
  };
  chrome.runtime.onMessage.addListener(window[AUTH_LISTENER_KEY]);

  const adapters = [
    linkedInAdapter(),
    handshakeAdapter(),
    indeedAdapter(),
    genericCompanyAdapter()
  ];

  function getPageContext() {
    for (const adapter of adapters) {
      const context = adapter.getContext();
      if (context?.type && isSupportedContext(context)) {
        return normalizePageContext(context, adapter.label);
      }
    }
    return null;
  }

  function isSupportedContext(context) {
    if (context.type === PAGE_TYPES.LINKEDIN_PERSON) return Boolean(context.personName || context.personLinkedInUrl);
    return Boolean(context.companyName || context.companyDomain);
  }

  function normalizePageContext(context, label) {
    const sourceUrl = location.href;
    return {
      type: context.type,
      source: label || "",
      companyName: cleanText(context.companyName),
      companyDomain: cleanDomain(context.companyDomain),
      jobTitle: cleanText(context.jobTitle),
      jobLocation: cleanText(context.jobLocation),
      jobDescription: cleanMultiline(context.jobDescription),
      personName: cleanText(context.personName),
      personTitle: cleanText(context.personTitle),
      personLinkedInUrl: cleanText(context.personLinkedInUrl),
      sourceUrl,
      pageTitle: cleanText(context.pageTitle)
    };
  }

  function linkedInAdapter() {
    return {
      label: "LinkedIn",
      getContext() {
        if (location.hostname !== "www.linkedin.com") return null;
        if (isLinkedInJobPage()) return getLinkedInJobContext();
        if (location.pathname.startsWith("/company/")) return getLinkedInCompanyContext();
        if (location.pathname.startsWith("/in/")) return getLinkedInPersonContext();
        return null;
      }
    };
  }

  function isLinkedInJobPage() {
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

  function getLinkedInJobContext() {
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
      type: PAGE_TYPES.LINKEDIN_JOB,
      companyName,
      jobTitle: title,
      jobLocation: locationText,
      jobDescription: getJobDescription(),
      pageTitle: [companyName, title].filter(Boolean).join(" - ")
    };
  }

  function getLinkedInCompanyContext() {
    const companyName = textFrom([
      ".org-top-card-summary__title",
      ".org-top-card-primary-content__title",
      "h1.org-top-card-summary__title",
      "h1"
    ]);
    const website = textFrom([
      'a[href^="http"]:not([href*="linkedin.com"])'
    ]);
    const href = document.querySelector('a[href^="http"]:not([href*="linkedin.com"])')?.href || "";

    return {
      type: PAGE_TYPES.LINKEDIN_COMPANY,
      companyName,
      companyDomain: cleanDomain(href || website),
      pageTitle: companyName || "LinkedIn company"
    };
  }

  function getLinkedInPersonContext() {
    const personName = textFrom([
      "main h1",
      ".pv-text-details__left-panel h1",
      ".text-heading-xlarge"
    ]);
    const personTitle = textFrom([
      ".text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium"
    ]);
    const companyName = textFrom([
      '.pv-text-details__right-panel a[href*="/company/"]',
      '.pv-top-card--experience-list-item a[href*="/company/"]',
      'a[href*="/company/"]'
    ]);

    return {
      type: PAGE_TYPES.LINKEDIN_PERSON,
      companyName,
      personName,
      personTitle,
      personLinkedInUrl: location.href,
      pageTitle: personName || "LinkedIn profile"
    };
  }

  function handshakeAdapter() {
    return {
      label: "Handshake",
      getContext() {
        if (!/(\.|^)joinhandshake\.com$/i.test(location.hostname)) return null;
        if (!looksLikeJobPage()) return null;
        return {
          type: PAGE_TYPES.EXTERNAL_JOB,
          companyName: textFrom(['[data-hook*="employer"]', 'a[href*="/emp/"]', "h2", "h3"]),
          jobTitle: textFrom(["h1", '[data-hook*="job-title"]']),
          jobLocation: textFrom(['[data-hook*="location"]', '[class*="location"]']),
          jobDescription: textFrom(['[data-hook*="description"]', '[class*="description"]', "main"]),
          pageTitle: document.title
        };
      }
    };
  }

  function indeedAdapter() {
    return {
      label: "Indeed",
      getContext() {
        if (!/(\.|^)indeed\.com$/i.test(location.hostname)) return null;
        if (!looksLikeJobPage()) return null;
        return {
          type: PAGE_TYPES.EXTERNAL_JOB,
          companyName: textFrom(['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', ".jobsearch-CompanyInfoContainer a", ".icl-u-lg-mr--sm"]),
          jobTitle: textFrom(['[data-testid="jobsearch-JobInfoHeader-title"]', ".jobsearch-JobInfoHeader-title", "h1"]),
          jobLocation: textFrom(['[data-testid="job-location"]', ".jobsearch-JobInfoHeader-subtitle div"]),
          jobDescription: textFrom(["#jobDescriptionText", ".jobsearch-jobDescriptionText", "main"]),
          pageTitle: document.title
        };
      }
    };
  }

  function genericCompanyAdapter() {
    return {
      label: "Website",
      getContext() {
        if (!["http:", "https:"].includes(location.protocol)) return null;
        if (isExcludedGenericHost(location.hostname)) return null;
        if (location.hostname.endsWith("linkedin.com")) return null;

        const companyName = metaContent("og:site_name")
          || metaContent("application-name")
          || hostCompanyName(location.hostname);
        const jobTitle = looksLikeJobPage() ? textFrom(["h1", '[class*="job-title"]', '[class*="posting-title"]']) : "";
        const jobDescription = looksLikeJobPage() ? textFrom(['[class*="job-description"]', '[class*="posting"]', '[class*="description"]', "main"]) : "";

        return {
          type: jobTitle || jobDescription ? PAGE_TYPES.EXTERNAL_JOB : PAGE_TYPES.COMPANY_SITE,
          companyName,
          companyDomain: location.hostname,
          jobTitle,
          jobDescription,
          pageTitle: document.title || companyName
        };
      }
    };
  }

  function ensureButton() {
    const context = getPageContext();
    if (!context) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }

    const existing = document.getElementById(BUTTON_ID);
    if (existing && document.body.contains(existing)) {
      const label = buttonLabel(context);
      existing.setAttribute("aria-label", label);
      existing.setAttribute("title", label);
      return;
    }

    document.getElementById(ROOT_ID)?.remove();

    const root = document.createElement("div");
    root.className = "fc-root fc-entry fc-sidebar-entry";
    root.id = ROOT_ID;

    const button = document.createElement("button");
    button.className = "fc-sidebar-button";
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", buttonLabel(context));
    button.setAttribute("title", buttonLabel(context));
    button.innerHTML = `
      <span class="fc-sidebar-logo" aria-hidden="true">G</span>
      <span class="fc-sidebar-text">Reachard</span>
    `;
    button.addEventListener("click", (event) => {
      if (root.dataset.fcSuppressClick === "true") {
        event.preventDefault();
        event.stopPropagation();
        delete root.dataset.fcSuppressClick;
        return;
      }
      openPanel();
    });

    root.appendChild(button);
    document.body.appendChild(root);
    loadSidebarPosition(root);
    makeSidebarDraggable(root, button);
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
    const context = state.pageContext || {};
    const title = panelTitle(context);
    const subtitle = panelSubtitle(context);

    panel.innerHTML = `
      <div class="fc-topbar">
        <div class="fc-brand">
          <span class="fc-logo">G</span>
          <span>Reachard</span>
        </div>
        <div class="fc-topbar-actions">
          <button class="fc-icon-button" type="button" aria-label="Notifications">!</button>
          <button class="fc-close" type="button" aria-label="${escapeAttr(t("close"))}">×</button>
        </div>
      </div>
      ${renderTabs()}
      <div class="fc-body">${renderBody()}</div>
    `;

    panel.querySelector(".fc-close").addEventListener("click", () => {
      panel.classList.remove("fc-open");
    });

    const manualJobTitle = panel.querySelector("[data-manual-job-title]");
    if (manualJobTitle) {
      manualJobTitle.addEventListener("input", (event) => {
        state.manualJobTitle = event.target.value;
      });
    }

    panel.querySelectorAll("[data-reveal]").forEach((button) => {
      button.addEventListener("click", () => revealEmail(button.dataset.reveal));
    });

    panel.querySelectorAll("[data-draft]").forEach((button) => {
      button.addEventListener("click", () => draftEmail(button.dataset.draft));
    });

    panel.querySelectorAll("[data-open-mailto]").forEach((button) => {
      button.addEventListener("click", () => {
        const draft = state.drafts.get(button.dataset.openMailto);
        if (draft?.mailtoUrl) window.location.href = draft.mailtoUrl;
      });
    });

    panel.querySelectorAll("[data-action-url]").forEach((button) => {
      button.addEventListener("click", () => {
        window.open(button.dataset.actionUrl, "_blank", "noopener,noreferrer");
      });
    });

    panel.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;
        state.error = "";
        state.prompt = null;
        state.action = null;
        renderPanel();
        if (state.activeTab === "settings") loadAccountStatus();
      });
    });

    panel.querySelector("[data-start-search]")?.addEventListener("click", runSearch);
    panel.querySelector("[data-view-more-finds]")?.addEventListener("click", () => {
      state.activeTab = "home";
      renderPanel();
    });
    panel.querySelector("[data-save-customize]")?.addEventListener("click", saveCustomizeFromPanel);
    panel.querySelector("[data-reset-customize]")?.addEventListener("click", resetCustomize);
    panel.querySelector("[data-sign-out]")?.addEventListener("click", signOut);
    panel.querySelector("[data-refresh-account]")?.addEventListener("click", loadAccountStatus);
  }

  function renderTabs() {
    const tabs = [
      ["home", "Home"],
      ["customize", "Customize"],
      ["settings", "Settings"]
    ];
    return `
      <nav class="fc-tabs" aria-label="Reachard sections">
        ${tabs.map(([id, label]) => `
          <button class="fc-tab ${state.activeTab === id ? "fc-tab-active" : ""}" type="button" data-tab="${id}">
            <span class="fc-tab-icon">${id === "home" ? "H" : id === "customize" ? "C" : "S"}</span>
            <span>${label}</span>
          </button>
        `).join("")}
      </nav>
    `;
  }

  function panelTitle(context) {
    if (context.type === PAGE_TYPES.LINKEDIN_PERSON) return context.personName || t("linkedInProfile");
    return context.jobTitle || context.companyName || context.companyDomain || t("thisCompany");
  }

  function panelSubtitle(context) {
    if (context.type === PAGE_TYPES.LINKEDIN_PERSON) {
      return [context.personTitle, context.companyName].filter(Boolean).join(" - ") || t("linkedInPeopleProfile");
    }
    return [context.jobTitle, context.jobLocation, context.source].filter(Boolean).join(" - ")
      || context.pageTitle
      || t("companyContext");
  }

  function renderSourceAction(context) {
    const url = safeHttpUrl(context.sourceUrl || context.jobUrl);
    if (!url) return "";
    return `<button class="fc-link-button" type="button" data-action-url="${escapeAttr(url)}">View job</button>`;
  }

  function renderBody() {
    if (state.activeTab === "customize") return renderCustomize();
    if (state.activeTab === "settings") return renderSettings();
    return renderHome();
  }

  function renderHome() {
    const context = state.pageContext || {};
    if (state.account?.onboarding?.profile && !state.account.onboarding.profile.complete) {
      return `
        <section class="fc-context-card">
          <h2 class="fc-title">Complete your profile</h2>
          <div class="fc-subtitle">Reachard needs your personal context before searching contacts or drafting outreach.</div>
          <button class="fc-primary-wide" type="button" data-action-url="https://reachard.co/onboarding">Finish setup</button>
        </section>
      `;
    }
    const title = panelTitle(context);
    const subtitle = panelSubtitle(context);
    const hasContext = Boolean(state.pageContext);
    const canSearch = hasContext && !state.loading;

    return `
      <section class="fc-context-card">
        <div class="fc-search-status">
          <span class="fc-ready-dot"></span>
          <span>${hasContext ? "Ready to search" : "Unsupported page"}</span>
        </div>
        <h2 class="fc-title">${escapeHtml(hasContext ? "Job page detected!" : t("unsupportedPage"))}</h2>
        <div class="fc-subtitle">${escapeHtml(hasContext ? subtitle || title : "Open a job, company, or LinkedIn profile page to search.")}</div>
        ${renderMissingJobTitleInput()}
        <button class="fc-primary-wide" type="button" data-start-search ${canSearch ? "" : "disabled"}>
          ${state.loading ? escapeHtml(loadingLabel()) : "Start search"}
        </button>
        ${renderSourceAction(context)}
      </section>
      ${renderCreditsCard()}
      ${renderSearchResults()}
      ${renderPreviousFinds()}
    `;
  }

  function renderSearchResults() {
    if (state.loading) {
      return `
        <div class="fc-status fc-loading">
          <span class="fc-spinner"></span>
          <span>${escapeHtml(loadingLabel())}</span>
        </div>
      `;
    }
    if (state.prompt) {
      return `
        <div class="fc-status fc-prompt">${escapeHtml(state.prompt)}</div>
        ${renderActionButton(state.action)}
      `;
    }
    if (state.error) {
      return `
        <div class="fc-status fc-error">${escapeHtml(state.error)}</div>
        ${renderActionButton(state.action)}
      `;
    }
    if (!state.contacts.length) {
      return "";
    }

    const sectionTitle = state.pageContext?.type === PAGE_TYPES.LINKEDIN_PERSON ? t("contact") : "Best match";
    return `
      <div class="fc-section-title">${escapeHtml(sectionTitle)}</div>
      ${state.contacts.map(renderContact).join("")}
    `;
  }

  function renderCreditsCard() {
    const plan = state.account?.subscription?.planName || "Plan";
    const remaining = state.creditsRemaining ?? state.account?.credits?.balance ?? 0;
    const capped = Math.max(0, Math.min(100, Number(remaining) * 10));
    return `
      <section class="fc-plan-card">
        <div class="fc-plan-row">
          <span class="fc-plan-label">Plan</span>
          <span class="fc-plan-pill">${escapeHtml(plan)}</span>
          <button class="fc-link-button fc-plan-manage" type="button" data-action-url="https://reachard.co/pricing">Manage</button>
        </div>
        <div class="fc-credit-count"><strong>${escapeHtml(String(remaining))}</strong> credits remaining</div>
        <div class="fc-credit-bar"><span style="width: ${capped}%"></span></div>
        <button class="fc-upgrade-link" type="button" data-action-url="https://reachard.co/pricing">Upgrade Plan</button>
      </section>
    `;
  }

  function renderPreviousFinds() {
    const items = state.previousFinds.slice(0, 4);
    return `
      <section class="fc-previous">
        <div class="fc-section-heading">
          <span>Previous finds</span>
          ${state.previousFinds.length > 4 ? `<button type="button" data-view-more-finds>View more</button>` : ""}
        </div>
        ${items.length ? items.map(renderPreviousFind).join("") : `<div class="fc-empty-card">No previous finds yet.</div>`}
      </section>
    `;
  }

  function renderPreviousFind(item) {
    const title = item.jobTitle || item.companyName || item.personName || "Previous search";
    const meta = [item.companyName, item.source].filter(Boolean).join(" at ") || item.sourceUrl || "";
    return `
      <article class="fc-previous-item">
        <span class="fc-previous-logo">${escapeHtml((title || "R").slice(0, 1).toUpperCase())}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(meta)}</span>
        </div>
        <time>${escapeHtml(relativeTime(item.createdAt))}</time>
      </article>
    `;
  }

  function renderCustomize() {
    const values = { ...DEFAULT_EMAIL_CUSTOMIZE, ...state.emailCustomize };
    return `
      <section class="fc-customize">
        <h2 class="fc-page-title">Customize</h2>
        <p class="fc-page-copy">Set the email style Reachard uses when drafting outreach. Personal information stays fixed in your account profile.</p>
        ${state.accountError ? `<div class="fc-status fc-error">${escapeHtml(state.accountError)}</div>` : ""}
        ${renderSegmentedField("Tone", "tone", values.tone, [
          ["warm", "Warm"],
          ["direct", "Direct"],
          ["formal", "Formal"],
          ["confident", "Confident"]
        ])}
        ${renderSegmentedField("Length", "length", values.length, [
          ["short", "Short"],
          ["concise", "Concise"],
          ["detailed", "Detailed"]
        ])}
        ${renderSegmentedField("Goal", "goal", values.goal, [
          ["advice", "Ask advice"],
          ["referral", "Explore referral"],
          ["intro", "Request intro"]
        ])}
        <label class="fc-field">
          Extra style notes
          <textarea data-customize-field="notes" rows="4" placeholder="Example: sound less formal, mention curiosity about product work.">${escapeHtml(values.notes)}</textarea>
        </label>
        <div class="fc-form-actions">
          <button class="fc-primary-action" type="button" data-save-customize>Save style</button>
          <button class="fc-secondary" type="button" data-reset-customize>Reset</button>
        </div>
      </section>
    `;
  }

  function renderSegmentedField(label, name, value, options) {
    return `
      <fieldset class="fc-field">
        <legend>${escapeHtml(label)}</legend>
        <div class="fc-segments">
          ${options.map(([optionValue, optionLabel]) => `
            <label class="fc-segment ${value === optionValue ? "fc-segment-active" : ""}">
              <input type="radio" name="${escapeAttr(name)}" data-customize-field="${escapeAttr(name)}" value="${escapeAttr(optionValue)}" ${value === optionValue ? "checked" : ""}>
              <span>${escapeHtml(optionLabel)}</span>
            </label>
          `).join("")}
        </div>
      </fieldset>
    `;
  }

  function renderSettings() {
    const account = state.account;
    const email = account?.user?.email || "Not signed in";
    const plan = account?.subscription?.planName || "Free";
    const status = account?.subscription?.status || "inactive";
    const credits = state.creditsRemaining ?? account?.credits?.balance ?? 0;
    return `
      <section class="fc-settings">
        <h2 class="fc-page-title">Settings</h2>
        ${state.accountLoading ? `<div class="fc-status"><span class="fc-spinner"></span><span>Loading account...</span></div>` : ""}
        ${state.accountError ? `<div class="fc-status fc-error">${escapeHtml(state.accountError)}</div>` : ""}
        <div class="fc-account-card">
          <span class="fc-account-avatar">${escapeHtml(email.slice(0, 1).toUpperCase())}</span>
          <div>
            <strong>${escapeHtml(email)}</strong>
            <span>${escapeHtml(plan)} · ${escapeHtml(status)} · ${escapeHtml(String(credits))} credits</span>
          </div>
        </div>
        <div class="fc-settings-actions">
          <button class="fc-secondary" type="button" data-refresh-account>Refresh account</button>
          <button class="fc-secondary" type="button" data-action-url="https://reachard.co/dashboard/profile">Account profile</button>
          <button class="fc-danger" type="button" data-sign-out>Sign out</button>
        </div>
      </section>
    `;
  }

  function loadingLabel() {
    if (state.pageContext?.type === PAGE_TYPES.LINKEDIN_PERSON) return t("preparingContact");
    return t("findingContacts");
  }

  function renderMissingJobTitleInput() {
    if (state.pageContext?.jobTitle) return "";
    return `
      <label class="fc-manual-role">
        ${escapeHtml(t("optionalRole"))}
        <input data-manual-job-title type="text" value="${escapeAttr(state.manualJobTitle)}" placeholder="${escapeAttr(t("rolePlaceholder"))}" />
      </label>
    `;
  }

  function renderCredits(placement = "header") {
    if (state.creditsRemaining === null || state.creditsRemaining === undefined) return "";
    const label = state.creditsRemaining === 1 ? t("contactKitLeft") : t("contactKitsLeft");
    const text = state.language === "zh" ? `${state.creditsRemaining} ${label}` : `${state.creditsRemaining} ${label}`;
    return `<div class="fc-credits fc-credits-${placement}">${escapeHtml(text)}</div>`;
  }

  function renderFooter() {
    if (state.creditsRemaining === null || state.creditsRemaining === undefined) return "";
    return `
      <div class="fc-footer">
        <div>
          <span>Credits left</span>
          <strong>${escapeHtml(String(state.creditsRemaining))}</strong>
        </div>
        <button class="fc-manage" type="button" data-action-url="https://reachard.co/pricing">Manage</button>
      </div>
    `;
  }

  function renderActionButton(action) {
    if (!action) return "";
    const label = escapeHtml(action.label || t("openWebsite"));
    if (action.url) {
      return `<button class="fc-secondary" type="button" data-action-url="${escapeAttr(action.url)}">${label}</button>`;
    }
    return "";
  }

  function renderContact(contact, index) {
    const id = contact.id || contact.linkedinUrl || String(index);
    const email = state.revealed.get(id) || contact.email;
    const isRevealing = state.revealing.has(id);
    const isDrafting = state.drafting.has(id);
    const draft = state.drafts.get(id);
    const education = contact.education ? `Past: ${contact.education}` : "";
    const locationText = contact.location ? contact.location : "";
    const reasons = Array.isArray(contact.reasons) && contact.reasons.length
      ? contact.reasons.join(" - ")
      : contact.provider === "linkedin-profile" ? t("selectedProfile") : t("rankedReason");
    const name = escapeHtml(contact.name || lockedContactName(contact, index));
    const linkedInUrl = safeHttpUrl(contact.linkedinUrl);
    const nameContent = linkedInUrl
      ? `<a class="fc-contact-link" href="${escapeAttr(linkedInUrl)}" target="_blank" rel="noopener noreferrer">${name}</a>`
      : name;
    const metaParts = [contact.title || t("companyContact"), locationText].filter(Boolean).join(" - ");

    return `
      <article class="fc-contact">
        <div class="fc-contact-copy">
          <p class="fc-contact-name">${nameContent}</p>
          <p class="fc-contact-meta">${escapeHtml(metaParts)}</p>
          <div class="fc-reasons">
            ${education ? `<p>${escapeHtml(education.replace(/^Past: /, ""))}</p>` : ""}
            <p>${escapeHtml(reasons)}</p>
          </div>
        </div>
        ${email ? `<div class="fc-email">${escapeHtml(email)}</div>` : ""}
        <div class="fc-actions">
          ${email && linkedInUrl ? `<button class="fc-secondary" type="button" data-action-url="${escapeAttr(linkedInUrl)}">LinkedIn</button>` : ""}
          ${email ? "" : `<button class="fc-primary-action" type="button" data-reveal="${escapeAttr(id)}" ${isRevealing ? "disabled" : ""}>${isRevealing ? t("unlocking") : "View contact"}</button>`}
          ${email ? `<button class="fc-primary-action" type="button" data-draft="${escapeAttr(id)}" ${isDrafting ? "disabled" : ""}>${isDrafting ? t("writing") : "Draft intro"}</button>` : ""}
        </div>
        ${draft ? renderDraftPreview(id, draft) : ""}
      </article>
    `;
  }

  function lockedContactName(contact) {
    const title = contact.title || t("relevantContact");
    return title;
  }

  function renderDraftPreview(id, draft) {
    const notes = Array.isArray(draft.personalizationNotes) ? draft.personalizationNotes : [];
    const missing = Array.isArray(draft.missingContext) ? draft.missingContext : [];
    const warnings = Array.isArray(draft.warnings) ? draft.warnings : [];
    return `
      <div class="fc-draft">
        <div class="fc-draft-label">${escapeHtml(t("outreachIncluded"))}</div>
        <div class="fc-draft-subject">${escapeHtml(draft.subject || "")}</div>
        <pre class="fc-draft-body">${escapeHtml(draft.body || "")}</pre>
        ${notes.length ? `<div class="fc-draft-notes"><strong>${escapeHtml(t("used"))}</strong> ${escapeHtml(notes.join(" - "))}</div>` : ""}
        ${missing.length ? `<div class="fc-draft-missing"><strong>${escapeHtml(t("missing"))}</strong> ${escapeHtml(missing.join(" - "))}</div>` : ""}
        ${warnings.length ? `<div class="fc-draft-missing"><strong>${escapeHtml(t("review"))}</strong> ${escapeHtml(warnings.join(" - "))}</div>` : ""}
        ${draft.ai?.provider === "template" ? `<div class="fc-draft-missing">${escapeHtml(t("aiUnavailable"))}</div>` : ""}
        <button class="fc-secondary" type="button" data-open-mailto="${escapeAttr(id)}">${escapeHtml(t("openEmailApp"))}</button>
      </div>
    `;
  }

  async function openPanel() {
    state.pageContext = getPageContext();
    state.manualJobTitle = "";
    const panel = ensurePanel();
    panel.classList.add("fc-open");
    state.error = "";
    state.prompt = null;
    state.action = null;
    state.activeTab = "home";
    await loadPanelData();
    renderPanel();
    loadAccountStatus();
  }

  async function runSearch() {
    state.pageContext = getPageContext();
    state.loading = true;
    state.error = "";
    state.prompt = null;
    state.action = null;
    state.contacts = [];
    state.drafts.clear();
    renderPanel();

    try {
      if (!state.pageContext) {
        throw apiError({ ok: false, status: 400, error: t("unsupportedPage") }, t("unsupportedPage"));
      }

      if (state.pageContext.type === PAGE_TYPES.LINKEDIN_PERSON) {
        state.contacts = [contactFromPersonContext(state.pageContext)];
        await rememberFind(state.pageContext);
        return;
      }

      if (!state.pageContext.companyName && !state.pageContext.companyDomain) {
        throw apiError({
          ok: false,
          status: 400,
          error: t("couldNotReadCompany")
        }, t("couldNotReadPage"));
      }

      const response = await sendRuntimeMessage({
        type: "CONTACTS_SEARCH",
        payload: { pageContext: state.pageContext }
      });
      if (!response?.ok) throw apiError(response, t("couldNotFindContacts"));
      setCredits(response);
      state.contacts = response.contacts || [];
      await rememberFind(state.pageContext);
    } catch (error) {
      applyError(error, t("couldNotFindContacts"));
    } finally {
      state.loading = false;
      renderPanel();
    }
  }

  async function loadPanelData() {
    try {
      const stored = await chrome.storage.local.get([PREVIOUS_FINDS_KEY]);
      state.previousFinds = Array.isArray(stored[PREVIOUS_FINDS_KEY]) ? stored[PREVIOUS_FINDS_KEY] : [];
    } catch (_error) {
      state.previousFinds = [];
    }
    await loadEmailCustomize();
  }

  async function loadEmailCustomize() {
    try {
      const response = await sendRuntimeMessage({ type: "GET_EMAIL_CUSTOMIZE" });
      if (!response?.ok) {
        state.emailCustomize = { ...DEFAULT_EMAIL_CUSTOMIZE };
        state.accountError = response?.error || t("signInWebsite");
        state.action = response?.action || null;
        return;
      }
      state.emailCustomize = normalizeCustomize(response.custom);
      state.accountError = "";
    } catch (error) {
      state.emailCustomize = { ...DEFAULT_EMAIL_CUSTOMIZE };
      state.accountError = error.message || "Could not load custom settings.";
    }
  }

  async function loadAccountStatus() {
    state.accountLoading = true;
    state.accountError = "";
    renderPanel();
    try {
      const response = await sendRuntimeMessage({ type: "GET_ACCOUNT_STATUS" });
      if (!response?.ok) {
        state.account = null;
        state.accountError = response?.error || t("signInWebsite");
        state.action = response?.action || null;
        return;
      }
      state.account = response.account;
      setCredits(response.account);
    } catch (error) {
      state.accountError = error.message || "Could not load account.";
    } finally {
      state.accountLoading = false;
      renderPanel();
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
    const contact = findContact(contactId);
    if (!contact) return;
    if (state.revealed.has(contactId) || contact.email || state.revealing.has(contactId)) return;

    state.revealing.add(contactId);
    state.error = "";
    state.prompt = null;
    state.action = null;
    renderPanel();

    try {
      const response = await sendRuntimeMessage({
        type: "CONTACTS_REVEAL",
        payload: { contact, pageContext: state.pageContext }
      });
      if (!response?.ok) throw apiError(response, t("couldNotUnlock"));
      setCredits(response);
      state.revealed.set(contactId, response.email);
      await draftEmail(contactId);
    } catch (error) {
      applyError(error, t("couldNotUnlock"));
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
      state.error = t("unlockBeforeWriting");
      state.prompt = null;
      state.action = null;
      renderPanel();
      return;
    }

    state.drafting.add(contactId);
    state.error = "";
    state.prompt = null;
    state.action = null;
    renderPanel();

    try {
      const response = await sendRuntimeMessage({
        type: "EMAIL_DRAFT",
        payload: {
          contact: { ...contact, email },
          pageContext: effectivePageContext()
        }
      });
      if (!response?.ok) throw apiError(response, t("couldNotDraft"));
      setCredits(response);
      state.drafts.set(contactId, response);
    } catch (error) {
      applyError(error, t("couldNotDraft"));
    } finally {
      state.drafting.delete(contactId);
      renderPanel();
    }
  }

  function effectivePageContext() {
    return {
      ...(state.pageContext || {}),
      jobTitle: state.pageContext?.jobTitle || state.manualJobTitle.trim()
    };
  }

  function apiError(response, fallback) {
    const error = new Error(response?.error || fallback);
    error.action = response?.action || null;
    error.status = response?.status || null;
    error.credits = response?.credits || null;
    return error;
  }

  function applyError(error, fallback) {
    setCredits(error);
    if (error.status === 401) {
      state.prompt = error.message || t("signInWebsite");
      state.error = "";
    } else {
      state.error = error.message || fallback;
      state.prompt = null;
    }
    state.action = error.action || null;
  }

  function setCredits(source) {
    const remaining = source?.credits?.remaining
      ?? source?.credits?.balance
      ?? source?.onboarding?.billing?.creditsRemaining;
    if (Number.isFinite(Number(remaining))) {
      state.creditsRemaining = Number(remaining);
    }
  }

  async function rememberFind(context) {
    const item = {
      companyName: context.companyName || "",
      jobTitle: context.jobTitle || "",
      personName: context.personName || "",
      source: context.source || "",
      sourceUrl: context.sourceUrl || "",
      createdAt: new Date().toISOString()
    };
    const key = item.sourceUrl || `${item.companyName}|${item.jobTitle}|${item.personName}`;
    const next = [
      item,
      ...state.previousFinds.filter((find) => {
        const findKey = find.sourceUrl || `${find.companyName}|${find.jobTitle}|${find.personName}`;
        return findKey !== key;
      })
    ].slice(0, 10);
    state.previousFinds = next;
    try {
      await chrome.storage.local.set({ [PREVIOUS_FINDS_KEY]: next });
    } catch (_error) {
      // Previous finds are a convenience only.
    }
  }

  async function saveCustomizeFromPanel() {
    const panel = ensurePanel();
    const next = { ...DEFAULT_EMAIL_CUSTOMIZE };
    panel.querySelectorAll("[data-customize-field]").forEach((field) => {
      const key = field.dataset.customizeField;
      if (field.type === "radio" && !field.checked) return;
      next[key] = field.value.trim();
    });
    state.emailCustomize = normalizeCustomize(next);
    const response = await sendRuntimeMessage({ type: "SET_EMAIL_CUSTOMIZE", payload: state.emailCustomize });
    if (!response?.ok) {
      state.accountError = response?.error || "Could not save custom settings.";
      state.action = response?.action || null;
      renderPanel();
      return;
    }
    state.emailCustomize = normalizeCustomize(response.custom);
    state.accountError = "Custom settings saved.";
    renderPanel();
  }

  async function resetCustomize() {
    state.emailCustomize = { ...DEFAULT_EMAIL_CUSTOMIZE };
    const response = await sendRuntimeMessage({ type: "SET_EMAIL_CUSTOMIZE", payload: state.emailCustomize });
    if (!response?.ok) {
      state.accountError = response?.error || "Could not reset custom settings.";
      state.action = response?.action || null;
      renderPanel();
      return;
    }
    state.emailCustomize = normalizeCustomize(response.custom);
    state.accountError = "Custom settings reset.";
    renderPanel();
  }

  async function signOut() {
    const response = await sendRuntimeMessage({ type: "CLEAR_EXTENSION_SESSION", payload: { fromContentScript: true } });
    if (!response?.ok) {
      state.accountError = response?.error || "Could not sign out.";
      renderPanel();
      return;
    }
    state.account = null;
    state.creditsRemaining = null;
    state.accountError = "Signed out.";
    renderPanel();
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

  function relativeTime(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "";
    const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function findContact(contactId) {
    return state.contacts.find((contact, index) => {
      const id = contact.id || contact.linkedinUrl || String(index);
      return id === contactId;
    });
  }

  async function sendRuntimeMessage(message) {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      throw new Error(t("extensionRefreshed"));
    }

    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (String(error?.message || "").includes("Extension context invalidated")) {
        throw new Error(t("extensionRefreshed"));
      }
      throw error;
    }
  }

  function textFrom(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return "";
  }

  function getJobDescription() {
    return textFrom([
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".jobs-description-content__text",
      ".description__text",
      ".show-more-less-html__markup"
    ]);
  }

  function companyNameFromAriaLabel() {
    const companyElement = document.querySelector('[aria-label^="Company,"]');
    const label = companyElement?.getAttribute("aria-label") || "";
    return label.replace(/^Company,\s*/i, "").replace(/\.$/, "").trim();
  }

  function looksLikeJobPage() {
    const path = `${location.pathname} ${location.search}`.toLowerCase();
    const title = document.title.toLowerCase();
    return /\b(job|jobs|career|careers|position|positions|opening|openings|posting|requisition)\b/.test(path)
      || /\b(job|career|position|opening)\b/.test(title)
      || Boolean(document.querySelector('[class*="job"], [id*="job"], [data-testid*="job"]'));
  }

  function metaContent(name) {
    return document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || "";
  }

  function isExcludedGenericHost(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    return [
      "reachard.studio",
      "reachard.co",
      "contacts.reachard.studio",
      "contacts.reachard.co",
      "localhost",
      "127.0.0.1",
      "google.com",
      "bing.com",
      "duckduckgo.com",
      "yahoo.com",
      "gmail.com",
      "mail.google.com",
      "outlook.live.com",
      "github.com",
      "youtube.com",
      "facebook.com",
      "instagram.com",
      "x.com",
      "twitter.com",
      "reddit.com"
    ].some((excluded) => host === excluded || host.endsWith(`.${excluded}`));
  }

  function isReachardWebsite() {
    const host = location.hostname.replace(/^www\./i, "").toLowerCase();
    return host === "reachard.co"
      || host === "contacts.reachard.co"
      || host === "reachard.studio"
      || host === "contacts.reachard.studio"
      || ((host === "localhost" || host === "127.0.0.1") && location.port === "3000");
  }

  function hostCompanyName(hostname) {
    const clean = hostname.replace(/^www\./i, "").split(".")[0] || "";
    return clean
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanMultiline(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  function cleanDomain(value) {
    return String(value || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim()
      .toLowerCase();
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

  function buttonLabel(context) {
    return context.type === PAGE_TYPES.LINKEDIN_PERSON ? t("emailWithReachard") : t("findWithReachard");
  }

  function normalizeLanguage(value) {
    return value === "zh" ? "zh" : DEFAULT_LANGUAGE;
  }

  function t(key) {
    return I18N[normalizeLanguage(state.language)]?.[key] || I18N.en[key] || key;
  }

  async function loadExtensionLanguage() {
    try {
      const response = await sendRuntimeMessage({ type: "GET_EXTENSION_LANGUAGE" });
      const language = normalizeLanguage(response?.language);
      if (language === state.language) return;
      state.language = language;
      ensureButton();
      if (document.getElementById(PANEL_ID)?.classList.contains("fc-open")) {
        renderPanel();
      }
    } catch (_error) {
      state.language = DEFAULT_LANGUAGE;
    }
  }

  function boot() {
    if (isReachardWebsite()) return;

    window[CLEANUP_KEY]?.();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();

    let refreshTimer = 0;
    const scheduleEnsureButton = () => {
      if (refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = 0;
        ensureButton();
      }, BUTTON_REFRESH_DELAY_MS);
    };

    ensureButton();
    loadExtensionLanguage();
    const observer = new MutationObserver((mutations) => {
      const hasPageMutation = mutations.some((mutation) => {
        const target = mutation.target;
        if (target?.closest?.(`#${ROOT_ID}, #${PANEL_ID}`)) return false;
        return Array.from(mutation.addedNodes || []).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return true;
          return !node.closest?.(`#${ROOT_ID}, #${PANEL_ID}`);
        }) || Array.from(mutation.removedNodes || []).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return true;
          return node.id !== ROOT_ID && node.id !== PANEL_ID;
        });
      });
      if (hasPageMutation) scheduleEnsureButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", scheduleEnsureButton, true);
    window.addEventListener("resize", scheduleEnsureButton);

    let lastUrl = location.href;
    const intervalId = window.setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        document.getElementById(ROOT_ID)?.remove();
      }
      scheduleEnsureButton();
    }, 1000);

    window[CLEANUP_KEY] = () => {
      observer.disconnect();
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (window[AUTH_LISTENER_KEY]) {
        chrome.runtime.onMessage.removeListener(window[AUTH_LISTENER_KEY]);
        window[AUTH_LISTENER_KEY] = null;
      }
      window.removeEventListener("scroll", scheduleEnsureButton, true);
      window.removeEventListener("resize", scheduleEnsureButton);
      window.clearInterval(intervalId);
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
    };
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
