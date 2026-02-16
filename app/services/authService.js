function sanitizeText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

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
        setUser(null);
        return null;
      }
      return setUser(payload.user);
    } catch (error) {
      setUser(null);
      return null;
    }
  }

  async function login(input = {}) {
    const payload = await requestJson("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: sanitizeText(input.email, 320),
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
    updateProfile,
    logout,
    subscribe,
  };
}
