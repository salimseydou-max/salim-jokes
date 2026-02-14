import { getJokes, toSafeRouteError } from "../../lib/database.js";

const JOKE_API_BASE_URL = "https://v2.jokeapi.dev/joke";
const ALLOWED_LANGS = new Set(["en", "es", "fr", "de", "cs", "pt"]);
const ALLOWED_CATEGORIES = new Set(["random", "dark"]);

function sanitizeLang(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_LANGS.has(normalized) ? normalized : "en";
}

function sanitizeCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : "random";
}

function buildExternalUrl(lang, category) {
  const apiCategory = category === "dark" ? "Dark" : "Misc,Pun";
  const params = new URLSearchParams();
  params.set("type", "single");
  params.set("blacklistFlags", "nsfw,religious,political,racist,sexist,explicit");
  params.set("lang", lang);
  return `${JOKE_API_BASE_URL}/${apiCategory}?safe-mode&${params.toString()}`;
}

function createExternalFailure(error, retryable, status) {
  return {
    success: false,
    retryable: Boolean(retryable),
    status: Number(status) || 0,
    error:
      typeof error === "string" && error.trim()
        ? error.trim()
        : "External joke provider is currently unavailable.",
  };
}

async function handleExternalJokeRequest(query, res) {
  const lang = sanitizeLang(Array.isArray(query.lang) ? query.lang[0] : query.lang);
  const category = sanitizeCategory(Array.isArray(query.category) ? query.category[0] : query.category);
  const targetUrl = buildExternalUrl(lang, category);

  try {
    const response = await fetch(targetUrl);
    let payload = null;
    try {
      payload = await response.json();
    } catch (jsonError) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload && (payload.message || payload.error) ? payload.message || payload.error : "External joke request failed.";
      const retryable = response.status >= 500 || response.status === 429;
      return res.status(200).json(createExternalFailure(message, retryable, response.status));
    }

    if (!payload || payload.error || payload.type !== "single" || !payload.joke) {
      const message = payload && (payload.message || payload.error) ? payload.message || payload.error : "External joke request failed.";
      return res.status(200).json(createExternalFailure(message, false, 200));
    }

    return res.status(200).json({
      success: true,
      joke: payload,
    });
  } catch (error) {
    return res.status(200).json(createExternalFailure("External joke provider is unavailable.", true, 0));
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const filters = req.query && typeof req.query === "object" ? req.query : {};
    if (String(filters.source || "").toLowerCase() === "external") {
      return await handleExternalJokeRequest(filters, res);
    }
    const result = await getJokes(filters);
    return res.status(200).json({
      jokes: result.jokes,
      total: result.total,
      filters: result.filters,
      cached: result.cached,
    });
  } catch (error) {
    console.error("GET /api/jokes failed:", error);
    const safe = toSafeRouteError(error);
    return res.status(safe.status).json(safe.body);
  }
}
