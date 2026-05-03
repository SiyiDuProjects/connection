import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { searchContacts, revealEmail } from "./lib/contacts-provider.js";
import { rankContacts } from "./lib/ranking.js";
import { createDraft, createGmailUrl } from "./lib/email.js";

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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: providerStatus()
  });
});

app.post("/api/contacts/search", async (req, res, next) => {
  try {
    const job = normalizeJob(req.body);
    if (!job.companyName) {
      return res.status(400).json({ ok: false, error: "Missing company name from LinkedIn job page." });
    }

    const contacts = await searchContacts(job);
    const ranked = rankContacts(contacts, job).slice(0, 10);
    res.json({ ok: true, contacts: ranked });
  } catch (error) {
    next(error);
  }
});

app.post("/api/contacts/reveal", async (req, res, next) => {
  try {
    const contact = req.body?.contact;
    if (!contact) return res.status(400).json({ ok: false, error: "Missing contact." });

    const email = contact.email || await revealEmail(contact);
    if (!email) return res.status(404).json({ ok: false, error: "No email found for this contact." });

    res.json({ ok: true, email });
  } catch (error) {
    next(error);
  }
});

app.post("/api/email/draft", (req, res) => {
  const contact = req.body?.contact;
  const job = normalizeJob(req.body?.job || {});

  if (!contact?.email) {
    return res.status(400).json({ ok: false, error: "Reveal an email before drafting." });
  }

  const draft = createDraft(contact, job);
  res.json({ ok: true, ...draft, gmailUrl: createGmailUrl(contact.email, draft) });
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

function providerStatus() {
  const contactProvider = String(process.env.CONTACT_PROVIDER || "apollo").toLowerCase();
  return {
    contactProvider,
    apolloMock: String(process.env.APOLLO_MOCK || "").toLowerCase() === "true",
    hasApolloKey: Boolean(process.env.APOLLO_API_KEY),
    hasExploriumKey: Boolean(process.env.EXPLORIUM_API_KEY)
  };
}
