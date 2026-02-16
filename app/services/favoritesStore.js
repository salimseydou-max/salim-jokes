const DEFAULT_STORAGE_KEY = "vjc.favorite-jokes.v1";

function getLocalStorageSafe() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function parseEntries(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeFavoriteEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = String(entry.id || "").trim().slice(0, 160);
  if (!id) {
    return null;
  }
  return {
    id,
    text: String(entry.text || "").trim().slice(0, 1200),
    source: String(entry.source || "").trim().slice(0, 80),
    sourceType: String(entry.sourceType || entry.source || "").trim().slice(0, 40),
    category: String(entry.category || "random").trim().slice(0, 40).toLowerCase() || "random",
    language: String(entry.language || "en").trim().slice(0, 12).toLowerCase() || "en",
    tags: Array.isArray(entry.tags)
      ? entry.tags
          .map((tag) => String(tag || "").trim().toLowerCase().slice(0, 80))
          .filter(Boolean)
      : [],
    createdAt:
      typeof entry.createdAt === "string" && entry.createdAt
        ? entry.createdAt
        : new Date().toISOString(),
    savedAt:
      typeof entry.savedAt === "string" && entry.savedAt
        ? entry.savedAt
        : new Date().toISOString(),
  };
}

export function createFavoritesStore(options = {}) {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const storage = getLocalStorageSafe();
  const entries = new Map();

  if (storage) {
    const initialEntries = parseEntries(storage.getItem(storageKey))
      .map((item) => normalizeFavoriteEntry(item))
      .filter(Boolean);
    for (let i = 0; i < initialEntries.length; i += 1) {
      entries.set(initialEntries[i].id, initialEntries[i]);
    }
  }

  function persist() {
    if (!storage) {
      return;
    }
    try {
      storage.setItem(storageKey, JSON.stringify(Array.from(entries.values())));
    } catch (error) {
      // Storage quota failures should not block UI usage.
    }
  }

  function has(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      return false;
    }
    return entries.has(normalizedId);
  }

  function toggle(joke) {
    const entry = normalizeFavoriteEntry(joke);
    if (!entry) {
      return { saved: false, entry: null };
    }
    if (entries.has(entry.id)) {
      entries.delete(entry.id);
      persist();
      return { saved: false, entry };
    }
    entries.set(entry.id, entry);
    persist();
    return { saved: true, entry };
  }

  function list() {
    return Array.from(entries.values())
      .slice()
      .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  }

  return {
    has,
    toggle,
    list,
  };
}
