(function () {
  const ROOT_ID = "fc-linkedin-root";
  const PANEL_ID = "fc-linkedin-panel";
  const BUTTON_ID = "fc-linkedin-button";
  const CLEANUP_KEY = "__fcLinkedInCleanup";
  const AUTH_LISTENER_KEY = "__fcLinkedInAuthListener";
  const BUTTON_REFRESH_DELAY_MS = 250;
  const SIDEBAR_POSITION_KEY = "fcSidebarCenterY";
  const SIDEBAR_DRAG_MARGIN_PX = 18;
  const SIDEBAR_DRAG_THRESHOLD_PX = 5;
  let lastPublishedContext = "";
  const PAGE_TYPES = {
    LINKEDIN_JOB: "linkedin_job",
    LINKEDIN_COMPANY: "linkedin_company",
    LINKEDIN_PERSON: "linkedin_person",
    EXTERNAL_JOB: "external_job",
    COMPANY_SITE: "company_site"
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

  const adapters = [
    linkedInAdapter(),
    handshakeAdapter(),
    indeedAdapter(),
    genericCompanyAdapter()
  ];

  function getPageContext() {
    if (isReachardWebsite()) return null;
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
      ...([PAGE_TYPES.LINKEDIN_JOB, PAGE_TYPES.EXTERNAL_JOB].includes(context.type) ? readJobMetadata() : {}),
      personName: cleanText(context.personName),
      personTitle: cleanText(context.personTitle),
      personLinkedInUrl: cleanText(context.personLinkedInUrl),
      sourceUrl,
      pageTitle: cleanText(context.pageTitle)
    };
  }

  // Only describe metadata published by the job page. Reading the page does
  // not establish that the role was independently verified as still open.
  function readJobMetadata() {
    const posting = structuredJobPosting();
    const explicitSalary = textFrom([
      '[data-testid="salary"]', '[data-testid="job-salary"]',
      '[data-automation-id="compensation"]', '.salary', '.salary-range'
    ]);
    const salary = formatJobSalary(posting?.baseSalary);
    const published = String(posting?.datePosted || '').trim();
    const publishedDay = published.slice(0, 10);
    const postedTime = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(published) && Number.isFinite(Date.parse(published)) ? Date.parse(`${publishedDay}T00:00:00Z`) : NaN;
    return {
      jobSalary: salary || (explicitSalary.length <= 160 && /(?:[$€£¥]|\b(?:USD|EUR|GBP|CAD|AUD|KRW)\b)\s*[\d,]+|[\d,]+\s*(?:USD|EUR|GBP|CAD|AUD|KRW)\b/i.test(explicitSalary) ? explicitSalary : ''),
      jobDatePosted: Number.isFinite(postedTime) && postedTime <= Date.now() && new Date(postedTime).toISOString().startsWith(publishedDay) ? new Date(postedTime).toISOString() : ''
    };
  }

  function formatJobSalary(salary) {
    if (!salary || Array.isArray(salary)) return '';
    const currency = String(salary.currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return '';
    const amount = salary.value;
    const range = amount && typeof amount === 'object' ? amount : { value: amount };
    const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
    const min = number(range.minValue), max = number(range.maxValue), exact = number(range.value);
    if (min !== null && max !== null && min > max) return '';
    const unit = { HOUR: 'hour', DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }[String(range.unitText || salary.unitText || '').toUpperCase()];
    const format = value => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`;
    const value = min !== null && max !== null ? `${format(min)}–${format(max)}` : exact !== null ? format(exact) : min !== null ? `From ${format(min)}` : max !== null ? `Up to ${format(max)}` : '';
    return value ? `${currency} ${value}${unit ? ` / ${unit}` : ''}` : '';
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
    const signature = JSON.stringify(context);
    if (signature !== lastPublishedContext) {
      lastPublishedContext = signature;
      chrome.runtime.sendMessage({ type: "REACHARD_PAGE_CHANGED" }).catch(() => {});
    }
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
      <span class="fc-sidebar-logo" aria-hidden="true">R</span>
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

  function openPanel() {
    chrome.runtime.sendMessage({ type: 'OPEN_REACHARD_SIDE_PANEL' }).then(result => {
      if (!result?.ok) console.warn('Could not open Reachard', result?.error);
    }).catch(error => console.warn('Could not open Reachard', error.message));
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

  function t(key, values = {}) {
    const template = ({ emailWithReachard: "Email with Reachard", findWithReachard: "Find with Reachard" })[key] || key;
    return Object.entries(values).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template
    );
  }

  function boot() {
    window[CLEANUP_KEY]?.();
    window[AUTH_LISTENER_KEY] = (message, sender, sendResponse) => {
      if (message?.type === "GET_REACHARD_PAGE_CONTEXT") {
        sendResponse({ ok: true, pageContext: isReachardWebsite() ? null : getPageContext() });
      }
    };
    chrome.runtime.onMessage.addListener(window[AUTH_LISTENER_KEY]);
    document.getElementById(ROOT_ID)?.remove();
    window.ReachardUI?.unmount(document.getElementById(PANEL_ID));
      document.getElementById(PANEL_ID)?.remove();

    let refreshTimer = 0;
    const scheduleEnsureButton = () => {
      if (refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = 0;
        ensureButton();
      }, BUTTON_REFRESH_DELAY_MS);
    };

    if (!isReachardWebsite()) ensureButton();
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
      window.ReachardUI?.unmount(document.getElementById(PANEL_ID));
      document.getElementById(PANEL_ID)?.remove();
    };
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
