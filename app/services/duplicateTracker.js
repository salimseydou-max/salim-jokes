const DEFAULT_SESSION_KEY = "vjc.feed.seen-joke-ids.v1";

function getSessionStorageSafe() {
  try {
    return window.sessionStorage;
  } catch (error) {
    return null;
  }
}

function parseStoredIds(raw) {
  if (!raw || typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveStoredIds(storageKey, ids) {
  const storage = getSessionStorageSafe();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(storageKey, JSON.stringify(ids));
  } catch (error) {
    // Ignore storage errors to keep feed flowing.
  }
}

function normalizeId(value) {
  const text = String(value || "").trim();
  return text.slice(0, 160);
}

function loadSessionIds(storageKey) {
  const storage = getSessionStorageSafe();
  if (!storage) {
    return [];
  }
  return parseStoredIds(storage.getItem(storageKey))
    .map((item) => normalizeId(item))
    .filter(Boolean);
}

export function createDuplicateTracker(options = {}) {
  const sessionKey = options.sessionKey || DEFAULT_SESSION_KEY;
  const persistenceAdapter =
    options.persistenceAdapter && typeof options.persistenceAdapter === "object"
      ? options.persistenceAdapter
      : null;

  const seenIds = new Set(loadSessionIds(sessionKey));

  async function persistForFutureSupport(nextIds) {
    if (!persistenceAdapter || typeof persistenceAdapter.save !== "function") {
      return;
    }
    try {
      await persistenceAdapter.save(nextIds);
    } catch (error) {
      // Keep duplicate tracking resilient if external persistence fails.
    }
  }

  function persistSession() {
    saveStoredIds(sessionKey, Array.from(seenIds));
  }

  async function hydrateFromFutureStorage() {
    if (!persistenceAdapter || typeof persistenceAdapter.load !== "function") {
      return;
    }
    try {
      const externalIds = await persistenceAdapter.load();
      if (!Array.isArray(externalIds)) {
        return;
      }
      for (let i = 0; i < externalIds.length; i += 1) {
        const normalized = normalizeId(externalIds[i]);
        if (normalized) {
          seenIds.add(normalized);
        }
      }
      persistSession();
    } catch (error) {
      // Ignore external hydration failures to avoid blocking feed rendering.
    }
  }

  function has(id) {
    const normalized = normalizeId(id);
    if (!normalized) {
      return false;
    }
    return seenIds.has(normalized);
  }

  function markDisplayed(id) {
    const normalized = normalizeId(id);
    if (!normalized) {
      return false;
    }
    if (seenIds.has(normalized)) {
      return false;
    }
    seenIds.add(normalized);
    persistSession();
    persistForFutureSupport(Array.from(seenIds));
    return true;
  }

  function reset() {
    seenIds.clear();
    persistSession();
  }

  function snapshot() {
    return Array.from(seenIds);
  }

  return {
    has,
    markDisplayed,
    reset,
    snapshot,
    hydrateFromFutureStorage,
  };
}
