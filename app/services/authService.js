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

function getLocalStorageSafe() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

const GOOGLE_SESSION_STORAGE_KEY = "vjc.auth.google-session.v1";

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== "object" || !rawUser.id) {
    return null;
  }
  const profile = rawUser.profile && typeof rawUser.profile === "object" ? rawUser.profile : {};
  return {
    id: sanitizeText(rawUser.id, 120),
    email: sanitizeText(rawUser.email, 320),
    createdAt: sanitizeText(rawUser.createdAt, 80),
    updatedAt: sanitizeText(rawUser.updatedAt, 80),
    displayName: sanitizeText(profile.displayName, 80) || "User",
    avatarUrl: sanitizeText(profile.avatarUrl, 1000000),
    phoneNumber: sanitizeText(profile.phoneNumber, 32),
    favorites: Array.isArray(profile.favorites) ? profile.favorites : [],
    likedJokes: Array.isArray(profile.likedJokes) ? profile.likedJokes : [],
    provider: sanitizeText(rawUser.provider || profile.provider || "local", 32) || "local",
    profile,
    stats: rawUser.stats && typeof rawUser.stats === "object" ? rawUser.stats : {},
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
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

  function setUser(user) {
    currentUser = normalizeUser(user);
    saveGoogleSession(currentUser);
    emit();
    return currentUser;
  }

  function getUser() {
    return currentUser ? { ...currentUser } : null;
  }

  async function refreshSession() {
    try {
      const payload = await requestJson("/api/auth/me", {
        method: "GET",
      });
      if (!payload?.authenticated || !payload.user) {
        const googleSession = loadGoogleSession();
        if (googleSession) {
          return setUser(googleSession);
        }
        setUser(null);
        return null;
      }
      return setUser(payload.user);
    } catch (error) {
      const googleSession = loadGoogleSession();
      if (googleSession) {
        return setUser(googleSession);
      }
      setUser(null);
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
      }),
    });
    if (!payload?.success || !payload?.user) {
      throw new Error(payload?.error || "Signup failed.");
    }
    let user = setUser(payload.user);
    if (input.avatarUrl) {
      user = await updateProfile({
        displayName: user.displayName,
        avatarUrl: input.avatarUrl,
      });
    }
    return user;
  }

  async function updateProfile(input = {}) {
    const payload = await requestJson("/api/auth/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: sanitizeText(input.displayName, 80),
        avatarUrl: sanitizeText(input.avatarUrl, 1000000),
        phoneNumber: sanitizeText(input.phoneNumber, 32),
      }),
    });
    if (!payload?.success || !payload?.user) {
      throw new Error(payload?.error || "Profile update failed.");
    }
    return setUser(payload.user);
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
        preferences: {},
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
