import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { searchContacts, revealEmail } from "./lib/contacts-provider.js";
import { rankContacts } from "./lib/ranking.js";
import { createDraft, createMailtoUrl, getDraftInternalCost } from "./lib/email.js";
import { errorHandler, fail, logRequest, ok, publicError, requestContext, writeLog } from "./lib/http.js";
import {
  getBearerToken,
  chargeAndLogApiUsage,
  checkAccountDb,
  claimApiRequest,
  closeAccountDb,
  failApiRequest,
  getAccountSummary,
  getCreditBalance,
  getOnboardingForUser,
  getUserFromApiToken,
  getUserSettings,
  isAccountDbConfigured,
  logApiUsage,
  pruneApiIdempotencyKeys
} from "./lib/account.js";

const app = express();
const port = positiveIntegerEnv("PORT", 8787);
let shuttingDown = false;
const apiLimiter = createRateLimiter({
  windowMs: positiveIntegerEnv("RATE_LIMIT_WINDOW_MS", 60_000),
  max: positiveIntegerEnv("RATE_LIMIT_MAX", 60)
});

app.use(helmet());
app.use(requestContext);
app.use(logRequest);
app.use(express.json({ limit: "64kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const extensionOrigins = [
      process.env.ALLOWED_EXTENSION_ORIGINS,
      process.env.EXTENSION_ORIGIN
    ]
      .filter(Boolean)
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    const webOrigins = [process.env.ALLOWED_WEB_ORIGINS, process.env.WEB_BASE_URL]
      .filter(Boolean)
      .flatMap((value) => String(value).split(","))
      .map((value) => {
        try {
          return new URL(value.trim()).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    const allowed = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8787",
      "http://127.0.0.1:8787",
      ...webOrigins
    ];

    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    if (origin.startsWith("chrome-extension://")) {
      if (extensionOrigins.length === 0 || extensionOrigins.includes(origin)) {
        return callback(null, true);
      }
    }

    const error = new Error("Origin not allowed");
    error.status = 403;
    error.publicMessage = "Origin not allowed.";
    return callback(error);
  }
}));
app.use("/api", apiLimiter);
app.use("/api", requireAuth);

app.get("/live", (_req, res) => {
  if (shuttingDown) return fail(res, 503, "Server is shutting down.");
  return ok(res, { live: true });
});

app.get("/health", async (_req, res) => {
  const issues = requiredConfigurationIssues();
  if (isAccountDbConfigured()) {
    try {
      await checkAccountDb();
    } catch (_error) {
      issues.push("account_database_unavailable");
    }
  }
  if (shuttingDown) issues.push("server_shutting_down");

  const payload = {
    ready: issues.length === 0,
    issues,
    provider: providerStatus(),
    auth: {
      accountDbConfigured: isAccountDbConfigured()
    }
  };
  return issues.length ? res.status(503).json({ ok: false, ...payload }) : ok(res, payload);
});

app.get(["/connect-extension", "/pricing"], (req, res) => {
  const webBaseUrl = getWebRedirectBaseUrl();
  if (!webBaseUrl) {
    return res.status(503).send(
      "Web app URL is not configured. Set WEB_BASE_URL on the contacts API server."
    );
  }

  const redirectUrl = new URL(req.path, webBaseUrl);
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => redirectUrl.searchParams.append(key, String(item)));
    } else if (value !== undefined) {
      redirectUrl.searchParams.set(key, String(value));
    }
  }

  res.redirect(302, redirectUrl.toString());
});

