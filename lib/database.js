import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createSafeDatabaseError,
  ensureDatabaseConfig,
  getDatabaseAuthHeaders,
} from "../config/database.js";

const REMOTE_TIMEOUT_MS = 8000;

const runtime =
  globalThis.__JOKES_DB_RUNTIME__ ||
  {
    queryCache: new Map(),
    localStates: new Map(),
    loadingStates: new Map(),
    writeLocks: new Map(),
  };

if (!globalThis.__JOKES_DB_RUNTIME__) {
  globalThis.__JOKES_DB_RUNTIME__ = runtime;
}

function createEmptyState() {
  return {
    jokes: [],
    favorites: [],
    views: [],
    users: [],
  };
}

function sanitizeText(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizeLanguage(value) {
  const normalized = sanitizeText(value).toLowerCase();
  return normalized || "en";
}

function sanitizeCategory(value) {
  const normalized = sanitizeText(value).toLowerCase();
  return normalized || "random";
}

function sanitizeFilterValue(value) {
  return sanitizeText(value).toLowerCase();
}

function sanitizeId(value, maxLength = 120) {
  if (!value) {
    return "";
  }
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9_\-:.]/g, "");
  return normalized.slice(0, maxLength);
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) {
    if (!tags) {
      return [];
    }
    const normalized = sanitizeText(tags);
    return normalized ? [normalized] : [];
  }
  const seen = new Set();
  const output = [];
  for (let i = 0; i < tags.length; i += 1) {
    const normalized = sanitizeText(tags[i]);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizeState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return createEmptyState();
  }
  return {
    jokes: Array.isArray(rawState.jokes) ? rawState.jokes : [],
    favorites: Array.isArray(rawState.favorites) ? rawState.favorites : [],
    views: Array.isArray(rawState.views) ? rawState.views : [],
    users: Array.isArray(rawState.users) ? rawState.users : [],
  };
}

async function loadStateFromDisk(storageFile) {
  try {
    const raw = await readFile(storageFile, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return createEmptyState();
    }
    console.error("Failed reading local database file:", error);
    return createEmptyState();
  }
}

async function getLocalState(config) {
  if (runtime.localStates.has(config.storageFile)) {
    return runtime.localStates.get(config.storageFile);
  }
  if (runtime.loadingStates.has(config.storageFile)) {
    return runtime.loadingStates.get(config.storageFile);
  }

  const loadPromise = loadStateFromDisk(config.storageFile).then((state) => {
    runtime.localStates.set(config.storageFile, state);
    runtime.loadingStates.delete(config.storageFile);
    return state;
  });

  runtime.loadingStates.set(config.storageFile, loadPromise);
  return loadPromise;
}

async function saveStateToDisk(config, state) {
  const task = async () => {
    await mkdir(dirname(config.storageFile), { recursive: true });
    await writeFile(config.storageFile, JSON.stringify(state), "utf8");
  };

  const previous = runtime.writeLocks.get(config.storageFile) || Promise.resolve();
  const current = previous.then(task);
  runtime.writeLocks.set(
    config.storageFile,
    current.catch(() => {
      // Keep lock chain alive even after an error.
    })
  );
  await current;
}

