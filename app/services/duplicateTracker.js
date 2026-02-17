const DEFAULT_SESSION_KEY = "vjc.feed.seen-joke-state.v2";
const DEFAULT_LOCAL_KEY = "vjc.feed.seen-joke-state.local.v1";
const MAX_TRACKED_IDS = 2800;
const MAX_TRACKED_FINGERPRINTS = 3200;

function getSessionStorageSafe() {
  try {
    return window.sessionStorage;
  } catch (error) {
    return null;
  }
}

function getLocalStorageSafe() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function parseStoredState(raw) {
  const fallback = {
    ids: [],
    fingerprints: [],
  };
  if (!raw || typeof raw !== "string") {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        ids: parsed,
        fingerprints: [],
      };
    }
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids : [],
      fingerprints: Array.isArray(parsed.fingerprints) ? parsed.fingerprints : [],
    };
  } catch (error) {
    return fallback;
  }
}

function saveStoredState(storage, storageKey, state) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({
        ids: Array.isArray(state?.ids) ? state.ids : [],
        fingerprints: Array.isArray(state?.fingerprints) ? state.fingerprints : [],
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    // Ignore storage errors to keep feed flowing.
  }
}

function normalizeId(value) {
  const text = String(value || "").trim();
  return text.slice(0, 160);
}

function normalizeFingerprint(value) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 380);
}

function resolveFingerprint(input) {
  if (typeof input === "string") {
    return normalizeFingerprint(input);
  }
  return normalizeFingerprint(input?.fingerprint || input?.text || "");
}

function loadStoredState(storage, storageKey) {
  if (!storage) {
    return {
      ids: [],
      fingerprints: [],
    };
  }
  const parsed = parseStoredState(storage.getItem(storageKey));
  return {
    ids: parsed.ids.map((item) => normalizeId(item)).filter(Boolean),
    fingerprints: parsed.fingerprints
      .map((entry) => normalizeFingerprint(entry))
      .filter(Boolean),
  };
}

function trimSet(setRef, maxSize) {
  while (setRef.size > maxSize) {
    const oldest = setRef.values().next().value;
    setRef.delete(oldest);
  }
}

function touchSet(setRef, value, maxSize) {
  if (!value) {
    return;
  }
  if (setRef.has(value)) {
    setRef.delete(value);
  }
  setRef.add(value);
  trimSet(setRef, maxSize);
}

function extractIdentity(input) {
  if (typeof input === "string") {
    return {
      id: normalizeId(input),
      fingerprint: "",
    };
  }
  return {
    id: normalizeId(input?.id),
    fingerprint: resolveFingerprint(input),
  };
}

export function createDuplicateTracker(options = {}) {
  const sessionKey = options.sessionKey || DEFAULT_SESSION_KEY;
  const localKey = options.localKey || DEFAULT_LOCAL_KEY;
  const persistenceAdapter =
    options.persistenceAdapter && typeof options.persistenceAdapter === "object"
      ? options.persistenceAdapter
      : null;
  const maxIds = Math.max(800, Number(options.maxIds) || MAX_TRACKED_IDS);
  const maxFingerprints = Math.max(
    1000,
    Number(options.maxFingerprints) || MAX_TRACKED_FINGERPRINTS
  );

  const sessionStorage = getSessionStorageSafe();
  const localStorage = getLocalStorageSafe();
  const sessionState = loadStoredState(sessionStorage, sessionKey);
  const localState = loadStoredState(localStorage, localKey);

  const seenIds = new Set([...sessionState.ids, ...localState.ids]);
  const seenFingerprints = new Set([
    ...sessionState.fingerprints,
    ...localState.fingerprints,
  ]);
  trimSet(seenIds, maxIds);
  trimSet(seenFingerprints, maxFingerprints);

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

  function persistState() {
    const state = {
      ids: Array.from(seenIds),
      fingerprints: Array.from(seenFingerprints),
    };
    saveStoredState(sessionStorage, sessionKey, state);
    saveStoredState(localStorage, localKey, state);
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
          touchSet(seenIds, normalized, maxIds);
        }
      }
      persistState();
    } catch (error) {
      // Ignore external hydration failures to avoid blocking feed rendering.
    }
  }

  function has(input) {
    const identity = extractIdentity(input);
    if (identity.id && seenIds.has(identity.id)) {
      return true;
    }
    if (identity.fingerprint && seenFingerprints.has(identity.fingerprint)) {
      return true;
    }
    return false;
  }

  function hasJoke(joke) {
    return has(joke);
  }

  function markDisplayed(input) {
    const identity = extractIdentity(input);
    if (!identity.id && !identity.fingerprint) {
      return false;
    }
    if (has(identity)) {
      return false;
    }
    touchSet(seenIds, identity.id, maxIds);
    touchSet(seenFingerprints, identity.fingerprint, maxFingerprints);
    persistState();
    persistForFutureSupport(Array.from(seenIds));
    return true;
  }

  function markDisplayedJoke(joke) {
    return markDisplayed(joke);
  }

  function reset() {
    seenIds.clear();
    seenFingerprints.clear();
    persistState();
  }

  function snapshot() {
    return Array.from(seenIds);
  }

  function snapshotFingerprints() {
    return Array.from(seenFingerprints);
  }

  return {
    has,
    hasJoke,
    markDisplayed,
    markDisplayedJoke,
    reset,
    snapshot,
    snapshotFingerprints,
    hydrateFromFutureStorage,
  };
}
