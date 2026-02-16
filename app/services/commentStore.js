import { readStorageValue, writeStorageValue } from "./storage.js";

const STORAGE_KEY = "vjc.comments.v1";

function sanitizeId(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeText(value, maxLength = 420) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeComment(rawComment) {
  if (!rawComment || typeof rawComment !== "object") {
    return null;
  }
  const id = sanitizeId(rawComment.id);
  const jokeId = sanitizeId(rawComment.jokeId);
  const text = sanitizeText(rawComment.text);
  if (!id || !jokeId || !text) {
    return null;
  }
  return {
    id,
    jokeId,
    text,
    userId: sanitizeId(rawComment.userId),
    userName: sanitizeText(rawComment.userName, 80) || "Guest",
    parentId: sanitizeId(rawComment.parentId),
    createdAt: sanitizeId(rawComment.createdAt, 80) || new Date().toISOString(),
    joke: rawComment.joke && typeof rawComment.joke === "object"
      ? {
          id: sanitizeId(rawComment.joke.id),
          text: sanitizeText(rawComment.joke.text, 1200),
          source: sanitizeText(rawComment.joke.source, 80),
        }
      : {
          id: jokeId,
          text: "",
          source: "",
        },
  };
}

function normalizeState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const byJoke = {};
  Object.keys(state.byJoke || {}).forEach((jokeId) => {
    const safeJokeId = sanitizeId(jokeId);
    if (!safeJokeId) {
      return;
    }
    const comments = Array.isArray(state.byJoke[jokeId]) ? state.byJoke[jokeId] : [];
    byJoke[safeJokeId] = comments.map((comment) => normalizeComment(comment)).filter(Boolean);
  });
  return { byJoke };
}

export function createCommentStore(options = {}) {
  const storageKey = options.storageKey || STORAGE_KEY;
  const runtime = normalizeState(readStorageValue(storageKey, {}, "local"));

  function persist() {
    writeStorageValue(storageKey, runtime, "local");
  }

  function getListForJoke(jokeId) {
    const safeJokeId = sanitizeId(jokeId);
    if (!safeJokeId) {
      return [];
    }
    const comments = runtime.byJoke[safeJokeId] || [];
    return comments
      .slice()
      .sort((left, right) => (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0));
  }

  function getCountForJoke(jokeId) {
    return getListForJoke(jokeId).length;
  }

  function addComment(joke, user, text, parentId = "") {
    const jokeId = sanitizeId(joke?.id);
    const safeText = sanitizeText(text, 500);
    if (!jokeId || !safeText) {
      return null;
    }
    if (!runtime.byJoke[jokeId]) {
      runtime.byJoke[jokeId] = [];
    }
    const comment = normalizeComment({
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      jokeId,
      text: safeText,
      userId: sanitizeId(user?.id || user?.userId || "guest"),
      userName: sanitizeText(user?.displayName || user?.username || "Guest", 80) || "Guest",
      parentId,
      createdAt: new Date().toISOString(),
      joke: {
        id: jokeId,
        text: sanitizeText(joke?.text, 1200),
        source: sanitizeText(joke?.source || joke?.sourceType, 80),
      },
    });
    if (!comment) {
      return null;
    }
    runtime.byJoke[jokeId].push(comment);
    persist();
    return comment;
  }

  function listUserComments(userId) {
    const safeUserId = sanitizeId(userId);
    if (!safeUserId) {
      return [];
    }
    const output = [];
    Object.keys(runtime.byJoke).forEach((jokeId) => {
      const comments = runtime.byJoke[jokeId] || [];
      for (let i = 0; i < comments.length; i += 1) {
        if (comments[i].userId === safeUserId) {
          output.push(comments[i]);
        }
      }
    });
    return output.sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  }

  return {
    getListForJoke,
    getCountForJoke,
    addComment,
    listUserComments,
  };
}
