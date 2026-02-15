import { createHash } from "node:crypto";
import { getViralContentConfig } from "../config/ai.js";

const FALLBACK_ITEMS = [
  {
    id: "viral-fallback-1",
    title: "Feel-good office one-liners are trending this week",
    summary: "Short, clean workplace humor clips are driving strong engagement.",
    source: "Voice Joke Club",
    url: "",
    kind: "trending",
    score: 88,
    publishedAt: "",
  },
  {
    id: "viral-fallback-2",
    title: "Relatable school memes are going viral again",
    summary: "Back-to-class jokes and study memes are rapidly circulating.",
    source: "Voice Joke Club",
    url: "",
    kind: "viral",
    score: 84,
    publishedAt: "",
  },
  {
    id: "viral-fallback-3",
    title: "Family-friendly reaction content keeps rising",
    summary: "Clean reaction posts with simple punchlines are performing best.",
    source: "Voice Joke Club",
    url: "",
    kind: "trending",
    score: 81,
    publishedAt: "",
  },
  {
    id: "viral-fallback-4",
    title: "Short storytelling jokes are gaining momentum",
    summary: "Compact story-style jokes are seeing repeat shares across platforms.",
    source: "Voice Joke Club",
    url: "",
    kind: "viral",
    score: 79,
    publishedAt: "",
  },
];

function sanitizeText(value, maxLength = 280) {
  if (!value) {
    return "";
  }
  return String(value).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeUrl(value) {
  const raw = sanitizeText(value, 500);
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function sanitizeKind(value) {
  const normalized = sanitizeText(value, 24).toLowerCase();
  if (normalized.includes("trend")) {
    return "trending";
  }
  if (normalized.includes("viral")) {
    return "viral";
  }
  return "viral";
}

function toScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(9999, Math.round(parsed));
}

function toIsoDate(value) {
  if (!value) {
    return "";
  }
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString();
}

function readQuery(req) {
  if (req?.query && typeof req.query === "object") {
    return req.query;
  }
  try {
    const url = new URL(req?.url || "", "http://localhost");
    const output = {};
    for (const [key, value] of url.searchParams.entries()) {
      output[key] = value;
    }
    return output;
  } catch (error) {
    return {};
  }
}

function toLimit(value, fallback) {
  const resolved = Array.isArray(value) ? value[0] : value;
  const parsed = Number(resolved);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(30, Math.max(1, Math.floor(parsed)));
}

function parseJsonFromText(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const withoutFence = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch (nestedError) {
        return null;
      }
    }
    return null;
  }
}

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const directKeys = ["items", "data", "results", "trending", "viral", "content"];
  for (let i = 0; i < directKeys.length; i += 1) {
    const candidate = payload[directKeys[i]];
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === "object" && Array.isArray(candidate.items)) {
      return candidate.items;
    }
  }
  return [];
}

function normalizeItem(rawItem, index) {
  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }
  const title = sanitizeText(
    rawItem.title ||
      rawItem.headline ||
      rawItem.name ||
      rawItem.topic ||
      rawItem.text ||
      rawItem.caption,
    160
  );
  if (!title) {
    return null;
  }
  const summary = sanitizeText(
    rawItem.summary || rawItem.description || rawItem.body || rawItem.subtitle || "",
    320
  );
  const source = sanitizeText(
    rawItem.source || rawItem.platform || rawItem.provider || rawItem.origin || "Viral API",
    60
  );
  const url = sanitizeUrl(rawItem.url || rawItem.link || rawItem.permalink || rawItem.sourceUrl || "");
  const kind = sanitizeKind(rawItem.kind || rawItem.type || rawItem.label || "");
  const score = toScore(
    rawItem.score ||
      rawItem.engagement ||
      rawItem.popularity ||
      rawItem.trendScore ||
      rawItem.views ||
      0
  );
  const publishedAt = toIsoDate(rawItem.publishedAt || rawItem.timestamp || rawItem.createdAt || rawItem.date);
  const safeId = sanitizeText(rawItem.id || rawItem.slug || "", 120);
  const id =
    safeId ||
    createHash("sha256")
      .update(`${title}|${summary}|${url}|${source}|${index}`)
      .digest("hex")
      .slice(0, 24);
  return {
    id,
    title,
    summary,
    source: source || "Viral API",
    url,
    kind,
    score,
    publishedAt,
  };
}

function dedupeItems(items, limit) {
  const seen = new Set();
  const output = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item) {
      continue;
    }
    const key = item.url
      ? `url:${item.url.toLowerCase()}`
      : `title:${item.title.toLowerCase()}|${String(item.source || "").toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
    if (output.length >= limit) {
      break;
    }
  }
  return output;
}

function isOpenRouterUrl(value) {
  return /openrouter\.ai\/api\/v1\/chat\/completions/i.test(String(value || ""));
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, Math.max(1000, Number(timeoutMs) || 8000));
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function fetchFromOpenRouter(config, { limit, lang }) {
  const timeout = createTimeoutSignal(config.timeoutMs);
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
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You curate safe, family-friendly trending content. Return strict JSON only with an items array.",
          },
          {
            role: "user",
            content:
              `Return exactly ${limit} mixed trending and viral content items as JSON only.\n` +
              'Use this schema: {"items":[{"id":"","title":"","summary":"","source":"","url":"","kind":"trending|viral","score":0,"publishedAt":""}]}\n' +
              "No markdown. No explanation. If URL is unknown, use an empty string.\n" +
              `Language: ${lang || "en"}.`,
          },
        ],
      }),
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error(`Viral upstream request failed: ${response.status}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    const parsed = parseJsonFromText(content);
    const items = extractItems(parsed);
    if (items.length) {
      return items;
    }
    return extractItems(payload);
  } finally {
    timeout.clear();
  }
}

async function fetchFromGenericApi(config, { limit, lang }) {
  const timeout = createTimeoutSignal(config.timeoutMs);
  try {
    const target = new URL(config.apiUrl);
    target.searchParams.set("limit", String(limit));
    if (lang) {
      target.searchParams.set("lang", lang);
    }
    const response = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "X-API-Key": config.apiKey,
      },
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error(`Viral upstream request failed: ${response.status}`);
    }
    const payload = await response.json();
    return extractItems(payload);
  } finally {
    timeout.clear();
  }
}

function getFallbackItems(limit) {
  return FALLBACK_ITEMS.slice(0, Math.max(1, Number(limit) || FALLBACK_ITEMS.length));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

  const config = getViralContentConfig();
  const query = readQuery(req);
  const limit = toLimit(query.limit, config.maxItems);
  const lang = sanitizeText(Array.isArray(query.lang) ? query.lang[0] : query.lang, 12).toLowerCase();

  if (!config.apiKey) {
    return res.status(200).json({
      success: false,
      fallback: true,
      error: "Viral content API key is not configured.",
      items: getFallbackItems(limit),
      fetchedAt: new Date().toISOString(),
    });
  }

  try {
    const rawItems = isOpenRouterUrl(config.apiUrl)
      ? await fetchFromOpenRouter(config, { limit, lang })
      : await fetchFromGenericApi(config, { limit, lang });
    const normalized = dedupeItems(rawItems.map(normalizeItem).filter(Boolean), limit);
    if (!normalized.length) {
      throw new Error("No viral content returned by upstream API.");
    }
    return res.status(200).json({
      success: true,
      fallback: false,
      items: normalized,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/viral-content failed:", error);
    return res.status(200).json({
      success: false,
      fallback: true,
      error: "Failed to load viral content from upstream API.",
      items: getFallbackItems(limit),
      fetchedAt: new Date().toISOString(),
    });
  }
}
