function sanitizeText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizePhone(value) {
  const raw = sanitizeText(value, 32);
  if (!raw) {
    return "";
  }
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "";
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

function normalizePublicEmail(value) {
  const email = sanitizeText(value, 320).toLowerCase();
  if (!email || /@local\.voicejoke\.app$/i.test(email)) {
    return "";
  }
  return email;
}

function getLocalStorageSafe() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

const GOOGLE_SESSION_STORAGE_KEY = "vjc.auth.google-session.v1";
const AUTH_USER_CACHE_STORAGE_KEY = "vjc.auth.user-cache.v1";
const AUTH_SYNC_STORAGE_KEY = "vjc.auth.sync.v1";

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== "object" || !rawUser.id) {
    return null;
  }
  const profile = rawUser.profile && typeof rawUser.profile === "object" ? rawUser.profile : {};
  return {
    id: sanitizeText(rawUser.id, 120),
    email: normalizePublicEmail(rawUser.email),
    createdAt: sanitizeText(rawUser.createdAt, 80),
    updatedAt: sanitizeText(rawUser.updatedAt, 80),
    displayName: sanitizeText(profile.displayName, 80) || "User",
    avatarUrl: sanitizeText(profile.avatarUrl, 1000000),
    phoneNumber: sanitizeText(profile.phoneNumber, 32),
    favorites: Array.isArray(profile.favorites) ? profile.favorites : [],
    likedJokes: Array.isArray(profile.likedJokes) ? profile.likedJokes : [],
    provider: sanitizeText(rawUser.provider || profile.provider || "local", 32) || "local",
    language:
      sanitizeText(profile?.preferences?.language || profile?.basics?.locale, 20).toLowerCase() ||
      "en",
    profile,
    stats: rawUser.stats && typeof rawUser.stats === "object" ? rawUser.stats : {},
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

export function createAuthService() {
  let currentUser = null;
  const listeners = new Set();

  function loadUserCache() {
    const storage = getLocalStorageSafe();
    if (!storage) {
      return null;
    }
    try {
      const raw = storage.getItem(AUTH_USER_CACHE_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return normalizeUser(parsed?.user || parsed);
    } catch (error) {
      return null;
    }
  }

  function saveUserCache(user) {
    const storage = getLocalStorageSafe();
    if (!storage) {
      return;
    }
    try {
      if (!user) {
        storage.removeItem(AUTH_USER_CACHE_STORAGE_KEY);
        return;
      }
      storage.setItem(
        AUTH_USER_CACHE_STORAGE_KEY,
        JSON.stringify({
          user,
          cachedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      // Ignore storage failures for compatibility.
    }
  }

  function broadcastAuthSync(action, user) {
    const storage = getLocalStorageSafe();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(
        AUTH_SYNC_STORAGE_KEY,
        JSON.stringify({
          action: sanitizeText(action, 48),
          userId: sanitizeText(user?.id, 120),
          at: Date.now(),
        })
      );
    } catch (error) {
      // Ignore cross-tab sync failures.
    }
  }

  function loadGoogleSession() {
    const storage = getLocalStorageSafe();
    if (!storage) {
      return null;
    }
    try {
      const raw = storage.getItem(GOOGLE_SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return normalizeUser(parsed);
    } catch (error) {
      return null;
    }
  }

  function saveGoogleSession(user) {
    const storage = getLocalStorageSafe();
    if (!storage) {
      return;
    }
    try {
      if (!user || user.provider !== "google") {
        storage.removeItem(GOOGLE_SESSION_STORAGE_KEY);
        return;
      }
      storage.setItem(GOOGLE_SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      // Ignore storage failures for compatibility.
    }
  }

  function emit() {
    const snapshot = getUser();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        // Ignore subscriber failures.
      }
    });
  }

  function setUser(user, options = {}) {
    const shouldBroadcast = options.broadcast !== false;
    currentUser = normalizeUser(user);
    saveGoogleSession(currentUser);
    saveUserCache(currentUser);
    if (shouldBroadcast) {
      broadcastAuthSync(currentUser ? "updated" : "logged_out", currentUser);
    }
    emit();
    return currentUser;
  }

  function getUser() {
    return currentUser ? { ...currentUser } : null;
  }

  function buildLocalProfileUpdate(baseUser, input = {}) {
    if (!baseUser) {
      return null;
    }
    const now = new Date().toISOString();
    const displayName =
      sanitizeText(input.displayName, 80) ||
      sanitizeText(baseUser.displayName || baseUser?.profile?.displayName, 80) ||
      "User";
    const phoneNumber = normalizePhone(
      sanitizeText(input.phoneNumber, 32) ||
        sanitizeText(baseUser.phoneNumber || baseUser?.profile?.phoneNumber, 32)
    );
    const avatarUrl =
      sanitizeText(input.avatarUrl, 1000000) ||
      sanitizeText(baseUser.avatarUrl || baseUser?.profile?.avatarUrl, 1000000);
    const language =
      sanitizeText(
        input.language ||
          baseUser.language ||
          baseUser?.profile?.preferences?.language ||
          baseUser?.profile?.basics?.locale ||
          "en",
        12
      )
        .slice(0, 2)
        .toLowerCase() || "en";

    return {
      ...baseUser,
      updatedAt: now,
      displayName,
      avatarUrl,
      phoneNumber,
      language,
      profile: {
        ...(baseUser.profile || {}),
        displayName,
        avatarUrl,
        phoneNumber,
        basics: {
          ...(baseUser?.profile?.basics || {}),
          locale: language,
        },
        preferences: {
          ...(baseUser?.profile?.preferences || {}),
          language,
        },
        provider: sanitizeText(
          baseUser.provider || baseUser?.profile?.provider || "local",
          32
        ).toLowerCase(),
      },
    };
  }

  async function refreshSession(options = {}) {
    const keepLocalOnFailure = options.keepLocalOnFailure !== false;
    try {
      const payload = await requestJson("/api/auth/me", {
        method: "GET",
      });
      if (!payload?.authenticated || !payload.user) {
        const googleSession = loadGoogleSession();
        if (googleSession) {
          return setUser(googleSession, { broadcast: false });
        }
        setUser(null, { broadcast: false });
        return null;
      }
      return setUser(payload.user, { broadcast: false });
    } catch (error) {
      const googleSession = loadGoogleSession();
      if (googleSession) {
        return setUser(googleSession, { broadcast: false });
      }
      if (keepLocalOnFailure) {
        const cachedUser = currentUser || loadUserCache();
        if (cachedUser) {
          if (!currentUser) {
            currentUser = normalizeUser(cachedUser);
            emit();
          }
          return getUser();
        }
      }
      if (!keepLocalOnFailure) {
        setUser(null, { broadcast: false });
      }
      return null;
    }
  }

  async function login(input = {}) {
    const identifier = sanitizeText(input.identifier || input.email || input.phoneNumber, 320);
    const payload = await requestJson("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: identifier.includes("@") ? identifier : "",
        phoneNumber: identifier.includes("@") ? "" : normalizePhone(identifier),
        identifier,
        password: String(input.password || ""),
      }),
    });
    if (!payload?.success || !payload?.user) {
      throw new Error(payload?.error || "Login failed.");
    }
    return setUser(payload.user);
  }

  async function signup(input = {}) {
    const payload = await requestJson("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: sanitizeText(input.email, 320),
        phoneNumber: normalizePhone(input.phoneNumber),
        password: String(input.password || ""),
        displayName: sanitizeText(input.username || input.displayName, 80),
        locale: sanitizeText(input.language || input.locale || "en", 12),
        language: sanitizeText(input.language || input.locale || "en", 12),
      }),
    });
    if (!payload?.success || !payload?.user) {
      throw new Error(payload?.error || "Signup failed.");
    }
    let user = setUser(payload.user);
    if (input.avatarUrl) {
      try {
        user = await updateProfile({
          displayName: user.displayName,
          avatarUrl: input.avatarUrl,
        });
      } catch (error) {
        if (/authentication required|sign in again/i.test(String(error?.message || ""))) {
          return user;
        }
        throw error;
      }
    }
    return user;
  }

  async function updateProfile(input = {}) {
    const activeUser = getUser();
    if (!activeUser) {
      throw new Error("Please sign in to save profile changes.");
    }

    // Google login is local-only in this app, so profile updates are persisted locally.
    if (activeUser.provider === "google") {
      const nextUser = buildLocalProfileUpdate(activeUser, input);
      if (!nextUser) {
        throw new Error("Profile update failed.");
      }
      return setUser(nextUser);
    }

    try {
      const payload = await requestJson("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: sanitizeText(input.displayName, 80),
          avatarUrl: sanitizeText(input.avatarUrl, 1000000),
          phoneNumber: sanitizeText(input.phoneNumber, 32),
          language: sanitizeText(input.language, 12),
        }),
      });
      if (!payload?.success || !payload?.user) {
        throw new Error(payload?.error || "Profile update failed.");
      }
      return setUser(payload.user);
    } catch (error) {
      if (/authentication required/i.test(String(error?.message || ""))) {
        const refreshed = await refreshSession({ keepLocalOnFailure: false });
        if (refreshed?.provider === "google") {
          const nextUser = buildLocalProfileUpdate(refreshed, input);
          if (nextUser) {
            return setUser(nextUser);
          }
        }
        throw new Error("Please sign in again to save your profile.");
      }
      throw error;
    }
  }

  async function logout() {
    await requestJson("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);
    setUser(null);
  }

  async function loginWithGoogle(input = {}) {
    const fallbackEmail = sanitizeText(input.email || "", 320);
    const email =
      fallbackEmail ||
      sanitizeText(window.prompt("Enter your Google email to continue:", ""), 320);
    if (!email || !email.includes("@")) {
      throw new Error("Google login canceled.");
    }
    const displayName =
      sanitizeText(input.displayName || "", 80) ||
      sanitizeText(email.split("@")[0], 80) ||
      "Google User";
    const avatarUrl = sanitizeText(input.avatarUrl || "", 1000000);
    const now = new Date().toISOString();
    const user = {
      id: `google_${sanitizeText(email.toLowerCase(), 120).replace(/[^a-z0-9]/g, "_")}`,
      email,
      createdAt: now,
      updatedAt: now,
      provider: "google",
      profile: {
        displayName,
        avatarUrl,
        phoneNumber: normalizePhone(input.phoneNumber),
        favorites: [],
        likedJokes: [],
        basics: {},
        preferences: {
          language: sanitizeText(input.language || navigator.language || "en", 12)
            .slice(0, 2)
            .toLowerCase(),
        },
        subscription: {
          plan: "free",
          status: "active",
        },
        provider: "google",
      },
      stats: {
        jokeViews: 0,
        favoritesAdded: 0,
        likesAdded: 0,
      },
    };
    return setUser(user);
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

  currentUser = loadUserCache() || loadGoogleSession();

  const localStorageRef = getLocalStorageSafe();
  if (
    localStorageRef &&
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    window.addEventListener("storage", (event) => {
      if (!event || event.storageArea !== localStorageRef || !event.key) {
        return;
      }
      if (event.key === AUTH_SYNC_STORAGE_KEY) {
        const payload = String(event.newValue || "");
        if (payload.includes("\"logged_out\"")) {
          if (currentUser) {
            currentUser = null;
            emit();
          }
          return;
        }
        refreshSession({ keepLocalOnFailure: true }).catch(() => null);
      }
    });
  }

  return {
    getUser,
    setUser,
    refreshSession,
    login,
    signup,
    loginWithGoogle,
    updateProfile,
    logout,
    isAuthenticated() {
      return Boolean(getUser());
    },
    subscribe,
  };
}
