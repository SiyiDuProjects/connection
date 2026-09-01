import { fetchWithTimeout } from "./http.js";

const HUNTER_BASE_URL = "https://api.hunter.io/v2";
const revealCache = new Map();
const REVEAL_CACHE_MAX = 5_000;
const REVEAL_SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const REVEAL_MISS_TTL_MS = 24 * 60 * 60 * 1_000;

export async function revealHunterEmail(contact) {
  requireHunterKey();

  if (contact.email) return contact.email;

  const attempts = buildFinderAttempts(contact);
  if (!attempts.length) return "";

  const cacheKey = hunterCacheKey(contact);
  const cached = getCachedReveal(cacheKey);
  if (cached !== undefined) return cached;

  for (const params of attempts) {
    const data = await hunterGet("/email-finder", params);
    const email = usableHunterEmail(data?.data) ? String(data.data.email).trim().toLowerCase() : "";
    if (email) {
      setCachedReveal(cacheKey, email);
      return email;
    }
  }

  setCachedReveal(cacheKey, "");
  return "";
}

export function linkedinHandle(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://www.linkedin.com/in/${raw}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    if (host !== "linkedin.com" || parts[0]?.toLowerCase() !== "in" || !parts[1]) return "";
    return decodeURIComponent(parts[1]).trim();
  } catch {
    return "";
  }
}

function buildFinderAttempts(contact) {
  const attempts = [];
  const handle = linkedinHandle(contact.linkedinUrl);
  if (handle) attempts.push({ linkedin_handle: handle });

  const nameParams = nameQuery(contact.name);
  const domain = cleanDomain(contact.companyDomain);
  const company = String(contact.companyName || "").trim();
  if (Object.keys(nameParams).length && (domain || company)) {
    attempts.push({
      ...nameParams,
      ...(domain ? { domain } : { company })
    });
  }

  return attempts;
}

function nameQuery(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      first_name: parts[0],
      last_name: parts.at(-1)
    };
  }
  return parts.length === 1 ? { full_name: parts[0] } : {};
}

function cleanDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function usableHunterEmail(data) {
  const email = String(data?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const status = String(data?.verification?.status || "").trim().toLowerCase();
  if (status === "unknown" || status === "invalid") return false;

  const score = Number(data?.score);
  const minimumScore = Math.max(0, Math.min(100, Number(process.env.HUNTER_MIN_SCORE || 70)));
  if (Number.isFinite(score) && score < minimumScore) return false;

  return true;
}

async function hunterGet(path, params) {
  const url = new URL(`${HUNTER_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set("max_duration", String(Math.max(3, Math.min(20, Number(process.env.HUNTER_MAX_DURATION || 10)))));

  const response = await fetchWithTimeout(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${process.env.HUNTER_API_KEY}`
    }
  }, {
    provider: "hunter",
    timeoutMs: process.env.HUNTER_TIMEOUT_MS || 15_000
  });

  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;

  if (response.status === 404 || response.status === 451) return { data: {} };

  const details = hunterErrorDetails(data);
  if (response.status === 400 && details.code === "invalid_domain") return { data: {} };

  const error = new Error(details.message || `Hunter request failed with ${response.status}`);
  error.status = response.status >= 500 ? 502 : response.status;
  error.publicMessage = "Hunter email lookup failed. Check API key, quota, or lookup parameters.";
  throw error;
}

function hunterErrorDetails(data) {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const first = errors[0] || data?.error || {};
  return {
    code: String(first.id || first.code || data?.code || "").toLowerCase(),
    message: first.details || first.message || data?.message || ""
  };
}

function hunterCacheKey(contact) {
  return linkedinHandle(contact.linkedinUrl)
    || [contact.name, contact.companyDomain || contact.companyName].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function getCachedReveal(key) {
  if (!key) return undefined;
  const cached = revealCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    revealCache.delete(key);
    return undefined;
  }
  return cached.email;
}

function setCachedReveal(key, email) {
  if (!key) return;
  if (revealCache.size >= REVEAL_CACHE_MAX) {
    revealCache.delete(revealCache.keys().next().value);
  }
  revealCache.set(key, {
    email,
    expiresAt: Date.now() + (email ? REVEAL_SUCCESS_TTL_MS : REVEAL_MISS_TTL_MS)
  });
}

function requireHunterKey() {
  if (!process.env.HUNTER_API_KEY) {
    const error = new Error("Missing HUNTER_API_KEY.");
    error.status = 500;
    error.publicMessage = "Server is missing HUNTER_API_KEY.";
    throw error;
  }
}
