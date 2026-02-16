import { createHash } from "node:crypto";
import { getOpenRouterConfig } from "../../config/ai.js";
import { getJokes, toSafeRouteError } from "../../lib/database.js";

const JOKE_API_BASE_URL = "https://v2.jokeapi.dev/joke";
const ALLOWED_LANGS = new Set(["en", "es", "fr", "de", "cs", "pt"]);
const ALLOWED_CATEGORIES = new Set(["random", "dark"]);
const FEED_DEFAULT_LIMIT = 10;
const FEED_MAX_LIMIT = 24;
const FEED_DEFAULT_OFFSET = 0;
const FEED_REMOTE_TIMEOUT_MS = 7000;
const FEED_MAX_EXTERNAL_BATCH = 8;
const FEED_MAX_AI_BATCH = 5;
const FEED_BLOCKED_PATTERN =
  /\b(hate|kill|murder|rape|terror|nazi|racist|genocide|porn|nsfw|sex|explicit)\b/i;

function sanitizeLang(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_LANGS.has(normalized) ? normalized : "en";
}

function sanitizeCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : "random";
}

function sanitizeFeedCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return normalized || "random";
}

function sanitizeFeedLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return FEED_DEFAULT_LIMIT;
  }
  return Math.min(FEED_MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function sanitizeFeedOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return FEED_DEFAULT_OFFSET;
  }
  return Math.floor(parsed);
}

function sanitizeText(value, maxLength = 480) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeForHash(value) {
  return sanitizeText(value, 1200).toLowerCase();
}

function buildContentHash(text, lang = "en") {
  const seed = `${lang}|${normalizeForHash(text)}`;
  return createHash("sha1").update(seed).digest("hex");
}

function createTimeoutSignal(timeoutMs = FEED_REMOTE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(1200, Number(timeoutMs) || FEED_REMOTE_TIMEOUT_MS)
  );
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function buildExternalUrl(lang, category) {
  const apiCategory = category === "dark" ? "Dark" : "Misc,Pun";
  const params = new URLSearchParams();
  params.set("type", "single");
  params.set("blacklistFlags", "nsfw,religious,political,racist,sexist,explicit");
  params.set("lang", lang);
  return `${JOKE_API_BASE_URL}/${apiCategory}?safe-mode&${params.toString()}`;
}

function buildExternalBatchUrl(lang, category, amount) {
  const apiCategory = category === "dark" ? "Dark" : "Misc,Pun";
  const params = new URLSearchParams();
  params.set("type", "single");
  params.set("amount", String(Math.max(1, Math.min(FEED_MAX_EXTERNAL_BATCH, amount))));
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

function normalizeFeedCandidate(input = {}, defaults = {}) {
  const text = sanitizeText(input.text || input.joke || "");
  if (!text || FEED_BLOCKED_PATTERN.test(text)) {
    return null;
  }
  const language = sanitizeLang(input.language || input.lang || defaults.language || "en");
  const category = sanitizeFeedCategory(input.category || defaults.category || "random");
  const hash = buildContentHash(text, language);
  const createdAt = sanitizeText(input.createdAt || "", 64) || new Date().toISOString();
  const source = sanitizeText(input.source || defaults.source || "local", 40).toLowerCase();
  const resolvedSource = source || "local";
  const id = sanitizeText(input.id || `feed_${hash.slice(0, 14)}`, 120) || `feed_${hash.slice(0, 14)}`;
  return {
    id,
    text,
    language,
    category,
    source: resolvedSource,
    createdAt,
    hash,
  };
}

function dedupeFeedCandidates(list = []) {
  const seenHashes = new Set();
  const deduped = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item || !item.hash) {
      continue;
    }
    if (seenHashes.has(item.hash)) {
      continue;
    }
    seenHashes.add(item.hash);
    deduped.push(item);
  }
  return deduped;
}

function applyMonetizationTags(candidate) {
  return {
    ...candidate,
    tier: "free",
    premiumPack: "",
    premiumPreview: false,
    monetizationReady: true,
  };
}

function shuffleArray(list = []) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function interleaveBuckets(buckets = [], maxItems = FEED_MAX_LIMIT) {
  const queues = buckets.map((items) => (Array.isArray(items) ? items.slice() : []));
  const output = [];
  let pointer = 0;
  while (output.length < maxItems && queues.some((queue) => queue.length > 0)) {
    const queue = queues[pointer % queues.length];
    pointer += 1;
    if (!queue.length) {
      continue;
    }
    output.push(queue.shift());
  }
  return output;
}

async function fetchExternalFeedCandidates(lang, category, count) {
  const targetCount = Math.max(1, Math.min(FEED_MAX_EXTERNAL_BATCH, Number(count) || 1));
  const url = buildExternalBatchUrl(lang, category, targetCount);
  const timeout = createTimeoutSignal(FEED_REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: timeout.signal });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json().catch(() => null);
    if (!payload || payload.error) {
      return [];
    }
    const jokes = Array.isArray(payload.jokes)
      ? payload.jokes
      : payload.type === "single" && payload.joke
        ? [payload]
        : [];
    return jokes
      .map((entry) =>
        normalizeFeedCandidate(
          {
            joke: entry?.joke || "",
            language: lang,
            category,
            source: "external_api",
            createdAt: new Date().toISOString(),
          },
          { language: lang, category, source: "external_api" }
        )
      )
      .filter(Boolean);
  } catch (error) {
    return [];
  } finally {
    timeout.clear();
  }
}

