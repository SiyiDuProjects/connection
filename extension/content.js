(function () {
  const ROOT_ID = "fc-linkedin-root";
  const PANEL_ID = "fc-linkedin-panel";
  const BUTTON_ID = "fc-linkedin-button";
  const CLEANUP_KEY = "__fcLinkedInCleanup";
  const AUTH_LISTENER_KEY = "__fcLinkedInAuthListener";
  const DEFAULT_LANGUAGE = "en";
  const BUTTON_REFRESH_DELAY_MS = 250;
  const SIDEBAR_POSITION_KEY = "fcSidebarCenterY";
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
      findJobContacts: "查找该岗位的联系人",
      findCompanyContacts: "查找公司联系人",
      prepareContact: "准备这个联系人",
      revealEmail: "查找工作邮箱",
      checkingEmail: "正在查找邮箱...",
      viewJob: "查看职位",
      viewCompany: "查看公司",
      viewProfile: "查看主页",
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
      logInToReachard: "登录 Reachard",
      viewContacts: "查看联系人",
      closeSearch: "关闭",
      searchingContacts: "正在查找联系人...",
      searchingCompany: "正在查找 {company} 的相关联系人",
      contactsAtCompany: "{company} 的联系人",
      extensionRefreshed: "扩展上下文已刷新。请重新加载此标签页后再试。",
      customize: "邮件偏好",
      finishSetup: "完成设置",
      openSupportedPage: "请打开职位、公司或 LinkedIn 个人主页后再查找。",
      tone: "语气",
      warm: "友好",
      direct: "直接",
      formal: "正式",
      confident: "自信",
      length: "长度",
      short: "简短",
      concise: "精炼",
      detailed: "详细",
      goal: "目的",
      askAdvice: "请教建议",
      exploreReferral: "询问内推",
      requestIntro: "请求介绍",
      extraStyleNotes: "其他风格要求",
      styleNotesPlaceholder: "例如：语气不要太正式，并提到我对产品工作的兴趣。",
      saveStyle: "保存风格",
      reset: "重置",
      draftIntro: "生成邮件",
      couldNotLoadCustom: "无法加载邮件偏好。",
      couldNotLoadAccount: "无法加载账户。",
      couldNotSaveCustom: "无法保存邮件偏好。",
      customSaved: "邮件偏好已保存。",
      couldNotResetCustom: "无法重置邮件偏好。",
      customReset: "邮件偏好已重置。"
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
    error: "",
    prompt: null,
    action: null,
    creditsRemaining: null,
    account: null,
    authenticated: null,
    accountLoading: false,
    accountError: "",
    accountNotice: "",
    emailCustomize: { ...DEFAULT_EMAIL_CUSTOMIZE },
    contacts: [],
    searchSheetOpen: false,
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
      companyLinkedInUrl: cleanText(context.companyLinkedInUrl),
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
    const companyLinkedInUrl = document.querySelector([
      ".job-details-jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name a",
      ".topcard__org-name-link",
      '.top-card-layout__second-subline a[href*="/company/"]',
      'a[href*="/company/"][href*="/life/"]'
    ].join(", "))?.href || "";

    const locationText = textFrom([
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__primary-description-container",
      ".topcard__flavor-row .topcard__flavor--bullet",
      ".top-card-layout__second-subline"
    ]);

    return {
      type: PAGE_TYPES.LINKEDIN_JOB,
      companyName,
      companyLinkedInUrl,
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
      companyLinkedInUrl: location.href,
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
        if (looksLikeAuthenticationPage()) return null;

        const jobPosting = structuredJobPosting();
        const companyName = platformCompanyName()
          || cleanText(jobPosting?.hiringOrganization?.name)
          || metaContent("og:site_name")
          || metaContent("application-name")
          || hostCompanyName(location.hostname);
        const jobPage = Boolean(jobPosting) || looksLikeJobPage();
        if (!jobPage && !isKnownJobPlatform(location.hostname) && !looksLikeCompanyPage()) return null;
        const jobTitle = jobPage
          ? cleanText(jobPosting?.title) || textFrom(["h1", '[class*="job-title"]', '[class*="posting-title"]'])
          : "";
        const jobDescription = jobPage
          ? htmlText(jobPosting?.description) || textFrom(['[class*="job-description"]', '[class*="posting"]', '[class*="description"]', "main"])
          : "";

        return {
          type: jobTitle || jobDescription ? PAGE_TYPES.EXTERNAL_JOB : PAGE_TYPES.COMPANY_SITE,
          companyName,
          companyDomain: isKnownJobPlatform(location.hostname) ? "" : location.hostname,
          jobTitle,
          jobLocation: structuredJobLocation(jobPosting?.jobLocation),
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

    panel.innerHTML = `
      <div class="fc-brand">
        <span class="fc-logo">G</span>
        <span>Reachard</span>
      </div>
      <button class="fc-close" type="button" aria-label="${escapeAttr(t("close"))}"></button>
      <div class="fc-body">${renderHome()}</div>
      ${renderSearchSheet()}
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

    panel.querySelector("[data-start-search]")?.addEventListener("click", runSearch);
    panel.querySelector("[data-view-contacts]")?.addEventListener("click", () => {
      state.searchSheetOpen = true;
      renderPanel();
    });
    panel.querySelector("[data-close-search-sheet]")?.addEventListener("click", () => {
      state.searchSheetOpen = false;
      renderPanel();
    });
    panel.querySelector("[data-save-customize]")?.addEventListener("click", saveCustomizeFromPanel);
    panel.querySelector("[data-reset-customize]")?.addEventListener("click", resetCustomize);
    panel.querySelectorAll('input[type="radio"][data-customize-field]').forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.customizeField;
        state.emailCustomize = {
          ...state.emailCustomize,
          [key]: input.value
        };
        input.closest(".fc-segments")?.querySelectorAll(".fc-segment").forEach((option) => {
          const optionInput = option.querySelector('input[type="radio"]');
          option.classList.toggle("fc-segment-active", Boolean(optionInput?.checked));
        });
      });
    });
  }

  function panelTitle(context) {
    if (context.type === PAGE_TYPES.LINKEDIN_PERSON) return context.personName || t("linkedInProfile");
    return context.jobTitle || context.companyName || context.companyDomain || t("thisCompany");
  }

  function isCompanyContext(context) {
    return [PAGE_TYPES.LINKEDIN_COMPANY, PAGE_TYPES.COMPANY_SITE].includes(context?.type);
  }

  function searchButtonLabel(context) {
    if (context.type === PAGE_TYPES.LINKEDIN_PERSON) return t("prepareContact");
    if (isCompanyContext(context)) return t("findCompanyContacts");
    return t("findJobContacts");
  }

  function renderSourceAction(context) {
    const url = safeHttpUrl(context.sourceUrl || context.jobUrl);
    if (!url) return "";
    const label = context.type === PAGE_TYPES.LINKEDIN_PERSON
      ? t("viewProfile")
      : isCompanyContext(context)
        ? t("viewCompany")
        : t("viewJob");
    return `<button class="fc-link-button" type="button" data-action-url="${escapeAttr(url)}">${escapeHtml(label)}</button>`;
  }

  function renderHome() {
    const context = state.pageContext || {};
    const hasContext = Boolean(state.pageContext);
    const needsLogin = state.authenticated === false;
    const needsProfile = state.authenticated === true
      && state.account?.onboarding?.profile
      && !state.account.onboarding.profile.complete;
    const canSearch = hasContext && !state.loading;

    return `
      ${hasContext ? renderContextCard(context) : `<div class="fc-empty-card">${escapeHtml(t("openSupportedPage"))}</div>`}
      ${hasContext ? renderMissingJobTitleInput() : ""}
      ${needsLogin
        ? `<button class="fc-primary-wide fc-search-button" type="button" data-action-url="${escapeAttr(state.action?.url || "https://reachard.co/dashboard")}">${escapeHtml(t("logInToReachard"))}</button>`
        : needsProfile
          ? `<button class="fc-primary-wide fc-search-button" type="button" data-action-url="https://reachard.co/onboarding">${escapeHtml(t("finishSetup"))}</button>`
          : state.loading
            ? `<button class="fc-primary-wide fc-search-button" type="button" data-view-contacts>
                <span class="fc-spinner fc-spinner-on-primary"></span>
                <span>${escapeHtml(t("searchingContacts"))}</span>
              </button>`
            : state.contacts.length
              ? `<button class="fc-primary-wide fc-search-button" type="button" data-view-contacts>${escapeHtml(t("viewContacts"))}</button>`
              : `<button class="fc-primary-wide fc-search-button" type="button" data-start-search ${canSearch ? "" : "disabled"}>
                  <span>${escapeHtml(searchButtonLabel(context))}</span>
                </button>`}
      ${renderCustomize()}
    `;
  }

  function renderContextCard(context) {
    const title = panelTitle(context);
    const company = context.companyName || context.companyDomain || "";
    const meta = context.type === PAGE_TYPES.LINKEDIN_PERSON
      ? [context.personTitle, company].filter(Boolean).join(" · ")
      : isCompanyContext(context)
        ? [context.source, context.companyDomain].filter(Boolean).join(" · ")
        : [company, context.jobLocation].filter(Boolean).join(" · ");
    const initialSource = company || context.personName || title || "R";

    return `
      <section class="fc-job-card">
        <div class="fc-job-card-main">
          <span class="fc-company-mark" aria-hidden="true">${escapeHtml(initialSource.slice(0, 1).toUpperCase())}</span>
          <div class="fc-job-copy">
            <h2 class="fc-job-title">${escapeHtml(title)}</h2>
            ${meta ? `<p class="fc-job-meta">${escapeHtml(meta)}</p>` : ""}
          </div>
        </div>
        ${renderSourceAction(context)}
      </section>
    `;
  }

  function renderSearchSheet() {
    if (!state.searchSheetOpen) return "";

    const context = state.pageContext || {};
    const company = context.companyName || context.companyDomain || t("thisCompany");
    const title = state.loading
      ? t("searchingContacts")
      : t("contactsAtCompany", { company });

    return `
      <div class="fc-search-sheet-backdrop" aria-hidden="true"></div>
      <section class="fc-search-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
        <div class="fc-search-sheet-header">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(state.loading ? t("searchingCompany", { company }) : panelTitle(context))}</p>
          </div>
          <button class="fc-search-sheet-close" type="button" data-close-search-sheet aria-label="${escapeAttr(t("closeSearch"))}">×</button>
        </div>
        <div class="fc-search-sheet-body">${renderSearchResults()}</div>
      </section>
    `;
  }

  function renderSearchResults() {
    if (state.loading) {
      return `
        <div class="fc-search-progress">
          <span class="fc-spinner"></span>
          <span>${escapeHtml(t("searchingCompany", {
            company: state.pageContext?.companyName || state.pageContext?.companyDomain || t("thisCompany")
          }))}</span>
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
      return `<div class="fc-empty-card">${escapeHtml(t("noContacts"))}</div>`;
    }

    return `<div class="fc-contact-results">${state.contacts.map(renderContact).join("")}</div>`;
  }

  function renderCustomize() {
    const values = { ...DEFAULT_EMAIL_CUSTOMIZE, ...state.emailCustomize };
    return `
      <section class="fc-customize fc-customize-inline">
        <h2 class="fc-page-title">${escapeHtml(t("customize"))}</h2>
        ${state.accountError ? `<div class="fc-status fc-error">${escapeHtml(state.accountError)}</div>` : ""}
        ${state.accountError ? renderActionButton(state.action) : ""}
        ${state.accountNotice ? `<div class="fc-status fc-success">${escapeHtml(state.accountNotice)}</div>` : ""}
        ${renderSegmentedField(t("tone"), "tone", values.tone, [
          ["warm", t("warm")],
          ["direct", t("direct")],
          ["formal", t("formal")],
          ["confident", t("confident")]
        ])}
        ${renderSegmentedField(t("length"), "length", values.length, [
          ["short", t("short")],
          ["concise", t("concise")],
          ["detailed", t("detailed")]
        ])}
        ${renderSegmentedField(t("goal"), "goal", values.goal, [
          ["advice", t("askAdvice")],
          ["referral", t("exploreReferral")],
          ["intro", t("requestIntro")]
        ])}
        <label class="fc-field">
          ${escapeHtml(t("extraStyleNotes"))}
          <textarea data-customize-field="notes" rows="3" placeholder="${escapeAttr(t("styleNotesPlaceholder"))}">${escapeHtml(values.notes)}</textarea>
        </label>
        <div class="fc-form-actions">
          <button class="fc-primary-action" type="button" data-save-customize>${escapeHtml(t("saveStyle"))}</button>
          <button class="fc-secondary" type="button" data-reset-customize>${escapeHtml(t("reset"))}</button>
        </div>
      </section>
    `;
  }

  function renderSegmentedField(label, name, value, options) {
    return `
      <fieldset class="fc-field">
        <legend>${escapeHtml(label)}</legend>
        <div class="fc-segments fc-segments-${options.length}">
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

  function renderMissingJobTitleInput() {
    if (state.pageContext?.jobTitle) return "";
    return `
      <label class="fc-manual-role">
        ${escapeHtml(t("optionalRole"))}
        <input data-manual-job-title type="text" value="${escapeAttr(state.manualJobTitle)}" placeholder="${escapeAttr(t("rolePlaceholder"))}" />
      </label>
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
          ${email ? "" : `<button class="fc-primary-action" type="button" data-reveal="${escapeAttr(id)}" ${isRevealing ? "disabled" : ""}>${isRevealing ? t("checkingEmail") : t("revealEmail")}</button>`}
          ${email ? `<button class="fc-primary-action" type="button" data-draft="${escapeAttr(id)}" ${isDrafting ? "disabled" : ""}>${escapeHtml(isDrafting ? t("writing") : t("draftIntro"))}</button>` : ""}
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
    const nextContext = getPageContext();
    if (contextIdentity(nextContext) !== contextIdentity(state.pageContext)) {
      state.contacts = [];
      state.revealed.clear();
      state.drafts.clear();
    }
    state.pageContext = nextContext;
    state.manualJobTitle = "";
    const panel = ensurePanel();
    panel.classList.add("fc-open");
    state.error = "";
    state.prompt = null;
    state.action = null;
    state.searchSheetOpen = false;
    await loadPanelData();
    renderPanel();
    loadAccountStatus();
  }

  async function runSearch() {
    state.pageContext = getPageContext();
    state.loading = true;
    state.searchSheetOpen = true;
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
        payload: { pageContext: effectivePageContext() }
      });
      if (!response?.ok) throw apiError(response, t("couldNotFindContacts"));
      setCredits(response);
      state.contacts = response.contacts || [];
    } catch (error) {
      applyError(error, t("couldNotFindContacts"));
    } finally {
      state.loading = false;
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
    state.accountNotice = "";
    try {
      const response = await sendRuntimeMessage({ type: "GET_EMAIL_CUSTOMIZE" });
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
    state.accountLoading = true;
    state.accountError = "";
    state.accountNotice = "";
    renderPanel();
    try {
      const response = await sendRuntimeMessage({ type: "GET_ACCOUNT_STATUS" });
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
      state.accountError = error.message || t("couldNotLoadAccount");
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
      state.authenticated = false;
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

  async function saveCustomizeFromPanel() {
    const panel = ensurePanel();
    const next = { ...DEFAULT_EMAIL_CUSTOMIZE };
    panel.querySelectorAll("[data-customize-field]").forEach((field) => {
      const key = field.dataset.customizeField;
      if (field.type === "radio" && !field.checked) return;
      next[key] = field.value.trim();
    });
    state.emailCustomize = normalizeCustomize(next);
    state.accountError = "";
    state.accountNotice = "";
    const response = await sendRuntimeMessage({ type: "SET_EMAIL_CUSTOMIZE", payload: state.emailCustomize });
    if (!response?.ok) {
      state.accountError = response?.error || t("couldNotSaveCustom");
      state.action = response?.action || null;
      renderPanel();
      return;
    }
    state.emailCustomize = normalizeCustomize(response.custom);
    state.accountNotice = t("customSaved");
    renderPanel();
  }

  async function resetCustomize() {
    state.emailCustomize = { ...DEFAULT_EMAIL_CUSTOMIZE };
    state.accountError = "";
    state.accountNotice = "";
    const response = await sendRuntimeMessage({ type: "SET_EMAIL_CUSTOMIZE", payload: state.emailCustomize });
    if (!response?.ok) {
      state.accountError = response?.error || t("couldNotResetCustom");
      state.action = response?.action || null;
      renderPanel();
      return;
    }
    state.emailCustomize = normalizeCustomize(response.custom);
    state.accountNotice = t("customReset");
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
    const explicitJobPath = /(?:^|[/?&=_-])(viewjob|job|position|opening|posting|requisition)(?:$|[/?&=_-])/.test(path)
      || /\/(jobs|positions|openings)\/[^/?#]+/.test(path);
    const explicitJobTitle = /\b(job application for|apply for this job|job requisition)\b/.test(title);
    return explicitJobPath
      || explicitJobTitle
      || Boolean(
        document.querySelector('[class*="job-title"], [data-testid*="job-title"], [class*="posting-title"]')
        && document.querySelector('[class*="job-description"], [data-testid*="job-description"], [class*="posting-description"]')
      );
  }

  function looksLikeAuthenticationPage() {
    const path = location.pathname.toLowerCase();
    return /\/(access|auth|login|logout|sign-in|signin|sign-up|signup)(?:\/|$)/.test(path);
  }

  function looksLikeCompanyPage() {
    const path = location.pathname.toLowerCase();
    if (path === "/" || /^\/[a-z]{2}(?:-[a-z]{2})?\/?$/.test(path)) return true;
    return /\/(about|company|careers|jobs|team|contact)(?:\/|$)/.test(path)
      || Boolean(document.querySelector('a[href*="linkedin.com/company/"]'));
  }

  function platformCompanyName() {
    const host = location.hostname.replace(/^www\./i, "").toLowerCase();
    const title = cleanText(document.title);

    if (host === "job-boards.greenhouse.io" || host.endsWith(".greenhouse.io")) {
      const fromTitle = title.match(/\bat\s+(.+)$/i)?.[1];
      const fromLogo = document.querySelector('img[alt$=" Logo"]')?.getAttribute("alt")?.replace(/\s+Logo$/i, "");
      return cleanText(fromTitle || fromLogo);
    }

    if (host === "jobs.lever.co" || host.endsWith(".lever.co")) {
      return cleanText(title.split(" - ")[0]);
    }

    if (host === "jobs.ashbyhq.com" || host.endsWith(".ashbyhq.com")) {
      return cleanText(title.match(/@\s+(.+)$/)?.[1] || title.split(" | ")[0]).replace(/\s+Jobs$/i, "");
    }

    if (host.endsWith(".myworkdayjobs.com")) {
      // Workday often exposes a payroll/legal entity (for example
      // "2100 NVIDIA USA") instead of the public company brand. The tenant
      // subdomain is stable and is a better search key for this platform.
      return hostCompanyName(host);
    }

    return "";
  }

  function structuredJobPosting() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const value = JSON.parse(script.textContent || "null");
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) {
          const candidates = item?.["@graph"] ? item["@graph"] : [item];
          const posting = candidates.find((candidate) => {
            const type = candidate?.["@type"];
            return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
          });
          if (posting) return posting;
        }
      } catch (_error) {
        // Ignore malformed structured data and continue with DOM selectors.
      }
    }
    return null;
  }

  function structuredJobLocation(value) {
    const locations = Array.isArray(value) ? value : value ? [value] : [];
    return locations.map((item) => {
      const address = item?.address || item;
      return [address?.addressLocality, address?.addressRegion, address?.addressCountry?.name || address?.addressCountry]
        .filter(Boolean)
        .join(", ");
    }).filter(Boolean).join(" | ");
  }

  function htmlText(value) {
    const html = String(value || "").trim();
    if (!html) return "";
    const template = document.createElement("template");
    template.innerHTML = html;
    return cleanMultiline(template.content.textContent || "");
  }

  function isKnownJobPlatform(hostname) {
    const host = String(hostname || "").replace(/^www\./i, "").toLowerCase();
    return [
      "greenhouse.io",
      "lever.co",
      "myworkdayjobs.com",
      "ashbyhq.com",
      "smartrecruiters.com",
      "icims.com",
      "jobvite.com",
      "workable.com"
    ].some((platform) => host === platform || host.endsWith(`.${platform}`));
  }

  function shouldWatchDynamicPage() {
    const host = location.hostname.replace(/^www\./i, "").toLowerCase();
    return host === "linkedin.com"
      || host.endsWith(".linkedin.com")
      || host === "indeed.com"
      || host.endsWith(".indeed.com")
      || host === "joinhandshake.com"
      || host.endsWith(".joinhandshake.com")
      || isKnownJobPlatform(host)
      || looksLikeJobPage();
  }

  function metaContent(name) {
    return document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || "";
  }

  function isExcludedGenericHost(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    return [
      "reachard.co",
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

  function normalizeLanguage(_value) {
    return "en";
  }

  function browserLanguage() {
    return "en";
  }

  function t(key, values = {}) {
    const template = I18N[normalizeLanguage(state.language)]?.[key] || I18N.en[key] || key;
    return Object.entries(values).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template
    );
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
      state.language = browserLanguage();
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
    let observer = null;
    const startObserverIfNeeded = () => {
      if (observer || !shouldWatchDynamicPage()) return;
      observer = new MutationObserver((mutations) => {
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
    };
    startObserverIfNeeded();

    let lastUrl = location.href;
    const intervalId = window.setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        document.getElementById(ROOT_ID)?.remove();
        startObserverIfNeeded();
        scheduleEnsureButton();
      }
    }, 1500);

    window[CLEANUP_KEY] = () => {
      observer?.disconnect();
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (window[AUTH_LISTENER_KEY]) {
        chrome.runtime.onMessage.removeListener(window[AUTH_LISTENER_KEY]);
        window[AUTH_LISTENER_KEY] = null;
      }
      window.clearInterval(intervalId);
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
    };
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
