function getStorageByType(type = "local") {
  try {
    if (type === "session") {
      return window.sessionStorage;
    }
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

export function readStorageValue(key, fallback, type = "local") {
  const storage = getStorageByType(type);
  if (!storage || !key) {
    return fallback;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return parsed === undefined ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
}

export function writeStorageValue(key, value, type = "local") {
  const storage = getStorageByType(type);
  if (!storage || !key) {
    return false;
  }
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function removeStorageValue(key, type = "local") {
  const storage = getStorageByType(type);
  if (!storage || !key) {
    return false;
  }
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

export function getOrCreatePersistentId(storageKey = "vjc.viewer-id.v1") {
  const storage = getStorageByType("local");
  if (!storage) {
    return `viewer_${Math.random().toString(36).slice(2, 10)}`;
  }
  const current = String(storage.getItem(storageKey) || "").trim();
  if (current) {
    return current;
  }
  const created = `viewer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  storage.setItem(storageKey, created);
  return created;
}
