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

function sanitizeId(value) {
  return String(value || "").trim();
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
    ai: { queue: [], offset: 0, hasMore: true, loading: null },
    user: { queue: [], offset: 0, hasMore: true, loading: null },
    trending: { queue: [], offset: 0, hasMore: true, loading: null },
    recent: { queue: [], offset: 0, hasMore: true, loading: null },
    random: { queue: [], offset: 0, hasMore: true, loading: null },
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
      } catch (error) {
        state.hasMore = sourceName === "ai" ? true : false;
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
