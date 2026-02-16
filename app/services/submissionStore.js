import { readStorageValue, writeStorageValue } from "./storage.js";

const STORAGE_KEY = "vjc.submissions.v1";

function sanitizeId(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeText(value, maxLength = 1400) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeEntry(rawEntry = {}) {
  const id = sanitizeId(rawEntry.id);
  if (!id) {
    return null;
  }
  return {
    id,
    text: sanitizeText(rawEntry.text),
    category: sanitizeText(rawEntry.category, 40) || "random",
    source: sanitizeText(rawEntry.source, 80) || "user",
    createdAt: sanitizeId(rawEntry.createdAt, 80) || new Date().toISOString(),
    ownerId: sanitizeId(rawEntry.ownerId, 140) || "guest",
  };
}

function normalizeState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const entries = Array.isArray(state.entries) ? state.entries : [];
  return {
    entries: entries.map((entry) => normalizeEntry(entry)).filter(Boolean),
  };
}

export function createSubmissionStore(options = {}) {
  const storageKey = options.storageKey || STORAGE_KEY;
  const runtime = normalizeState(readStorageValue(storageKey, {}, "local"));

  function persist() {
    writeStorageValue(storageKey, runtime, "local");
  }

  function addSubmission(joke, ownerId = "guest") {
    const normalized = normalizeEntry({
      ...joke,
      ownerId,
      source: joke?.source || "user",
    });
    if (!normalized) {
      return null;
    }
    runtime.entries.unshift(normalized);
    runtime.entries = runtime.entries.slice(0, 300);
    persist();
    return normalized;
  }

  function listByOwner(ownerId = "guest") {
    const safeOwnerId = sanitizeId(ownerId, 140) || "guest";
    return runtime.entries
      .filter((entry) => entry.ownerId === safeOwnerId)
      .slice()
      .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  }

  return {
    addSubmission,
    listByOwner,
  };
}