app.get("/api/account", async (req, res, next) => {
  try {
    const [account, balance] = await Promise.all([
      getAccountSummary(req.user.id),
      getCreditBalance(req.user.id)
    ]);
    if (account.onboarding?.billing) {
      account.onboarding.billing.creditsRemaining = balance;
      account.onboarding.billing.creditStatus = balance > 0 ? "available" : "empty";
    }
    ok(res, { ...account, credits: { balance, remaining: balance } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/contacts/search", prepareIdempotentRequest("contacts.search"), requireCredits("contacts.search", creditCost("CONTACT_SEARCH_CREDITS", 0)), async (req, res, next) => {
  try {
    const onboarding = await getOnboardingForUser(req.user.id);
    if (!onboarding.complete) return fail(res, 428, "Complete your profile before using Reachard.", onboardingAction(onboarding));
    const settings = await getUserSettings(req.user.id);
    const context = normalizeContext(req.body?.pageContext || req.body, settings);
    if (!context.companyName && !context.companyDomain) {
      return fail(res, 400, "Could not read the company name from this page.", {
        action: { label: "Open page", url: context.sourceUrl || context.jobUrl || "https://www.linkedin.com/jobs/" },
        credits: { remaining: await getCreditBalance(req.user.id) }
      });
    }

    const providerRequest = {
      customerId: req.user.id,
      idempotencyKey: req.idempotencyKey
    };
    const contacts = await searchContacts(context, providerRequest).catch(async (error) => {
      writeLog("warn", "contacts.provider_failed", {
        requestId: req.requestId,
        provider: providerStatus().contactProvider,
        error: error.message
      });
      if (error.publicMessage && error.status && error.status < 500) {
        throw publicError(error.publicMessage, error.status, {
          action: error.status === 428 ? { label: "Complete profile", url: `${getWebRedirectBaseUrl()}/onboarding` } : undefined,
          credits: { remaining: await getCreditBalance(req.user.id) }
        });
      }
      throw publicError("Contact search is temporarily unavailable. Try again shortly.", 503);
    });
    const ranked = rankContacts(contacts, context).slice(0, 10);
    const completed = await chargeAndRecord(req, "contacts.search", { contacts: ranked }, providerRequest.internalCost);
    ok(res, completed.response);
  } catch (error) {
    await recordFailure(req, "contacts.search", error).catch(() => {});
    next(error);
  }
});

app.post("/api/contacts/reveal", prepareIdempotentRequest("contacts.reveal"), requireCredits("contacts.reveal", creditCost("CONTACT_REVEAL_CREDITS", 1)), async (req, res, next) => {
  try {
    const onboarding = await getOnboardingForUser(req.user.id);
    if (!onboarding.complete) return fail(res, 428, "Complete your profile before using Reachard.", onboardingAction(onboarding));
    const contact = normalizeRevealContact(req.body?.contact);
    if (!contact) return fail(res, 400, "Choose a valid contact before revealing an email.");

    const providerRequest = {
      customerId: req.user.id,
      idempotencyKey: req.idempotencyKey
    };
    const email = await revealEmail(contact, providerRequest).catch((error) => {
      writeLog("warn", "contacts.reveal_provider_failed", {
        requestId: req.requestId,
        provider: revealProviderName(),
        error: error.message
      });
      throw publicError("Email reveal is temporarily unavailable. Try again shortly.", 503);
    });
    if (!email) {
      await Promise.all([
        failApiRequest({
          userId: req.user.id,
          action: "contacts.reveal",
          idempotencyKey: req.idempotencyKey,
          error: "email_not_found"
        }),
        recordUsage(req, "contacts.reveal", 0, "not_found", {
          emailFound: false,
          ...(providerRequest.internalCost ? { internalCost: providerRequest.internalCost } : {})
        })
      ]);
      return fail(res, 404, "No work email was found. No Contact Kit was used.", {
        credits: { remaining: await getCreditBalance(req.user.id) }
      });
    }

    const completed = await chargeAndRecord(req, "contacts.reveal", {
      email,
      provider: revealProviderName()
    }, providerRequest.internalCost);
    ok(res, completed.response);
  } catch (error) {
    await recordFailure(req, "contacts.reveal", error).catch(() => {});
    next(error);
  }
});

app.post("/api/email/draft", prepareIdempotentRequest("email.draft"), requireCredits("email.draft", creditCost("EMAIL_DRAFT_CREDITS", 0)), async (req, res, next) => {
  try {
    const onboarding = await getOnboardingForUser(req.user.id);
    if (!onboarding.complete) return fail(res, 428, "Complete your profile before using Reachard.", onboardingAction(onboarding));
    const contact = req.body?.contact;
    const settings = await getUserSettings(req.user.id);
    const context = normalizeContext(req.body?.pageContext || req.body?.job || {}, settings);

    if (!contact?.email) {
      return fail(res, 400, "Unlock this contact before drafting outreach.", {
        credits: { remaining: await getCreditBalance(req.user.id) }
      });
    }

    const draft = await createDraft(contact, context, settings);
    const completed = await chargeAndRecord(req, "email.draft", {
      ...draft,
      mailtoUrl: createMailtoUrl(contact.email, draft)
    }, getDraftInternalCost(draft));
    ok(res, completed.response);
  } catch (error) {
    await recordFailure(req, "email.draft", error).catch(() => {});
    next(error);
  }
});

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Reachard server listening on http://localhost:${port}`);
});
const idempotencyCleanupTimer = setInterval(() => {
  void pruneApiIdempotencyKeys().catch((error) => {
    writeLog("warn", "idempotency.cleanup_failed", { error: error.message });
  });
}, 6 * 60 * 60 * 1000);
idempotencyCleanupTimer.unref();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.startedAt > windowMs) {
      buckets.set(key, { count: 1, startedAt: now });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      return fail(res, 429, "Too many requests. Try again shortly.");
    }

    return next();
  };
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return fail(res, 401, "Sign in to use this API.", {
        action: { label: "Connect extension", url: `${getWebRedirectBaseUrl()}/connect-extension` }
      });
    }

    req.user = await getUserFromApiToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

