import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { searchContacts, revealEmail } from "./lib/contacts-provider.js";
import { rankContacts } from "./lib/ranking.js";
import { createDraft, createGmailUrl } from "./lib/email.js";
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
  res.json({
    ok: true,
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
    res.json({ ok: true, ...account, credits: { balance } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/contacts/search", requireCredits("contacts.search", creditCost("CONTACT_SEARCH_CREDITS", 1)), async (req, res, next) => {
  try {
    const job = normalizeJob(req.body);
    if (!job.companyName) {
      return res.status(400).json({ ok: false, error: "Missing company name from LinkedIn job page." });
    }

    const contacts = await searchContacts(job);
    const ranked = rankContacts(contacts, job).slice(0, 10);
    await chargeAndRecord(req, "contacts.search", { resultCount: ranked.length });
    res.json({ ok: true, contacts: ranked, credits: { remaining: await getCreditBalance(req.user.id) } });
  } catch (error) {
    await recordUsage(req, "contacts.search", 0, "error", { error: error.message }).catch(() => {});
    next(error);
  }
});

app.post("/api/contacts/reveal", requireCredits("contacts.reveal", creditCost("CONTACT_REVEAL_CREDITS", 1)), async (req, res, next) => {
  try {
    const contact = req.body?.contact;
    if (!contact) return res.status(400).json({ ok: false, error: "Missing contact." });

    const email = contact.email || await revealEmail(contact);
    if (!email) return res.status(404).json({ ok: false, error: "No email found for this contact." });

    await chargeAndRecord(req, "contacts.reveal", { provider: contact.provider });
    res.json({ ok: true, email, credits: { remaining: await getCreditBalance(req.user.id) } });
  } catch (error) {
    await recordUsage(req, "contacts.reveal", 0, "error", { error: error.message }).catch(() => {});
    next(error);
  }
});

app.post("/api/email/draft", requireCredits("email.draft", creditCost("EMAIL_DRAFT_CREDITS", 1)), async (req, res, next) => {
  try {
    const contact = req.body?.contact;
    const job = normalizeJob(req.body?.job || {});

    if (!contact?.email) {
      return res.status(400).json({ ok: false, error: "Reveal an email before drafting." });
    }

    const settings = await getUserSettings(req.user.id);
    const draft = createDraft(contact, job, settings);
    await chargeAndRecord(req, "email.draft", { hasSettings: Boolean(Object.keys(settings).length) });
    res.json({ ok: true, ...draft, gmailUrl: createGmailUrl(contact.email, draft), credits: { remaining: await getCreditBalance(req.user.id) } });
  } catch (error) {
    await recordUsage(req, "email.draft", 0, "error", { error: error.message }).catch(() => {});
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    ok: false,
    error: error.publicMessage || error.message || "Server error"
  });
});

app.listen(port, () => {
  console.log(`Find Contacts server listening on http://localhost:${port}`);
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
      return res.status(429).json({ ok: false, error: "Too many requests. Try again shortly." });
    }

    return next();
  };
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Sign in to use this API." });

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
        return res.status(402).json({
          ok: false,
          error: "Insufficient credits",
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
    const error = new Error("Insufficient credits");
    error.status = 402;
    error.publicMessage = "Insufficient credits";
    throw error;
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
  return {
    companyName: body.companyName || body.job?.companyName,
    jobTitle: body.jobTitle || body.job?.jobTitle,
    contactProvider: body.contact?.provider,
    contactId: body.contact?.id || body.contact?.linkedinUrl
  };
}

function creditCost(name, fallback) {
  return Math.max(0, Number(process.env[name] || fallback));
}

function normalizeJob(input) {
  return {
    companyName: clean(input?.companyName),
    jobTitle: clean(input?.jobTitle),
    jobLocation: clean(input?.jobLocation),
    jobUrl: clean(input?.jobUrl)
  };
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

    if (allowedHosts.has(url.hostname) && !url.hostname.toLowerCase().includes("lemon")) {
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
