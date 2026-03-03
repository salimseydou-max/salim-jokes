import {
  fetchExternalRandomJoke,
  fetchRandomJokes,
  fetchRecentJokes,
  fetchTrendingJokes,
  fetchUserSubmittedJokes,
  generateAiJokes,
  normalizeFeedItem,
} from "./jokesApi.js";

const SOURCE_ORDER = Object.freeze(["recent", "ai", "trending", "user", "random", "recent", "random", "ai"]);
const SOURCE_NAMES = Object.freeze(["ai", "user", "trending", "recent", "random"]);
const SOURCE_RETRY_BACKOFF_MS = 1400;
const EMERGENCY_LOCAL_JOKES = Object.freeze([
  "I asked my keyboard for advice. It said, \"Space things out and keep it simple.\"",
  "My to-do list and I had a meeting. We agreed to start with one task and one snack.",
  "I told my alarm I needed motivation. It replied, \"I already scream for you every morning.\"",
  "I cleaned my desk for productivity and found three pens, two chargers, and zero discipline.",
  "My browser had twenty tabs open for one job. Technically, that is called team work.",
]);

function sanitizeId(value) {
  return String(value || "").trim();
}

function makeHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function makeTextFingerprint(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

function shuffle(list = []) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function createFeedComposer(options = {}) {
  const language = String(options.language || "en").trim() || "en";
  const category = String(options.category || "random").trim() || "random";

  const sourceState = {
    ai: { queue: [], offset: 0, hasMore: true, loading: null, lastErrorAt: 0 },
    user: { queue: [], offset: 0, hasMore: true, loading: null, lastErrorAt: 0 },
    trending: { queue: [], offset: 0, hasMore: true, loading: null, lastErrorAt: 0 },
    recent: { queue: [], offset: 0, hasMore: true, loading: null, lastErrorAt: 0 },
    random: { queue: [], offset: 0, hasMore: true, loading: null, lastErrorAt: 0 },
  };

  const catalogById = new Map();
  let pointer = 0;

  function getItemFingerprint(item) {
    if (!item) {
      return "";
    }
    const language = String(item.language || "").trim().toLowerCase();
    return makeTextFingerprint(`${language}|${item.text || ""}`);
  }

  function addToCatalog(jokes = []) {
    for (let i = 0; i < jokes.length; i += 1) {
      const item = jokes[i];
      const normalized = normalizeFeedItem(item, item?.sourceType || item?.source || "random");
      if (!normalized || !normalized.id) {
        continue;
      }
      if (!catalogById.has(normalized.id)) {
        catalogById.set(normalized.id, normalized);
      }
    }
  }

  function enqueueSource(sourceName, jokes = []) {
    const state = sourceState[sourceName];
    if (!state) {
      return;
    }
    const deduped = [];
    const localQueueIds = new Set(state.queue.map((item) => sanitizeId(item?.id)));
    const localQueueFingerprints = new Set(
      state.queue
        .map((item) => getItemFingerprint(item))
        .filter(Boolean)
    );
    for (let i = 0; i < jokes.length; i += 1) {
      const item = normalizeFeedItem(jokes[i], sourceName);
      const jokeId = sanitizeId(item?.id);
      const fingerprint = getItemFingerprint(item);
      if (!item || !jokeId) {
        continue;
      }
      if (localQueueIds.has(jokeId)) {
        continue;
      }
      if (fingerprint && localQueueFingerprints.has(fingerprint)) {
        continue;
      }
      localQueueIds.add(jokeId);
      if (fingerprint) {
        localQueueFingerprints.add(fingerprint);
      }
      deduped.push({ ...item, sourceType: sourceName });
    }
    if (deduped.length) {
      state.queue.push(...shuffle(deduped));
      addToCatalog(deduped);
    }
  }

  function getEmergencyLocalJokes(targetCount = 2) {
    const max = Math.max(1, Math.min(8, Number(targetCount) || 2));
    const startIndex = pointer % EMERGENCY_LOCAL_JOKES.length;
    const now = new Date().toISOString();
    const output = [];
    for (let i = 0; i < max; i += 1) {
      const text = EMERGENCY_LOCAL_JOKES[(startIndex + i) % EMERGENCY_LOCAL_JOKES.length];
      const base = `${language}|${category}|${text}`;
      const id = `local_${makeHash(base)}`;
      output.push(
        normalizeFeedItem(
          {
            id,
            text,
            source: "local_fallback",
            sourceType: "random",
            language,
            category,
            createdAt: now,
            tags: ["local-fallback"],
          },
          "random"
        )
      );
    }
    return output.filter(Boolean);
  }

  async function fetchSourceBatch(sourceName) {
    if (sourceName === "ai") {
      const jokes = await generateAiJokes(4);
      return { jokes, hasMore: true };
    }
    if (sourceName === "random") {
      return fetchRandomJokes({
        limit: 16,
        offset: sourceState.random.offset,
        language,
        category,
      });
    }
    if (sourceName === "recent") {
      return fetchRecentJokes({
        limit: 16,
        offset: sourceState.recent.offset,
        language,
      });
    }
    if (sourceName === "trending") {
      return fetchTrendingJokes({
        limit: 16,
        offset: sourceState.trending.offset,
        language,
      });
    }
    if (sourceName === "user") {
      return fetchUserSubmittedJokes({
        limit: 14,
        offset: sourceState.user.offset,
        language,
      });
    }
    return { jokes: [], total: 0, hasMore: false };
  }

  async function ensureSourceBuffer(sourceName, minCount = 4) {
    const state = sourceState[sourceName];
    if (!state) {
      return;
    }
    if (state.queue.length >= minCount) {
      return;
    }
    if (state.lastErrorAt && Date.now() - state.lastErrorAt < SOURCE_RETRY_BACKOFF_MS) {
      return;
    }
    if (state.loading) {
      await state.loading;
      return;
    }
    state.loading = (async () => {
      try {
        const result = await fetchSourceBatch(sourceName);
        const jokes = Array.isArray(result?.jokes) ? result.jokes : [];
        enqueueSource(sourceName, jokes);
        if (sourceName !== "ai") {
          const consumed = Math.max(0, jokes.length);
          state.offset += consumed;
          if (sourceName === "user" && jokes.length < 6) {
            state.hasMore = false;
          }
          if (sourceName === "random") {
            state.hasMore = Boolean(result?.hasMore) || jokes.length >= 8;
          } else if (typeof result?.total === "number") {
            state.hasMore = state.offset < result.total;
          }
        }
        state.lastErrorAt = 0;
      } catch (error) {
        state.lastErrorAt = Date.now();
      } finally {
        state.loading = null;
      }
    })();
    await state.loading;
  }

  async function prime() {
    await Promise.all(SOURCE_NAMES.map((sourceName) => ensureSourceBuffer(sourceName, 6)));
  }

  function nextSourceName() {
    const sourceName = SOURCE_ORDER[pointer % SOURCE_ORDER.length];
    pointer += 1;
    return sourceName;
  }

  async function nextBatch(batchSize = 6, isSeenFn = () => false) {
    const target = Math.max(1, Math.min(12, Number(batchSize) || 6));
    const output = [];
    const batchFingerprints = new Set();
    await Promise.all(SOURCE_NAMES.map((sourceName) => ensureSourceBuffer(sourceName, 4)));

    let attempts = 0;
    const maxAttempts = target * 30;
    while (output.length < target && attempts < maxAttempts) {
      attempts += 1;
      const sourceName = nextSourceName();
      const state = sourceState[sourceName];
      if (!state) {
        continue;
      }
      if (!state.queue.length) {
        await ensureSourceBuffer(sourceName, 1);
      }
      const next = state.queue.shift();
      if (!next || !next.id) {
        continue;
      }
      if (isSeenFn(next.id, next)) {
        continue;
      }
      const fingerprint = getItemFingerprint(next);
      if (fingerprint && batchFingerprints.has(fingerprint)) {
        continue;
      }
      output.push(next);
      if (fingerprint) {
        batchFingerprints.add(fingerprint);
      }
      if (state.queue.length < 3 && state.hasMore !== false) {
        ensureSourceBuffer(sourceName, 6);
      }
    }

    let fallbackAttempts = 0;
    while (output.length < target && fallbackAttempts < 5) {
      fallbackAttempts += 1;
      try {
        const external = await fetchExternalRandomJoke({ language, category });
        if (!external) {
          continue;
        }
        if (isSeenFn(external.id, external)) {
          continue;
        }
        const externalFingerprint = getItemFingerprint(external);
        if (externalFingerprint && batchFingerprints.has(externalFingerprint)) {
          continue;
        }
        output.push({ ...external, sourceType: "random" });
        if (externalFingerprint) {
          batchFingerprints.add(externalFingerprint);
        }
        addToCatalog([external]);
      } catch (error) {
        // Keep feed resilient if fallback source is unavailable.
      }
    }

    if (output.length < target) {
      const emergency = getEmergencyLocalJokes(target * 2);
      for (let i = 0; i < emergency.length && output.length < target; i += 1) {
        const candidate = emergency[i];
        if (!candidate?.id || isSeenFn(candidate.id, candidate)) {
          continue;
        }
        const fingerprint = getItemFingerprint(candidate);
        if (fingerprint && batchFingerprints.has(fingerprint)) {
          continue;
        }
        output.push({ ...candidate, sourceType: "random" });
        if (fingerprint) {
          batchFingerprints.add(fingerprint);
        }
      }
      addToCatalog(emergency);
    }

    return output.slice(0, target);
  }

  function injectUserJoke(joke) {
    const normalized = normalizeFeedItem(joke, "user");
    if (!normalized) {
      return;
    }
    enqueueSource("user", [{ ...normalized, tags: [...normalized.tags, "user-submitted"] }]);
  }

  function getCatalogSnapshot() {
    return Array.from(catalogById.values());
  }

  return {
    prime,
    nextBatch,
    injectUserJoke,
    getCatalogSnapshot,
    addToCatalog,
  };
}