function getQueryParamValue(value, fallback = "") {
  if (Array.isArray(value)) {
    return value.length ? value[0] : fallback;
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  return value;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toNonNegativeInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeFilters(filters, config) {
  const language = sanitizeFilterValue(
    getQueryParamValue(filters.language || filters.lang || "")
  );
  const category = sanitizeFilterValue(getQueryParamValue(filters.category || ""));
  const requestedSort = sanitizeText(getQueryParamValue(filters.sort || "")).toLowerCase();
  const sort =
    requestedSort === "popularity" || requestedSort === "newest"
      ? requestedSort
      : filters.popularity
        ? "popularity"
        : "newest";

  const limit = Math.min(
    toPositiveInt(
      getQueryParamValue(filters.limit, config.defaultQueryLimit),
      config.defaultQueryLimit
    ),
    config.maxQueryLimit
  );

  const offset = toNonNegativeInt(getQueryParamValue(filters.offset, 0), 0);

  return {
    language: language === "all" ? "" : language,
    category: category === "all" ? "" : category,
    sort,
    limit,
    offset,
  };
}

function makeCacheKey(filters) {
  return JSON.stringify(filters);
}

function getFromCache(cacheKey) {
  const entry = runtime.queryCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    runtime.queryCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function saveToCache(cacheKey, value, ttlMs) {
  runtime.queryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function clearJokesCache() {
  runtime.queryCache.clear();
}

function computePopularity(item) {
  const views = Number(item.viewCount) || 0;
  const favorites = Number(item.favoriteCount) || 0;
  const engagement = Number(item.engagementCount) || 0;
  return views + favorites * 3 + engagement;
}

function sortNewest(list) {
  return list.sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "") || 0;
    const bTime = Date.parse(b.createdAt || "") || 0;
    return bTime - aTime;
  });
}

function sortPopularity(list) {
  return list.sort((a, b) => {
    const scoreA = computePopularity(a);
    const scoreB = computePopularity(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    const aTime = Date.parse(a.createdAt || "") || 0;
    const bTime = Date.parse(b.createdAt || "") || 0;
    return bTime - aTime;
  });
}

function makeJokeRecord(jokeData, existingIds) {
  const text = sanitizeText(jokeData.text || jokeData.joke || "");
  if (!text) {
    throw createSafeDatabaseError("Joke text is required", 400);
  }

  const requestedId = sanitizeId(jokeData.id || "");
  if (requestedId && existingIds.has(requestedId)) {
    throw createSafeDatabaseError("Duplicate joke id", 409);
  }

  let generatedId = requestedId;
  while (!generatedId) {
    generatedId = `joke_${Date.now()}_${randomUUID().slice(0, 8)}`;
    if (existingIds.has(generatedId)) {
      generatedId = "";
    }
  }

  return {
    id: generatedId,
    text,
    language: sanitizeLanguage(jokeData.language || jokeData.lang || "en"),
    category: sanitizeCategory(jokeData.category || "random"),
    tags: sanitizeTags(jokeData.tags),
    createdAt: sanitizeText(jokeData.createdAt) || new Date().toISOString(),
    viewCount: 0,
    favoriteCount: 0,
    engagementCount: 0,
  };
}

function upsertJokeForInteraction(state, jokeId, jokeData = {}) {
  const safeJokeId = sanitizeId(jokeId, 120);
  if (!safeJokeId) {
    return null;
  }
  let joke = state.jokes.find((item) => item.id === safeJokeId);
  if (joke) {
    return joke;
  }
  joke = {
    id: safeJokeId,
    text: sanitizeText(jokeData.text || jokeData.joke || "Tracked joke"),
    language: sanitizeLanguage(jokeData.language || jokeData.lang || "en"),
    category: sanitizeCategory(jokeData.category || "random"),
    tags: sanitizeTags(jokeData.tags),
    createdAt: sanitizeText(jokeData.createdAt) || new Date().toISOString(),
    viewCount: 0,
    favoriteCount: 0,
    engagementCount: 0,
  };
  state.jokes.push(joke);
  return joke;
}

function touchUser(state, userId) {
  const safeUserId = sanitizeId(userId, 80);
  if (!safeUserId) {
    return;
  }
  let user = state.users.find((entry) => entry.id === safeUserId);
  if (!user) {
    user = {
      id: safeUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.users.push(user);
    return;
  }
  user.updatedAt = new Date().toISOString();
}

async function requestRemote(config, path, options = {}) {
  const targetUrl = `${config.apiUrl}${path}`;
  const headers = getDatabaseAuthHeaders({
    "Content-Type": "application/json",
    ...(options.headers || {}),
  });
  const response = await fetch(targetUrl, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw createSafeDatabaseError("Database request failed", 503);
  }

  try {
    return await response.json();
  } catch (error) {
    throw createSafeDatabaseError("Database request failed", 503);
  }
}

function toPublicJoke(joke) {
  const language = sanitizeLanguage(joke.language || joke.lang || "en");
  const category = sanitizeCategory(joke.category || "random");
  return {
    id: joke.id,
    text: sanitizeText(joke.text || joke.joke || ""),
    language,
    category,
    tags: Array.isArray(joke.tags) ? joke.tags : [],
    createdAt: joke.createdAt,
    viewCount: Number(joke.viewCount) || 0,
    favoriteCount: Number(joke.favoriteCount) || 0,
    popularity: computePopularity(joke),
  };
}

export async function saveJoke(jokeData = {}) {
  const config = ensureDatabaseConfig();

  if (config.apiUrl) {
    const payload = await requestRemote(config, "/jokes/save", {
      method: "POST",
      body: jokeData,
    });
    clearJokesCache();
    return payload?.joke || payload;
  }

  const state = await getLocalState(config);
  const existingIds = new Set(state.jokes.map((item) => item.id));
  const record = makeJokeRecord(jokeData, existingIds);
  state.jokes.push(record);
  await saveStateToDisk(config, state);
  clearJokesCache();
  return toPublicJoke(record);
}

export async function getJokes(filters = {}) {
  const config = ensureDatabaseConfig();
  const normalizedFilters = normalizeFilters(filters, config);
  const cacheKey = makeCacheKey(normalizedFilters);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  if (config.apiUrl) {
    const params = new URLSearchParams();
    if (normalizedFilters.language) {
      params.set("language", normalizedFilters.language);
    }
    if (normalizedFilters.category) {
      params.set("category", normalizedFilters.category);
    }
    params.set("sort", normalizedFilters.sort);
    params.set("limit", String(normalizedFilters.limit));
    params.set("offset", String(normalizedFilters.offset));
    const payload = await requestRemote(config, `/jokes?${params.toString()}`, {
      method: "GET",
    });
    const result = {
      jokes: Array.isArray(payload?.jokes) ? payload.jokes : [],
      total: Number(payload?.total) || 0,
      filters: normalizedFilters,
    };
    saveToCache(cacheKey, result, config.cacheTtlMs);
    return { ...result, cached: false };
  }

  const state = await getLocalState(config);
  let list = state.jokes.slice();
  if (normalizedFilters.language) {
    list = list.filter(
      (item) => sanitizeFilterValue(item.language || item.lang || "") === normalizedFilters.language
    );
  }
  if (normalizedFilters.category) {
    list = list.filter(
      (item) => sanitizeFilterValue(item.category || "") === normalizedFilters.category
    );
  }

  if (normalizedFilters.sort === "popularity") {
    sortPopularity(list);
  } else {
    sortNewest(list);
  }

  const total = list.length;
  const paged = list.slice(
    normalizedFilters.offset,
    normalizedFilters.offset + normalizedFilters.limit
  );

  const result = {
    jokes: paged.map(toPublicJoke),
    total,
    filters: normalizedFilters,
  };
  saveToCache(cacheKey, result, config.cacheTtlMs);
  return { ...result, cached: false };
}

export async function saveUserFavorite(userId, jokeId, jokeData = {}) {
  const config = ensureDatabaseConfig();
  const safeUserId = sanitizeId(userId, 80);
  const safeJokeId = sanitizeId(jokeId, 120);

  if (!safeUserId || !safeJokeId) {
    throw createSafeDatabaseError("Missing favorite data", 400);
  }

  if (config.apiUrl) {
    const payload = await requestRemote(config, "/jokes/favorite", {
      method: "POST",
      body: { userId: safeUserId, jokeId: safeJokeId, jokeData },
    });
    clearJokesCache();
    return payload;
  }

  const state = await getLocalState(config);
  const joke = upsertJokeForInteraction(state, safeJokeId, jokeData);
  if (!joke) {
    throw createSafeDatabaseError("Joke not found", 404);
  }

  const existing = state.favorites.find(
    (item) => item.userId === safeUserId && item.jokeId === safeJokeId
  );
  if (existing) {
    return {
      favoriteId: existing.id,
      userId: safeUserId,
      jokeId: safeJokeId,
      alreadyFavorited: true,
      favoriteCount: Number(joke.favoriteCount) || 0,
    };
  }

  const favorite = {
    id: `fav_${Date.now()}_${randomUUID().slice(0, 8)}`,
    userId: safeUserId,
    jokeId: safeJokeId,
    createdAt: new Date().toISOString(),
  };

  state.favorites.push(favorite);
  joke.favoriteCount = (Number(joke.favoriteCount) || 0) + 1;
  joke.engagementCount = (Number(joke.engagementCount) || 0) + 1;
  touchUser(state, safeUserId);
  await saveStateToDisk(config, state);
  clearJokesCache();

  return {
    favoriteId: favorite.id,
    userId: safeUserId,
    jokeId: safeJokeId,
    alreadyFavorited: false,
    favoriteCount: joke.favoriteCount,
  };
}

export async function trackJokeView(jokeId, userId = "", jokeData = {}) {
  const config = ensureDatabaseConfig();
  const safeJokeId = sanitizeId(jokeId, 120);
  const safeUserId = sanitizeId(userId, 80);

  if (!safeJokeId) {
    throw createSafeDatabaseError("Missing tracking data", 400);
  }

  if (config.apiUrl) {
    const payload = await requestRemote(config, "/jokes/track", {
      method: "POST",
      body: {
        jokeId: safeJokeId,
        userId: safeUserId || undefined,
        jokeData,
      },
    });
    clearJokesCache();
    return payload;
  }

  const state = await getLocalState(config);
  const joke = upsertJokeForInteraction(state, safeJokeId, jokeData);
  if (!joke) {
    throw createSafeDatabaseError("Joke not found", 404);
  }

  const view = {
    id: `view_${Date.now()}_${randomUUID().slice(0, 8)}`,
    jokeId: safeJokeId,
    userId: safeUserId || null,
    createdAt: new Date().toISOString(),
  };

  state.views.push(view);
  joke.viewCount = (Number(joke.viewCount) || 0) + 1;
  joke.engagementCount = (Number(joke.engagementCount) || 0) + 1;
  touchUser(state, safeUserId);
  await saveStateToDisk(config, state);
  clearJokesCache();

  return {
    trackingId: view.id,
    jokeId: safeJokeId,
    viewCount: joke.viewCount,
  };
}

export function toSafeRouteError(error) {
  const statusCode = Number(error?.statusCode);
  const status =
    Number.isFinite(statusCode) && statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;

  return {
    status,
    body: {
      error: status >= 500 ? "Database request failed" : error?.message || "Request failed",
    },
  };
}
