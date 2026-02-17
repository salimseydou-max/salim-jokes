import { readStorageValue, writeStorageValue } from "./storage.js";

const STORAGE_KEY = "vjc.preferences.v1";

const DEFAULT_PREFERENCES = Object.freeze({
  general: {
    language: "en",
  },
  appearance: {
    theme: "dark",
    compactCards: true,
  },
  notifications: {
    newJokes: true,
    commentReplies: true,
    featureUpdates: true,
    userActivity: true,
  },
  privacy: {
    profileVisibility: "private",
    allowActivitySync: true,
  },
  socialLinks: {
    website: "",
    x: "",
    instagram: "",
    youtube: "",
  },
});

function sanitizeText(value, maxLength = 200) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeTheme(value) {
  const theme = sanitizeText(value, 16).toLowerCase();
  if (theme === "light" || theme === "dark" || theme === "system") {
    return theme;
  }
  return "dark";
}

function normalizeLanguage(value) {
  const language = sanitizeText(value, 12).toLowerCase();
  if (!language) {
    return "en";
  }
  return language;
}

function normalizePreferences(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    general: {
      language: normalizeLanguage(source?.general?.language || DEFAULT_PREFERENCES.general.language),
    },
    appearance: {
      theme: normalizeTheme(source?.appearance?.theme || DEFAULT_PREFERENCES.appearance.theme),
      compactCards: Boolean(
        source?.appearance?.compactCards ?? DEFAULT_PREFERENCES.appearance.compactCards
      ),
    },
    notifications: {
      newJokes: Boolean(source?.notifications?.newJokes ?? DEFAULT_PREFERENCES.notifications.newJokes),
      commentReplies: Boolean(
        source?.notifications?.commentReplies ?? DEFAULT_PREFERENCES.notifications.commentReplies
      ),
      featureUpdates: Boolean(
        source?.notifications?.featureUpdates ?? DEFAULT_PREFERENCES.notifications.featureUpdates
      ),
      userActivity: Boolean(
        source?.notifications?.userActivity ?? DEFAULT_PREFERENCES.notifications.userActivity
      ),
    },
    privacy: {
      profileVisibility:
        sanitizeText(source?.privacy?.profileVisibility || "private", 20).toLowerCase() || "private",
      allowActivitySync: Boolean(
        source?.privacy?.allowActivitySync ?? DEFAULT_PREFERENCES.privacy.allowActivitySync
      ),
    },
    socialLinks: {
      website: sanitizeText(source?.socialLinks?.website, 200),
      x: sanitizeText(source?.socialLinks?.x, 120),
      instagram: sanitizeText(source?.socialLinks?.instagram, 120),
      youtube: sanitizeText(source?.socialLinks?.youtube, 120),
    },
  };
}

export function createPreferencesStore(options = {}) {
  const storageKey = options.storageKey || STORAGE_KEY;
  let state = normalizePreferences(readStorageValue(storageKey, DEFAULT_PREFERENCES, "local"));
  const listeners = new Set();

  function emit() {
    const snapshot = get();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        // Keep preference updates resilient.
      }
    });
  }

  function persist() {
    writeStorageValue(storageKey, state, "local");
  }

  function get() {
    return JSON.parse(JSON.stringify(state));
  }

  function set(nextState) {
    state = normalizePreferences(nextState);
    persist();
    emit();
    return get();
  }

  function update(partial) {
    const merged = {
      ...state,
      ...(partial || {}),
      general: {
        ...state.general,
        ...((partial && partial.general) || {}),
      },
      appearance: {
        ...state.appearance,
        ...((partial && partial.appearance) || {}),
      },
      notifications: {
        ...state.notifications,
        ...((partial && partial.notifications) || {}),
      },
      privacy: {
        ...state.privacy,
        ...((partial && partial.privacy) || {}),
      },
      socialLinks: {
        ...state.socialLinks,
        ...((partial && partial.socialLinks) || {}),
      },
    };
    return set(merged);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    get,
    set,
    update,
    subscribe,
    defaults: JSON.parse(JSON.stringify(DEFAULT_PREFERENCES)),
  };
}