function buildAiPrompt(language, category) {
  const languageLabel = language || "en";
  const categoryLabel = category === "dark" ? "dark humor" : "general humor";
  return (
    `Write one short, clean, original ${categoryLabel} joke in ${languageLabel}. ` +
    "Do not include markdown, numbering, or labels. Return only the joke text."
  );
}

async function fetchAiFeedCandidates(lang, category, count) {
  const config = getOpenRouterConfig();
  if (!config.apiKey) {
    return [];
  }
  const targetCount = Math.max(1, Math.min(FEED_MAX_AI_BATCH, Number(count) || 1));
  const candidates = [];
  const seenHashes = new Set();
  for (let attempt = 0; attempt < targetCount * 2 && candidates.length < targetCount; attempt += 1) {
    const timeout = createTimeoutSignal(config.timeoutMs || FEED_REMOTE_TIMEOUT_MS);
    try {
      const headers = {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      };
      if (config.appUrl) {
        headers["HTTP-Referer"] = config.appUrl;
      }
      if (config.appName) {
        headers["X-Title"] = config.appName;
      }
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          temperature: 0.84,
          messages: [{ role: "user", content: buildAiPrompt(lang, category) }],
        }),
        signal: timeout.signal,
      });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json().catch(() => null);
      const text = sanitizeText(payload?.choices?.[0]?.message?.content || "", 420);
      if (!text || FEED_BLOCKED_PATTERN.test(text)) {
        continue;
      }
      const normalized = normalizeFeedCandidate(
        {
          joke: text,
          language: lang,
          category,
          source: "ai",
          createdAt: new Date().toISOString(),
        },
        { language: lang, category, source: "ai" }
      );
      if (!normalized || seenHashes.has(normalized.hash)) {
        continue;
      }
      seenHashes.add(normalized.hash);
      candidates.push(normalized);
    } catch (error) {
      continue;
    } finally {
      timeout.clear();
    }
  }
  return candidates;
}

async function fetchLocalFeedCandidates(lang, category, limit, offset) {
  const pullLimit = Math.max(limit * 3, 30);
  const result = await getJokes({
    language: lang,
    category,
    sort: "newest",
    limit: pullLimit,
    offset,
  });
  const jokes = Array.isArray(result?.jokes) ? result.jokes : [];
  const mapped = jokes
    .map((entry) => {
      const source = Array.isArray(entry?.tags) && entry.tags.some((tag) => String(tag).toLowerCase().includes("user"))
        ? "user"
        : "local";
      return normalizeFeedCandidate(
        {
          id: entry?.id,
          text: entry?.text,
          language: entry?.language || lang,
          category: entry?.category || category,
          createdAt: entry?.createdAt,
          source,
        },
        { language: lang, category, source }
      );
    })
    .filter(Boolean);
  return {
    list: mapped,
    total: Number(result?.total) || mapped.length,
  };
}

async function handleFeedRequest(query, res) {
  const lang = sanitizeLang(Array.isArray(query.lang) ? query.lang[0] : query.lang);
  const category = sanitizeFeedCategory(Array.isArray(query.category) ? query.category[0] : query.category);
  const limit = sanitizeFeedLimit(Array.isArray(query.limit) ? query.limit[0] : query.limit);
  const offset = sanitizeFeedOffset(Array.isArray(query.offset) ? query.offset[0] : query.offset);
  const includePremium = String(query.includePremium || "true").toLowerCase() !== "false";

  const externalCount = Math.max(2, Math.ceil(limit / 2));
  const aiCount = Math.max(1, Math.ceil(limit / 3));

  const [localResult, externalList, aiList] = await Promise.all([
    fetchLocalFeedCandidates(lang, category, limit, offset),
    fetchExternalFeedCandidates(lang, category, externalCount),
    fetchAiFeedCandidates(lang, category, aiCount),
  ]);

  const freshestLocal = localResult.list
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || "") || 0;
      const rightTime = Date.parse(right.createdAt || "") || 0;
      return rightTime - leftTime;
    })
    .slice(0, Math.max(limit * 2, 18));

  const mixed = interleaveBuckets(
    [
      freshestLocal,
      shuffleArray(externalList),
      shuffleArray(aiList),
    ],
    Math.max(limit * 5, 42)
  );

  const deduped = dedupeFeedCandidates(mixed).map(applyMonetizationTags);
  const filtered = includePremium ? deduped : deduped.filter((item) => item.tier !== "premium");
  const paged = filtered.slice(offset, offset + limit);

  return res.status(200).json({
    success: true,
    jokes: paged,
    total: filtered.length,
    hasMore: offset + limit < filtered.length || localResult.total > offset + limit,
    filters: {
      source: "feed",
      lang,
      category,
      limit,
      offset,
    },
    sourceBreakdown: {
      local: freshestLocal.length,
      externalApi: externalList.length,
      ai: aiList.length,
    },
    monetizationReady: true,
    cached: false,
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const filters = req.query && typeof req.query === "object" ? req.query : {};
    const source = String(filters.source || "").toLowerCase();
    if (source === "external") {
      return await handleExternalJokeRequest(filters, res);
    }
    if (source === "feed" || source === "all") {
      return await handleFeedRequest(filters, res);
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
