const DEFAULT_LANG = "en";
const DEFAULT_CATEGORY = "random";

function sanitizeText(value, maxLength = 1200) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }
  const seen = new Set();
  const output = [];
  for (let i = 0; i < tags.length; i += 1) {
    const normalized = sanitizeText(tags[i], 80).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function normalizeFeedItem(input = {}, sourceType = "") {
  const id = sanitizeText(input.id || "");
  const text = sanitizeText(input.text || input.joke || "", 1400);
  if (!id || !text) {
    return null;
  }
  const source = sanitizeText(input.source || sourceType || "random", 80).toLowerCase() || "random";
  const resolvedSourceType = sanitizeText(input.sourceType || sourceType || source, 40).toLowerCase() || "random";
  return {
    id,
    text,
    source,
    sourceType: resolvedSourceType,
    category: sanitizeText(input.category || DEFAULT_CATEGORY, 40).toLowerCase() || DEFAULT_CATEGORY,
    language:
      sanitizeText(input.language || input.lang || DEFAULT_LANG, 12).toLowerCase() || DEFAULT_LANG,
    createdAt: sanitizeText(input.createdAt || "", 80) || new Date().toISOString(),
    tags: sanitizeTags(input.tags),
    viewCount: Math.max(0, Number(input.viewCount) || 0),
    favoriteCount: Math.max(0, Number(input.favoriteCount) || 0),
    popularity: Math.max(0, Number(input.popularity) || 0),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function normalizeList(payload, sourceType) {
  const jokes = Array.isArray(payload?.jokes) ? payload.jokes : [];
  return jokes
    .map((item) => normalizeFeedItem(item, sourceType))
    .filter(Boolean);
}

export async function fetchFeedPage(options = {}) {
  const params = new URLSearchParams();
  params.set("source", "feed");
  params.set("lang", sanitizeText(options.lang || DEFAULT_LANG, 8) || DEFAULT_LANG);
  params.set("category", sanitizeText(options.category || DEFAULT_CATEGORY, 20) || DEFAULT_CATEGORY);
  params.set("limit", String(Math.max(1, Math.floor(Number(options.limit) || 8))));
  params.set("offset", String(Math.max(0, Math.floor(Number(options.offset) || 0))));
  params.set("includePremium", String(Boolean(options.includePremium)));

  const payload = await requestJson(`/api/jokes?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
  });

  return {
    jokes: normalizeList(payload, "random"),
    hasMore: Boolean(payload?.hasMore),
    total: Math.max(0, Number(payload?.total) || 0),
  };
}

export async function fetchJokesList(options = {}) {
  const params = new URLSearchParams();
  params.set("sort", sanitizeText(options.sort || "newest", 24) || "newest");
  params.set("limit", String(Math.max(1, Math.floor(Number(options.limit) || 20))));
  params.set("offset", String(Math.max(0, Math.floor(Number(options.offset) || 0))));
  params.set("language", sanitizeText(options.language || DEFAULT_LANG, 12) || DEFAULT_LANG);
  if (options.category) {
    params.set("category", sanitizeText(options.category, 30));
  }
  const payload = await requestJson(`/api/jokes?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
  });
  return {
    jokes: normalizeList(payload, options.sourceType || "recent"),
    total: Math.max(0, Number(payload?.total) || 0),
  };
}

function hasUserSubmittedTag(joke) {
  const tags = Array.isArray(joke?.tags) ? joke.tags : [];
  if (tags.some((tag) => String(tag).toLowerCase().includes("user"))) {
    return true;
  }
  return joke?.source === "user";
}

export async function fetchUserSubmittedJokes(options = {}) {
  const result = await fetchJokesList({
    sort: "newest",
    limit: Math.max(20, Number(options.limit) * 3 || 40),
    offset: options.offset || 0,
    language: options.language || DEFAULT_LANG,
    sourceType: "user",
  });
  const filtered = result.jokes.filter((joke) => hasUserSubmittedTag(joke));
  return {
    jokes: filtered
      .slice(0, Math.max(1, Number(options.limit) || 12))
      .map((item) => ({ ...item, sourceType: "user" })),
    total: filtered.length,
  };
}

export async function fetchTrendingJokes(options = {}) {
  const result = await fetchJokesList({
    sort: "popularity",
    limit: options.limit || 20,
    offset: options.offset || 0,
    language: options.language || DEFAULT_LANG,
    sourceType: "trending",
  });
  return {
    jokes: result.jokes.map((item) => ({ ...item, sourceType: "trending" })),
    total: result.total,
  };
}

export async function fetchRecentJokes(options = {}) {
  const result = await fetchJokesList({
    sort: "newest",
    limit: options.limit || 20,
    offset: options.offset || 0,
    language: options.language || DEFAULT_LANG,
    sourceType: "recent",
  });
  return {
    jokes: result.jokes.map((item) => ({ ...item, sourceType: "recent" })),
    total: result.total,
  };
}

export async function fetchRandomJokes(options = {}) {
  const result = await fetchFeedPage({
    limit: options.limit || 14,
    offset: options.offset || 0,
    includePremium: false,
    lang: options.language || DEFAULT_LANG,
    category: options.category || DEFAULT_CATEGORY,
  });
  return {
    jokes: result.jokes.map((item) => ({ ...item, sourceType: "random" })),
    total: result.total,
    hasMore: result.hasMore,
  };
}

export async function fetchExternalRandomJoke(options = {}) {
  const params = new URLSearchParams();
  params.set("source", "external");
  params.set("lang", sanitizeText(options.language || DEFAULT_LANG, 8) || DEFAULT_LANG);
  params.set("category", sanitizeText(options.category || DEFAULT_CATEGORY, 20) || DEFAULT_CATEGORY);
  const payload = await requestJson(`/api/jokes?${params.toString()}`, { method: "GET" });
  if (!payload?.success || !payload?.joke) {
    return null;
  }
  const item = payload.joke;
  return normalizeFeedItem(
    {
      id: `ext_${sanitizeText(item.id || "", 40)}_${sanitizeText(item.lang || "en", 8)}`,
      text: item.joke,
      language: item.lang || DEFAULT_LANG,
      category: sanitizeText(options.category || DEFAULT_CATEGORY, 30) || DEFAULT_CATEGORY,
      source: "external_api",
      sourceType: "random",
      createdAt: new Date().toISOString(),
      tags: ["external", "random"],
    },
    "random"
  );
}

function createGeneratedId(text) {
  const normalized = String(text || "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `gen_${Date.now()}_${Math.abs(hash)}`;
}

export async function generateFallbackJoke(options = {}) {
  const style = String(options.style || "mixed").toLowerCase();
  const payload = await requestJson(`/api/generateJoke?style=${encodeURIComponent(style)}`, {
    method: "GET",
  });
  const text = sanitizeText(payload?.joke || "");
  if (!text) {
    throw new Error("No joke returned from generator.");
  }
  return normalizeFeedItem(
    {
      id: createGeneratedId(text),
      text,
      source: payload?.fallback ? "fallback_ai" : "ai",
      sourceType: "ai",
      category: DEFAULT_CATEGORY,
      language: DEFAULT_LANG,
      tags: ["ai", style],
      createdAt: new Date().toISOString(),
    },
    "ai"
  );
}

export async function generateAiJokes(count = 2) {
  const output = [];
  const target = Math.max(1, Math.min(6, Number(count) || 1));
  for (let i = 0; i < target; i += 1) {
    try {
      const style = i % 3 === 1 ? "story" : "quick";
      const joke = await generateFallbackJoke({ style });
      if (joke) {
        output.push(joke);
      }
    } catch (error) {
      continue;
    }
  }
  return output;
}

export async function submitJoke(input = {}) {
  const text = sanitizeText(input.text || input.joke || "");
  if (!text) {
    throw new Error("Please enter a joke first.");
  }
  const payload = await requestJson("/api/jokes/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      language: sanitizeText(input.language || DEFAULT_LANG, 8) || DEFAULT_LANG,
      category: sanitizeText(input.category || DEFAULT_CATEGORY, 20) || DEFAULT_CATEGORY,
      tags: Array.isArray(input.tags) ? input.tags : ["user-submitted"],
      createdAt: new Date().toISOString(),
    }),
  });
  return normalizeFeedItem(payload?.joke || {}, "user");
}

export async function trackJokeView(joke) {
  const normalized = normalizeFeedItem(joke);
  if (!normalized) {
    return null;
  }
  try {
    return await requestJson("/api/jokes/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jokeId: normalized.id,
        text: normalized.text,
        language: normalized.language,
        category: normalized.category,
        tags: normalized.tags,
        createdAt: normalized.createdAt,
      }),
    });
  } catch (error) {
    return null;
  }
}

export async function syncLikeToProfile(jokeId) {
  if (!jokeId) {
    return null;
  }
  try {
    return await requestJson("/api/auth/like", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jokeId }),
    });
  } catch (error) {
    return null;
  }
}

export async function syncFavoriteToProfile(entry) {
  if (!entry || !entry.id) {
    return null;
  }
  try {
    return await requestJson("/api/jokes/favorite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jokeId: entry.id,
        text: entry.text,
        language: entry.language,
        category: entry.category,
        tags: entry.tags,
        createdAt: entry.createdAt,
      }),
    });
  } catch (error) {
    return null;
  }
}

export async function searchJokesServer() {
  throw new Error("Server-side search adapter is not configured yet.");
}
