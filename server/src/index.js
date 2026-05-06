import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { searchContacts, revealEmail } from "./lib/contacts-provider.js";
import { rankContacts } from "./lib/ranking.js";
import { createDraft, createGmailUrl, createMailtoUrl } from "./lib/email.js";
import { errorHandler, fail, logRequest, ok, publicError, requestContext, writeLog } from "./lib/http.js";
import {
  getBearerToken,
  getAccountSummary,
  getCreditBalance,
  getUserFromApiToken,
  getUserSettings,
  isAccountDbConfigured,
  logApiUsage,
  spendCredits
} from "./lib/account.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const apiLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 60)
});

app.use(helmet());
app.use(requestContext);
app.use(logRequest);
app.use(express.json({ limit: "64kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.EXTENSION_ORIGIN,
      "http://localhost:8787",
      "http://127.0.0.1:8787"
    ].filter(Boolean);

    if (origin.startsWith("chrome-extension://") || allowed.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed"));
  }
}));
app.use("/api", apiLimiter);
app.use("/api", requireAuth);

app.get("/health", (_req, res) => {
  ok(res, {
    provider: providerStatus(),
    auth: {
      accountDbConfigured: isAccountDbConfigured()
    }
  });
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

app.post("/api/contacts/search", requireCredits("contacts.search", creditCost("CONTACT_SEARCH_CREDITS", 0)), async (req, res, next) => {
  try {
    const settings = await getUserSettings(req.user.id);
    const context = normalizeContext(req.body?.pageContext || req.body, settings);
    if (!context.companyName && !context.companyDomain) {
      return fail(res, 400, "Could not read the company name from this page.", {
        action: { label: "Open page", url: context.sourceUrl || context.jobUrl || "https://www.linkedin.com/jobs/" },
        credits: { remaining: await getCreditBalance(req.user.id) }
      });
    }

    const contacts = await searchContacts(context).catch((error) => {
      writeLog("warn", "contacts.provider_failed", {
        requestId: req.requestId,
        provider: providerStatus().contactProvider,
        error: error.message
      });
      throw publicError("Contact search is temporarily unavailable. Try again shortly.", 503);
    });
    const ranked = rankContacts(contacts, context).slice(0, 10);
    await chargeAndRecord(req, "contacts.search", { resultCount: ranked.length });
    ok(res, { contacts: ranked, credits: { remaining: await getCreditBalance(req.user.id) } });
  } catch (error) {
    await recordUsage(req, "contacts.search", 0, "error", { error: error.message }).catch(() => {});
    next(error);
  }
});

app.post("/api/contacts/reveal", requireCredits("contacts.reveal", creditCost("CONTACT_REVEAL_CREDITS", 1)), async (req, res, next) => {
  try {
    const contact = req.body?.contact;
    if (!contact) return fail(res, 400, "Choose a contact before revealing an email.");

    const email = contact.email || await revealEmail(contact).catch((error) => {
      writeLog("warn", "contacts.reveal_provider_failed", {
        requestId: req.requestId,
        provider: contact.provider || providerStatus().contactProvider,
        error: error.message
      });
      throw publicError("Email reveal is temporarily unavailable. Try again shortly.", 503);
    });
    if (!email) {
      return fail(res, 404, "No email was found for this contact.", {
        credits: { remaining: await getCreditBalance(req.user.id) }
      });
    }

    await chargeAndRecord(req, "contacts.reveal", { provider: contact.provider });
    ok(res, { email, credits: { remaining: await getCreditBalance(req.user.id) } });
  } catch (error) {
    await recordUsage(req, "contacts.reveal", 0, "error", { error: error.message }).catch(() => {});
    next(error);
  }
});

app.post("/api/email/draft", requireCredits("email.draft", creditCost("EMAIL_DRAFT_CREDITS", 0)), async (req, res, next) => {
  try {
    const contact = req.body?.contact;
    const settings = await getUserSettings(req.user.id);
    const context = normalizeContext(req.body?.pageContext || req.body?.job || {}, settings);

    if (!contact?.email) {
      return fail(res, 400, "Unlock this contact before drafting outreach.", {
        credits: { remaining: await getCreditBalance(req.user.id) }
      });
    }

    const draft = await createDraft(contact, context, settings);
    await chargeAndRecord(req, "email.draft", {
      hasSettings: Boolean(Object.keys(settings).length),
      ai: draft.ai
    });
    ok(res, {
      ...draft,
      mailtoUrl: createMailtoUrl(contact.email, draft),
      gmailUrl: createGmailUrl(contact.email, draft),
      credits: { remaining: await getCreditBalance(req.user.id) }
    });
  } catch (error) {
    await recordUsage(req, "email.draft", 0, "error", { error: error.message }).catch(() => {});
    next(error);
  }
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Gaid server listening on http://localhost:${port}`);
});

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

async function chargeAndRecord(req, action, response) {
  const charge = req.creditCharge || { action, amount: 0 };
  const result = await spendCredits({
    userId: req.user.id,
    amount: charge.amount,
    action,
    metadata: summarizeRequest(req)
  });

  if (!result?.ok) {
    throw publicError("No Contact Kits left", 402, {
      action: { label: "Open pricing", url: `${getWebRedirectBaseUrl()}/pricing` },
      credits: { remaining: result?.balance ?? 0, required: charge.amount }
    });
  }

  await recordUsage(req, action, charge.amount, "success", response);
}

async function recordUsage(req, action, credits, status, response) {
  if (!req.user?.id) return;
  await logApiUsage({
    userId: req.user.id,
    action,
    credits,
    status,
    request: summarizeRequest(req),
    response
  });
}

function summarizeRequest(req) {
  const body = req.body || {};
  const context = body.pageContext || body.job || body;
  return {
    type: context.type,
    companyName: context.companyName,
    companyDomain: context.companyDomain,
    jobTitle: context.jobTitle,
    targetRole: context.targetRole,
    contactProvider: body.contact?.provider,
    contactId: body.contact?.id || body.contact?.linkedinUrl
  };
}

function creditCost(name, fallback) {
  return Math.max(0, Number(process.env[name] || fallback));
}

function normalizeContext(input, settings = {}) {
  const targetRole = clean(settings.target_role || settings.targetRole);
  const jobTitle = clean(input?.jobTitle);
  const sourceUrl = clean(input?.sourceUrl || input?.jobUrl);
  return {
    type: clean(input?.type || "linkedin_job"),
    source: clean(input?.source),
    companyName: clean(input?.companyName),
    companyDomain: cleanDomain(input?.companyDomain),
    jobTitle: jobTitle || targetRole,
    originalJobTitle: jobTitle,
    targetRole,
    jobLocation: clean(input?.jobLocation),
    jobUrl: sourceUrl,
    sourceUrl,
    jobDescription: cleanMultiline(input?.jobDescription),
    personName: clean(input?.personName),
    personTitle: clean(input?.personTitle),
    personLinkedInUrl: clean(input?.personLinkedInUrl),
    pageTitle: clean(input?.pageTitle)
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
  const fallback = "https://gaid.studio";
  const value = String(process.env.WEB_BASE_URL || process.env.BASE_URL || fallback).replace(/\/+$/, "");

  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "gaid.studio",
      "www.gaid.studio",
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
  const contactProvider = String(process.env.CONTACT_PROVIDER || "apollo").toLowerCase();
  return {
    contactProvider,
    apolloMock: String(process.env.APOLLO_MOCK || "").toLowerCase() === "true",
    hasApolloKey: Boolean(process.env.APOLLO_API_KEY),
    hasExploriumKey: Boolean(process.env.EXPLORIUM_API_KEY)
  };
}