function requireCredits(action, amount) {
  return async (req, res, next) => {
    try {
      const balance = await getCreditBalance(req.user.id);
      if (balance < amount) {
        await failApiRequest({
          userId: req.user.id,
          action,
          idempotencyKey: req.idempotencyKey,
          error: "insufficient_credits"
        });
        return fail(res, 402, "No Contact Kits left", {
          action: { label: "Open pricing", url: `${getWebRedirectBaseUrl()}/pricing` },
          credits: { remaining: balance, required: amount }
        });
      }

      req.creditCharge = { action, amount };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function prepareIdempotentRequest(action) {
  return async (req, res, next) => {
    try {
      const suppliedKey = String(req.get("idempotency-key") || "").trim();
      if (suppliedKey && (!/^[A-Za-z0-9._:-]+$/.test(suppliedKey) || suppliedKey.length > 120)) {
        return fail(res, 400, "Invalid Idempotency-Key header.");
      }

      req.idempotencyKey = suppliedKey || req.requestId;
      const claim = await claimApiRequest({
        userId: req.user.id,
        action,
        idempotencyKey: req.idempotencyKey
      });
      if (claim.status === "replay") {
        return ok(res, { ...(claim.response || {}), idempotentReplay: true });
      }
      if (claim.status === "processing") {
        res.setHeader("Retry-After", "2");
        return fail(res, 409, "This request is already being processed.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function chargeAndRecord(req, action, response, internalCost) {
  const charge = req.creditCharge || { action, amount: 0 };
  const result = await chargeAndLogApiUsage({
    userId: req.user.id,
    amount: charge.amount,
    action,
    idempotencyKey: req.idempotencyKey,
    request: summarizeRequest(req),
    response,
    internalCost
  });

  if (!result?.ok) {
    throw publicError("No Contact Kits left", 402, {
      action: { label: "Open pricing", url: `${getWebRedirectBaseUrl()}/pricing` },
      credits: { remaining: result?.balance ?? 0, required: charge.amount }
    });
  }

  return result;
}

async function recordUsage(req, action, credits, status, response) {
  if (!req.user?.id) return;
  await logApiUsage({
    userId: req.user.id,
    action,
    requestId: req.idempotencyKey,
    credits,
    status,
    request: summarizeRequest(req),
    response
  });
}

async function recordFailure(req, action, error) {
  if (!req.user?.id) return;
  await Promise.all([
    failApiRequest({
      userId: req.user.id,
      action,
      idempotencyKey: req.idempotencyKey,
      error: error?.message || error
    }),
    recordUsage(req, action, 0, "error", { error: error?.message || String(error) })
  ]);
}

function summarizeRequest(req) {
  const body = req.body || {};
  const context = body.pageContext || body.job || body;
  return {
    type: context.type,
    companyName: context.companyName,
    companyDomain: context.companyDomain,
    jobTitle: context.jobTitle,
    contactProvider: body.contact?.provider,
    contactId: body.contact?.id || body.contact?.linkedinUrl
  };
}

function creditCost(name, fallback) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function positiveIntegerEnv(name, fallback) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function normalizeContext(input, settings = {}) {
  const jobTitle = clean(input?.jobTitle);
  const sourceUrl = clean(input?.sourceUrl || input?.jobUrl);
  const type = clean(input?.type || "linkedin_job");
  const searchPreferences = normalizeSearchPreferences(settings);
  const companyContext = ["linkedin_company", "company_site"].includes(type);
  return {
    type,
    source: clean(input?.source),
    companyName: clean(input?.companyName),
    companyDomain: cleanDomain(input?.companyDomain),
    companyLinkedInUrl: clean(input?.companyLinkedInUrl),
    jobTitle,
    originalJobTitle: jobTitle,
    searchPreferences,
    jobLocation: clean(input?.jobLocation) || (companyContext ? searchPreferences.region.label : ""),
    jobUrl: sourceUrl,
    sourceUrl,
    jobDescription: cleanMultiline(input?.jobDescription),
    personName: clean(input?.personName),
    personTitle: clean(input?.personTitle),
    personLinkedInUrl: clean(input?.personLinkedInUrl),
    pageTitle: clean(input?.pageTitle)
  };
}

function normalizeRevealContact(input) {
  if (!input || typeof input !== "object") return null;
  const contact = {
    id: clean(input.id),
    apolloId: clean(input.apolloId),
    name: clean(input.name),
    title: clean(input.title),
    companyName: clean(input.companyName),
    companyDomain: cleanDomain(input.companyDomain),
    linkedinUrl: normalizeLinkedinProfileUrl(input.linkedinUrl)
  };
  if (!contact.linkedinUrl && !contact.name && !contact.apolloId) return null;
  return contact;
}

function normalizeLinkedinProfileUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "linkedin.com" || !url.pathname.startsWith("/in/")) return "";
    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function revealProviderName() {
  if (String(process.env.APOLLO_MOCK || "").toLowerCase() === "true") return "mock";
  const provider = String(process.env.CONTACT_PROVIDER || "treg").toLowerCase();
  return provider === "rapidapi" ? "hunter" : provider;
}

function onboardingAction(onboarding) {
  return {
    onboarding,
    action: { label: "Complete profile", url: `${getWebRedirectBaseUrl()}/onboarding` }
  };
}

function normalizeSearchPreferences(settings = {}) {
  const preferences = settings.default_search_preferences || settings.defaultSearchPreferences || {};
  return {
    school: normalizePreference(preferences.school),
    region: normalizePreference(preferences.region)
  };
}

function normalizePreference(value) {
  if (!value || typeof value !== "object") return {};
  return {
    label: clean(value.label),
    linkedinId: clean(value.linkedinId),
    linkedinSchoolId: clean(value.linkedinSchoolId),
    linkedinGeoId: clean(value.linkedinGeoId),
    geoId: clean(value.geoId)
  };
}

function clean(value) {
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

function getWebRedirectBaseUrl() {
  const fallback = "https://reachard.co";
  const value = String(process.env.WEB_BASE_URL || process.env.BASE_URL || fallback).replace(/\/+$/, "");

  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "reachard.co",
      "www.reachard.co",
      "localhost",
      "127.0.0.1"
    ]);

    if (allowedHosts.has(url.hostname)) {
      return url.origin;
    }
  } catch (_error) {
    return fallback;
  }

  return fallback;
}

function providerStatus() {
  const contactProvider = String(process.env.CONTACT_PROVIDER || "treg").toLowerCase();
  return {
    contactProvider,
    apolloMock: String(process.env.APOLLO_MOCK || "").toLowerCase() === "true",
    hasApolloKey: Boolean(process.env.APOLLO_API_KEY),
    hasHunterKey: Boolean(process.env.HUNTER_API_KEY),
    hasExploriumKey: Boolean(process.env.EXPLORIUM_API_KEY),
    hasRapidApiKey: Boolean(process.env.RAPIDAPI_KEY),
    hasTregToken: Boolean(process.env.TREG_TOKEN)
  };
}

function requiredConfigurationIssues() {
  const status = providerStatus();
  const issues = [];
  if (!isAccountDbConfigured()) issues.push("account_database_not_configured");
  if (status.contactProvider === "rapidapi" && !status.hasRapidApiKey) {
    issues.push("rapidapi_key_missing");
  }
  if (status.contactProvider === "rapidapi" && !status.apolloMock && !status.hasHunterKey) {
    issues.push("hunter_key_missing");
  }
  if (status.contactProvider === "apollo" && !status.apolloMock && !status.hasApolloKey) {
    issues.push("apollo_key_missing");
  }
  if (status.contactProvider === "explorium" && !status.hasExploriumKey) {
    issues.push("explorium_key_missing");
  }
  if (status.contactProvider === "treg" && !status.hasTregToken) {
    issues.push("treg_token_missing");
  }
  return issues;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(idempotencyCleanupTimer);
  writeLog("info", "server.shutdown_started", { signal });
  const forceTimer = setTimeout(() => process.exit(1), 10_000);
  forceTimer.unref();

  server.close(async (error) => {
    try {
      await closeAccountDb();
    } finally {
      clearTimeout(forceTimer);
      if (error) {
        writeLog("error", "server.shutdown_failed", { signal, error: error.message });
        process.exit(1);
      }
      writeLog("info", "server.shutdown_completed", { signal });
      process.exit(0);
    }
  });
}
