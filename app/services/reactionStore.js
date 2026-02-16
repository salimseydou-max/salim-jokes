import { readStorageValue, writeStorageValue } from "./storage.js";

export const REACTION_TYPES = Object.freeze(["👍", "😂", "❤️", "😮", "😢", "🔥"]);
const STORAGE_KEY = "vjc.reactions.v1";

function sanitizeId(value) {
  return String(value || "").trim().slice(0, 180);
}

function normalizeCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function createEmptyCounts() {
  const counts = {};
  for (let i = 0; i < REACTION_TYPES.length; i += 1) {
    counts[REACTION_TYPES[i]] = 0;
  }
  return counts;
}

function deterministicSeedFromId(id = "") {
  let hash = 0;
  const normalized = String(id || "");
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createInitialCounts(joke) {
  const counts = createEmptyCounts();
  const popularity = Math.max(0, Number(joke?.popularity) || 0);
  const base = Math.min(16, Math.floor(popularity / 2));
  const seed = deterministicSeedFromId(joke?.id || "");
  for (let i = 0; i < base; i += 1) {
    const emoji = REACTION_TYPES[(seed + i) % REACTION_TYPES.length];
    counts[emoji] += 1;
  }
  return counts;
}

function normalizeEntry(rawEntry = {}) {
  const counts = createEmptyCounts();
  const rawCounts = rawEntry?.counts && typeof rawEntry.counts === "object" ? rawEntry.counts : {};
  for (let i = 0; i < REACTION_TYPES.length; i += 1) {
    const emoji = REACTION_TYPES[i];
    counts[emoji] = normalizeCount(rawCounts[emoji]);
  }
  const byUser = {};
  const rawByUser = rawEntry?.byUser && typeof rawEntry.byUser === "object" ? rawEntry.byUser : {};
  Object.keys(rawByUser).forEach((userId) => {
    const safeUserId = sanitizeId(userId);
    const reaction = rawByUser[userId];
    if (safeUserId && REACTION_TYPES.includes(reaction)) {
      byUser[safeUserId] = reaction;
    }
  });
  const joke = rawEntry?.joke && typeof rawEntry.joke === "object" ? rawEntry.joke : {};
  return {
    counts,
    byUser,
    joke: {
      id: sanitizeId(joke.id || ""),
      text: String(joke.text || "").trim().slice(0, 1400),
      source: String(joke.source || "").trim().slice(0, 80),
      category: String(joke.category || "").trim().slice(0, 40),
      createdAt: String(joke.createdAt || "").trim().slice(0, 80),
    },
  };
}

function normalizeState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const byJoke = {};
  Object.keys(state.byJoke || {}).forEach((jokeId) => {
    const safeId = sanitizeId(jokeId);
    if (!safeId) {
      return;
    }
    byJoke[safeId] = normalizeEntry(state.byJoke[jokeId]);
  });
  return { byJoke };
}

export function createReactionStore(options = {}) {
  const storageKey = options.storageKey || STORAGE_KEY;
  const runtime = normalizeState(readStorageValue(storageKey, {}, "local"));

  function persist() {
    writeStorageValue(storageKey, runtime, "local");
  }

  function ensureEntry(joke) {
    const jokeId = sanitizeId(joke?.id);
    if (!jokeId) {
      return null;
    }
    if (!runtime.byJoke[jokeId]) {
      runtime.byJoke[jokeId] = {
        counts: createInitialCounts(joke),
        byUser: {},
        joke: {
          id: jokeId,
          text: String(joke?.text || "").trim().slice(0, 1400),
          source: String(joke?.source || "").trim().slice(0, 80),
          category: String(joke?.category || "").trim().slice(0, 40),
          createdAt: String(joke?.createdAt || "").trim().slice(0, 80) || new Date().toISOString(),
        },
      };
    } else {
      const entry = runtime.byJoke[jokeId];
      if (!entry.joke.text && joke?.text) {
        entry.joke.text = String(joke.text).trim().slice(0, 1400);
      }
      if (!entry.joke.source && joke?.source) {
        entry.joke.source = String(joke.source).trim().slice(0, 80);
      }
      if (!entry.joke.category && joke?.category) {
        entry.joke.category = String(joke.category).trim().slice(0, 40);
      }
    }
    return runtime.byJoke[jokeId];
  }

  function getCounts(joke) {
    const entry = ensureEntry(joke);
    if (!entry) {
      return createEmptyCounts();
    }
    return { ...entry.counts };
  }

  function getUserReaction(jokeId, userId) {
    const safeJokeId = sanitizeId(jokeId);
    const safeUserId = sanitizeId(userId);
    if (!safeJokeId || !safeUserId) {
      return "";
    }
    return runtime.byJoke[safeJokeId]?.byUser?.[safeUserId] || "";
  }

  function react(joke, userId, reaction) {
    const safeUserId = sanitizeId(userId);
    const selectedReaction = REACTION_TYPES.includes(reaction) ? reaction : "";
    const entry = ensureEntry(joke);
    if (!entry || !safeUserId) {
      return {
        counts: createEmptyCounts(),
        userReaction: "",
      };
    }

    const previous = entry.byUser[safeUserId] || "";
    if (previous && entry.counts[previous] > 0) {
      entry.counts[previous] -= 1;
    }
    if (selectedReaction && previous !== selectedReaction) {
      entry.counts[selectedReaction] += 1;
      entry.byUser[safeUserId] = selectedReaction;
    } else if (previous === selectedReaction) {
      delete entry.byUser[safeUserId];
    } else {
      delete entry.byUser[safeUserId];
    }
    persist();
    return {
      counts: { ...entry.counts },
      userReaction: entry.byUser[safeUserId] || "",
    };
  }

  function listUserHistory(userId) {
    const safeUserId = sanitizeId(userId);
    if (!safeUserId) {
      return [];
    }
    const history = [];
    Object.keys(runtime.byJoke).forEach((jokeId) => {
      const entry = runtime.byJoke[jokeId];
      const reaction = entry?.byUser?.[safeUserId];
      if (!reaction) {
        return;
      }
      history.push({
        jokeId,
        reaction,
        joke: {
          ...entry.joke,
        },
      });
    });
    return history;
  }

  return {
    getCounts,
    getUserReaction,
    react,
    listUserHistory,
    reactionTypes: REACTION_TYPES.slice(),
  };
}
