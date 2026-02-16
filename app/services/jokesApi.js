function sanitizeText(value, maxLength = 1200) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function normalizeFeedItem(input = {}) {
  const id = sanitizeText(input.id || "");
  const text = sanitizeText(input.text || input.joke || "");
  if (!id || !text) {
    return null;
  }
  return {
    id,
    text,
    source: sanitizeText(input.source || "feed", 80).toLowerCase() || "feed",
    category: sanitizeText(input.category || "random", 40).toLowerCase() || "random",
    language: sanitizeText(input.language || input.lang || "en", 12).toLowerCase() || "en",
    createdAt: sanitizeText(input.createdAt || "", 80) || new Date().toISOString(),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchFeedPage(options = {}) {
  const params = new URLSearchParams();
  params.set("source", "feed");
  params.set("lang", sanitizeText(options.lang || "en", 8) || "en");
  params.set("category", sanitizeText(options.category || "random", 20) || "random");
  params.set("limit", String(Math.max(1, Math.floor(Number(options.limit) || 8))));
  params.set("offset", String(Math.max(0, Math.floor(Number(options.offset) || 0))));
  params.set("includePremium", String(Boolean(options.includePremium)));

  const payload = await requestJson(`/api/jokes?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
  });

  const jokes = Array.isArray(payload?.jokes)
    ? payload.jokes.map((item) => normalizeFeedItem(item)).filter(Boolean)
    : [];

  return {
    jokes,
    hasMore: Boolean(payload?.hasMore),
    total: Number(payload?.total) || jokes.length,
  };
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
  return normalizeFeedItem({
    id: createGeneratedId(text),
    text,
    source: payload?.fallback ? "fallback_ai" : "ai",
    category: "random",
    language: "en",
    createdAt: new Date().toISOString(),
  });
}

export async function submitJoke(input = {}) {
  const text = sanitizeText(input.text || input.joke || "");
  if (!text) {
    throw new Error("Please enter a joke first.");
  }
  return requestJson("/api/jokes/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      language: sanitizeText(input.language || "en", 8) || "en",
      category: sanitizeText(input.category || "random", 20) || "random",
      tags: Array.isArray(input.tags) ? input.tags : ["user-submitted"],
      createdAt: new Date().toISOString(),
    }),
  });
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
        createdAt: normalized.createdAt,
      }),
    });
  } catch (error) {
    return null;
  }
}
