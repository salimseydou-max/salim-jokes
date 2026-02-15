import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { getAuthConfig } from "../config/auth.js";

const scrypt = promisify(scryptCallback);
const MAX_AVATAR_DATA_URL_LENGTH = 1000000;
const MAX_AVATAR_URL_LENGTH = 2048;
const DEFAULT_AVATAR_COLORS = ["#f6e58d", "#ffbe76", "#badc58", "#7ed6df", "#c7ecee", "#dff9fb"];

const runtime =
  globalThis.__JOKE_AUTH_RUNTIME__ ||
  {
    stateByFile: new Map(),
    loadingByFile: new Map(),
    writeLocksByFile: new Map(),
  };

if (!globalThis.__JOKE_AUTH_RUNTIME__) {
  globalThis.__JOKE_AUTH_RUNTIME__ = runtime;
}

function createAuthError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeText(value, maxLength = 240) {
  if (!value) {
    return "";
  }
  return String(value).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 320).toLowerCase();
}

function isValidEmail(email) {
  if (!email) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeId(value, maxLength = 120) {
  if (!value) {
    return "";
  }
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_\-:.]/g, "")
    .slice(0, maxLength);
}

function createSeedHash(value) {
  const text = String(value || "user");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createDefaultAvatarDataUrl(seedName = "User") {
  const normalizedName = sanitizeText(seedName, 80);
  const fallback = normalizedName || "User";
  const first = fallback.replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "U";
  const hash = createSeedHash(fallback);
  const background = DEFAULT_AVATAR_COLORS[hash % DEFAULT_AVATAR_COLORS.length];
  const foreground = "#1f1f1f";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${background}"/><text x="64" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="${foreground}">${first}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function sanitizeAvatarUrl(value, options = {}) {
  const allowDefaultSvg = Boolean(options.allowDefaultSvg);
  if (!value) {
    return "";
  }
  const text = String(value).trim();
  if (!text) {
    return "";
  }
  if (
    /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(text) &&
    text.length <= MAX_AVATAR_DATA_URL_LENGTH
  ) {
    return text;
  }
  if (/^https?:\/\/[^\s]+$/i.test(text)) {
    return text.slice(0, MAX_AVATAR_URL_LENGTH);
  }
  if (allowDefaultSvg && text.startsWith("data:image/svg+xml,")) {
    return text.slice(0, MAX_AVATAR_URL_LENGTH);
  }
  return "";
}

function hashToken(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function normalizeUniqueIds(list, maxItems = 300) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  const output = [];
  for (let i = 0; i < list.length; i += 1) {
    const safe = sanitizeId(list[i], 120);
    if (!safe || seen.has(safe)) {
      continue;
    }
    seen.add(safe);
    output.push(safe);
    if (output.length >= maxItems) {
      break;
    }
  }
  return output;
}

function normalizeUserProfile(profile = {}, email = "") {
  const guessedName = email ? email.split("@")[0] : "User";
  const displayName = sanitizeText(profile.displayName, 80) || guessedName;
  const avatarUrl =
    sanitizeAvatarUrl(profile.avatarUrl, { allowDefaultSvg: true }) ||
    createDefaultAvatarDataUrl(displayName);
  return {
    displayName,
    avatarUrl,
    favorites: normalizeUniqueIds(profile.favorites || [], 500),
    likedJokes: normalizeUniqueIds(profile.likedJokes || [], 500),
    basics:
      profile.basics && typeof profile.basics === "object"
        ? {
            locale: sanitizeText(profile.basics.locale, 40),
            timezone: sanitizeText(profile.basics.timezone, 80),
          }
        : {
            locale: "",
            timezone: "",
          },
    preferences:
      profile.preferences && typeof profile.preferences === "object"
        ? {
            language: sanitizeText(profile.preferences.language, 20),
            theme: sanitizeText(profile.preferences.theme, 20),
          }
        : {
            language: "",
            theme: "",
          },
    subscription:
      profile.subscription && typeof profile.subscription === "object"
        ? {
            plan: sanitizeText(profile.subscription.plan, 32) || "free",
            status: sanitizeText(profile.subscription.status, 32) || "active",
          }
        : {
            plan: "free",
            status: "active",
          },
  };
}

function normalizeUserStats(stats = {}) {
  const toCount = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  };
  return {
    jokeViews: toCount(stats.jokeViews),
    favoritesAdded: toCount(stats.favoritesAdded),
    likesAdded: toCount(stats.likesAdded),
  };
}

function normalizeUserRecord(rawUser) {
  if (!rawUser || typeof rawUser !== "object") {
    return null;
  }
  const id = sanitizeId(rawUser.id, 80);
  const email = sanitizeEmail(rawUser.email || rawUser.emailLower || "");
  const passwordHash = sanitizeText(rawUser.passwordHash || "", 800);
  if (!id || !email || !passwordHash) {
    return null;
  }
  const nowIso = new Date().toISOString();
  return {
    id,
    email,
    emailLower: email,
    passwordHash,
    createdAt: sanitizeText(rawUser.createdAt, 80) || nowIso,
    updatedAt: sanitizeText(rawUser.updatedAt, 80) || nowIso,
    lastLoginAt: sanitizeText(rawUser.lastLoginAt, 80) || "",
    profile: normalizeUserProfile(rawUser.profile, email),
    stats: normalizeUserStats(rawUser.stats),
  };
}

function normalizeSessionRecord(rawSession) {
  if (!rawSession || typeof rawSession !== "object") {
    return null;
  }
  const id = sanitizeId(rawSession.id, 120);
  const userId = sanitizeId(rawSession.userId, 80);
  const tokenHash = sanitizeText(rawSession.tokenHash, 128).toLowerCase();
  if (!id || !userId || !tokenHash) {
    return null;
  }
  const createdAt = sanitizeText(rawSession.createdAt, 80) || new Date().toISOString();
  const expiresAt = sanitizeText(rawSession.expiresAt, 80) || createdAt;
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return null;
  }
  return {
    id,
    userId,
    tokenHash,
    createdAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    userAgent: sanitizeText(rawSession.userAgent, 260),
    ipAddress: sanitizeText(rawSession.ipAddress, 140),
  };
}

function normalizeAuthState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return {
      users: [],
      sessions: [],
    };
  }

  const users = Array.isArray(rawState.users)
    ? rawState.users.map(normalizeUserRecord).filter(Boolean)
    : [];
  const sessions = Array.isArray(rawState.sessions)
    ? rawState.sessions.map(normalizeSessionRecord).filter(Boolean)
    : [];

  return { users, sessions };
}

async function loadStateFromDisk(storageFile) {
  try {
    const raw = await readFile(storageFile, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeAuthState(parsed);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return normalizeAuthState(null);
    }
    console.error("Failed reading auth storage:", error);
    return normalizeAuthState(null);
  }
}

async function getAuthState(config) {
  if (runtime.stateByFile.has(config.authStorageFile)) {
    return runtime.stateByFile.get(config.authStorageFile);
  }

  if (runtime.loadingByFile.has(config.authStorageFile)) {
    return runtime.loadingByFile.get(config.authStorageFile);
  }

  const loadPromise = loadStateFromDisk(config.authStorageFile).then((state) => {
    runtime.stateByFile.set(config.authStorageFile, state);
    runtime.loadingByFile.delete(config.authStorageFile);
    return state;
  });
  runtime.loadingByFile.set(config.authStorageFile, loadPromise);
  return loadPromise;
}

async function saveAuthState(config, state) {
  const persist = async () => {
    await mkdir(dirname(config.authStorageFile), { recursive: true });
    await writeFile(config.authStorageFile, JSON.stringify(state), "utf8");
  };

  const previous = runtime.writeLocksByFile.get(config.authStorageFile) || Promise.resolve();
  const current = previous.then(persist);
  runtime.writeLocksByFile.set(
    config.authStorageFile,
    current.catch(() => {
      // Keep write chain alive if a write fails.
    })
  );
  await current;
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || "",
    profile: {
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      favorites: [...(user.profile.favorites || [])],
      likedJokes: [...(user.profile.likedJokes || [])],
      basics: { ...(user.profile.basics || {}) },
      preferences: { ...(user.profile.preferences || {}) },
      subscription: { ...(user.profile.subscription || {}) },
    },
    stats: { ...(user.stats || {}) },
  };
}

function validatePasswordStrength(password, minLength) {
  if (typeof password !== "string") {
    return {
      ok: false,
      reason:
        "Password must be at least 8 characters and include upper/lower letters and a number.",
    };
  }
  const value = password.trim();
  const hasMinLength = value.length >= minLength;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  if (hasMinLength && hasUpper && hasLower && hasNumber) {
    return { ok: true, reason: "" };
  }
  return {
    ok: false,
    reason:
      "Password must be at least 8 characters and include upper/lower letters and a number.",
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = parts[1];
  const expectedHash = parts[2];
  if (!salt || !expectedHash) {
    return false;
  }
  try {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(await scrypt(password, salt, expected.length));
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  } catch (error) {
    return false;
  }
}

function pruneExpiredSessions(state) {
  const now = Date.now();
  state.sessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > now);
}

function shouldExtendSessionExpiry(session, sessionTtlMs) {
  const ttlMs = Number(sessionTtlMs);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return false;
  }
  const expiresAtMs = Date.parse(session?.expiresAt || "");
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) {
    return false;
  }
  return remainingMs <= Math.floor(ttlMs / 2);
}

function enforceSessionLimit(state, userId, maxSessionsPerUser) {
  if (!Number.isFinite(maxSessionsPerUser) || maxSessionsPerUser <= 0) {
    return;
  }
  const sessions = state.sessions
    .filter((session) => session.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const keepIds = new Set(sessions.slice(0, maxSessionsPerUser).map((session) => session.id));
  state.sessions = state.sessions.filter((session) => {
    if (session.userId !== userId) {
      return true;
    }
    return keepIds.has(session.id);
  });
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function parseCookies(rawCookie = "") {
  const cookieMap = {};
  if (!rawCookie || typeof rawCookie !== "string") {
    return cookieMap;
  }
  rawCookie.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) {
      return;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) {
      return;
    }
    cookieMap[key] = value;
  });
  return cookieMap;
}

function appendSetCookie(res, cookieValue) {
  if (!res || typeof res.setHeader !== "function") {
    return;
  }
  const existing =
    typeof res.getHeader === "function" ? res.getHeader("Set-Cookie") : undefined;
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [existing, cookieValue]);
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.expiresAt) {
    parts.push(`Expires=${new Date(options.expiresAt).toUTCString()}`);
  }
  return parts.join("; ");
}

export function readAuthTokenFromRequest(req) {
  const config = getAuthConfig();
  const rawCookie = req?.headers?.cookie || "";
  const parsed = parseCookies(rawCookie);
  const rawValue = parsed[config.sessionCookieName];
  if (!rawValue) {
    return "";
  }
  try {
    return decodeURIComponent(rawValue);
  } catch (error) {
    return rawValue;
  }
}

export function setAuthSessionCookie(res, token, expiresAt) {
  const config = getAuthConfig();
  const now = Date.now();
  const expiresAtMs = Date.parse(expiresAt) || now + config.sessionTtlMs;
  const maxAgeSeconds = Math.max(1, Math.floor((expiresAtMs - now) / 1000));
  const cookie = buildCookie(config.sessionCookieName, encodeURIComponent(token), {
    maxAge: maxAgeSeconds,
    expiresAt: expiresAtMs,
    secure: config.secureCookies,
    sameSite: "Lax",
    httpOnly: true,
    path: "/",
  });
  appendSetCookie(res, cookie);
}

export function clearAuthSessionCookie(res) {
  const config = getAuthConfig();
  const cookie = buildCookie(config.sessionCookieName, "", {
    maxAge: 0,
    expiresAt: 0,
    secure: config.secureCookies,
    sameSite: "Lax",
    httpOnly: true,
    path: "/",
  });
  appendSetCookie(res, cookie);
}

function createUserRecord(input, passwordHash) {
  const email = sanitizeEmail(input.email);
  const displayName =
    sanitizeText(input.displayName, 80) || sanitizeText(email.split("@")[0], 80) || "User";
  const nowIso = new Date().toISOString();
  return {
    id: `user_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    email,
    emailLower: email,
    passwordHash,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastLoginAt: nowIso,
    profile: normalizeUserProfile(
      {
        displayName,
        basics: {
          locale: sanitizeText(input.locale, 40),
          timezone: sanitizeText(input.timezone, 80),
        },
      },
      email
    ),
    stats: normalizeUserStats(),
  };
}

function createSessionRecord(userId, metadata, config) {
  const now = Date.now();
  const token = createSessionToken();
  const expiresAt = new Date(now + config.sessionTtlMs).toISOString();
  return {
    session: {
      id: `sess_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      userId,
      tokenHash: hashToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt,
      userAgent: sanitizeText(metadata.userAgent, 260),
      ipAddress: sanitizeText(metadata.ipAddress, 140),
    },
    token,
    expiresAt,
  };
}

export async function signupUser(input = {}) {
  const config = getAuthConfig();

  const email = sanitizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw createAuthError("Please provide a valid email address.", 400, "AUTH_INVALID_EMAIL");
  }

  const passwordCheck = validatePasswordStrength(input.password, config.passwordMinLength);
  if (!passwordCheck.ok) {
    throw createAuthError(passwordCheck.reason, 400, "AUTH_WEAK_PASSWORD");
  }

  const state = await getAuthState(config);
  const exists = state.users.some((user) => user.emailLower === email);
  if (exists) {
    throw createAuthError(
      "An account with this email already exists.",
      409,
      "AUTH_ACCOUNT_EXISTS"
    );
  }

  const passwordHash = await hashPassword(input.password.trim());
  const user = createUserRecord(
    {
      email,
      displayName: input.displayName,
      locale: input.locale,
      timezone: input.timezone,
    },
    passwordHash
  );

  state.users.push(user);
  pruneExpiredSessions(state);
  const nextSession = createSessionRecord(
    user.id,
    {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
    config
  );
  state.sessions.push(nextSession.session);
  enforceSessionLimit(state, user.id, config.maxSessionsPerUser);
  await saveAuthState(config, state);

  return {
    user: toPublicUser(user),
    sessionToken: nextSession.token,
    sessionExpiresAt: nextSession.expiresAt,
  };
}

export async function loginUser(input = {}) {
  const config = getAuthConfig();

  const email = sanitizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password.trim() : "";
  if (!email || !password) {
    throw createAuthError("Invalid email or password.", 401, "AUTH_INVALID_CREDENTIALS");
  }

  const state = await getAuthState(config);
  pruneExpiredSessions(state);
  const user = state.users.find((entry) => entry.emailLower === email);
  if (!user) {
    throw createAuthError("Invalid email or password.", 401, "AUTH_INVALID_CREDENTIALS");
  }

  const verified = await verifyPassword(password, user.passwordHash);
  if (!verified) {
    throw createAuthError("Invalid email or password.", 401, "AUTH_INVALID_CREDENTIALS");
  }

  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = user.lastLoginAt;

  const nextSession = createSessionRecord(
    user.id,
    {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
    config
  );
  state.sessions.push(nextSession.session);
  enforceSessionLimit(state, user.id, config.maxSessionsPerUser);
  await saveAuthState(config, state);

  return {
    user: toPublicUser(user),
    sessionToken: nextSession.token,
    sessionExpiresAt: nextSession.expiresAt,
  };
}

export async function logoutByToken(token) {
  if (!token) {
    return { revoked: false };
  }
  const config = getAuthConfig();
  const state = await getAuthState(config);
  const tokenHash = hashToken(token);
  const before = state.sessions.length;
  state.sessions = state.sessions.filter((session) => session.tokenHash !== tokenHash);
  const revoked = before !== state.sessions.length;
  if (revoked) {
    await saveAuthState(config, state);
  }
  return { revoked };
}

export async function getAuthenticatedUserByToken(token) {
  if (!token) {
    return null;
  }
  const config = getAuthConfig();
  const state = await getAuthState(config);
  pruneExpiredSessions(state);

  const tokenHash = hashToken(token);
  const session = state.sessions.find((entry) => entry.tokenHash === tokenHash);
  if (!session) {
    await saveAuthState(config, state);
    return null;
  }

  const user = state.users.find((entry) => entry.id === session.userId);
  if (!user) {
    state.sessions = state.sessions.filter((entry) => entry.id !== session.id);
    await saveAuthState(config, state);
    return null;
  }

  if (shouldExtendSessionExpiry(session, config.sessionTtlMs)) {
    session.expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
    await saveAuthState(config, state);
  }

  return {
    user: toPublicUser(user),
    session: {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    },
  };
}

export async function getAuthenticatedUserFromRequest(req) {
  const token = readAuthTokenFromRequest(req);
  if (!token) {
    return null;
  }
  return getAuthenticatedUserByToken(token);
}

export async function updateUserProfile(userId, updates = {}) {
  const safeUserId = sanitizeId(userId, 80);
  if (!safeUserId) {
    throw createAuthError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  const config = getAuthConfig();
  const state = await getAuthState(config);
  const user = state.users.find((entry) => entry.id === safeUserId);
  if (!user) {
    throw createAuthError("Account not found.", 404, "AUTH_ACCOUNT_NOT_FOUND");
  }

  let updated = false;

  if (Object.prototype.hasOwnProperty.call(updates, "displayName")) {
    const safeDisplayName = sanitizeText(updates.displayName, 80);
    if (safeDisplayName && safeDisplayName !== user.profile.displayName) {
      user.profile.displayName = safeDisplayName;
      if (!sanitizeAvatarUrl(user.profile.avatarUrl, { allowDefaultSvg: true })) {
        user.profile.avatarUrl = createDefaultAvatarDataUrl(safeDisplayName);
      }
      updated = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "avatarUrl")) {
    const rawAvatar = updates.avatarUrl;
    const safeAvatar = sanitizeAvatarUrl(rawAvatar);
    if (rawAvatar && !safeAvatar) {
      throw createAuthError(
        "Please upload a valid profile image (PNG, JPG, or WebP under 1MB).",
        400,
        "AUTH_INVALID_AVATAR"
      );
    }
    const fallbackAvatar = createDefaultAvatarDataUrl(user.profile.displayName || user.email);
    const nextAvatar = safeAvatar || fallbackAvatar;
    if (nextAvatar !== user.profile.avatarUrl) {
      user.profile.avatarUrl = nextAvatar;
      updated = true;
    }
  }

  if (!sanitizeAvatarUrl(user.profile.avatarUrl, { allowDefaultSvg: true })) {
    user.profile.avatarUrl = createDefaultAvatarDataUrl(user.profile.displayName || user.email);
    updated = true;
  }

  if (updated) {
    user.updatedAt = new Date().toISOString();
    await saveAuthState(config, state);
  }

  return {
    updated,
    user: toPublicUser(user),
  };
}

export async function updateUserPassword(
  userId,
  currentPassword,
  nextPassword,
  metadata = {}
) {
  const safeUserId = sanitizeId(userId, 80);
  if (!safeUserId) {
    throw createAuthError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  const current = typeof currentPassword === "string" ? currentPassword.trim() : "";
  const next = typeof nextPassword === "string" ? nextPassword.trim() : "";
  if (!current || !next) {
    throw createAuthError(
      "Current and new password are required.",
      400,
      "AUTH_PASSWORD_REQUIRED"
    );
  }

  const config = getAuthConfig();
  const passwordCheck = validatePasswordStrength(next, config.passwordMinLength);
  if (!passwordCheck.ok) {
    throw createAuthError(passwordCheck.reason, 400, "AUTH_WEAK_PASSWORD");
  }
  if (current === next) {
    throw createAuthError(
      "New password must be different from current password.",
      400,
      "AUTH_PASSWORD_UNCHANGED"
    );
  }

  const state = await getAuthState(config);
  pruneExpiredSessions(state);
  const user = state.users.find((entry) => entry.id === safeUserId);
  if (!user) {
    throw createAuthError("Account not found.", 404, "AUTH_ACCOUNT_NOT_FOUND");
  }

  const verified = await verifyPassword(current, user.passwordHash);
  if (!verified) {
    throw createAuthError(
      "Current password is incorrect.",
      401,
      "AUTH_INVALID_CREDENTIALS"
    );
  }

  user.passwordHash = await hashPassword(next);
  user.updatedAt = new Date().toISOString();
  user.lastLoginAt = user.updatedAt;

  // Rotate sessions after password change for better account safety.
  state.sessions = state.sessions.filter((session) => session.userId !== safeUserId);
  const nextSession = createSessionRecord(
    safeUserId,
    {
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    },
    config
  );
  state.sessions.push(nextSession.session);
  enforceSessionLimit(state, safeUserId, config.maxSessionsPerUser);
  await saveAuthState(config, state);

  return {
    user: toPublicUser(user),
    sessionToken: nextSession.token,
    sessionExpiresAt: nextSession.expiresAt,
  };
}

export async function addFavoriteJokeToUser(userId, jokeId) {
  const safeUserId = sanitizeId(userId, 80);
  const safeJokeId = sanitizeId(jokeId, 120);
  if (!safeUserId || !safeJokeId) {
    return { updated: false };
  }

  const config = getAuthConfig();
  const state = await getAuthState(config);
  const user = state.users.find((entry) => entry.id === safeUserId);
  if (!user) {
    return { updated: false };
  }

  const favorites = user.profile?.favorites || [];
  if (!favorites.includes(safeJokeId)) {
    favorites.push(safeJokeId);
    user.profile.favorites = normalizeUniqueIds(favorites, 500);
    user.stats.favoritesAdded = (Number(user.stats.favoritesAdded) || 0) + 1;
    user.updatedAt = new Date().toISOString();
    await saveAuthState(config, state);
    return { updated: true };
  }
  return { updated: false };
}

export async function addLikedJokeToUser(userId, jokeId) {
  const safeUserId = sanitizeId(userId, 80);
  const safeJokeId = sanitizeId(jokeId, 120);
  if (!safeUserId || !safeJokeId) {
    return { updated: false };
  }

  const config = getAuthConfig();
  const state = await getAuthState(config);
  const user = state.users.find((entry) => entry.id === safeUserId);
  if (!user) {
    return { updated: false };
  }

  const likedJokes = user.profile?.likedJokes || [];
  if (!likedJokes.includes(safeJokeId)) {
    likedJokes.push(safeJokeId);
    user.profile.likedJokes = normalizeUniqueIds(likedJokes, 500);
    user.stats.likesAdded = (Number(user.stats.likesAdded) || 0) + 1;
    user.updatedAt = new Date().toISOString();
    await saveAuthState(config, state);
    return { updated: true };
  }
  return { updated: false };
}

export async function incrementUserViewCount(userId) {
  const safeUserId = sanitizeId(userId, 80);
  if (!safeUserId) {
    return { updated: false };
  }
  const config = getAuthConfig();
  const state = await getAuthState(config);
  const user = state.users.find((entry) => entry.id === safeUserId);
  if (!user) {
    return { updated: false };
  }
  user.stats.jokeViews = (Number(user.stats.jokeViews) || 0) + 1;
  user.updatedAt = new Date().toISOString();
  await saveAuthState(config, state);
  return { updated: true };
}

export function toSafeAuthError(error) {
  const status = Number(error?.statusCode);
  const safeStatus =
    Number.isFinite(status) && status >= 400 && status <= 599 ? status : 500;
  const message =
    safeStatus >= 500
      ? "Authentication request failed."
      : sanitizeText(error?.message, 220) || "Authentication request failed.";
  return {
    status: safeStatus,
    body: {
      error: message,
      code: sanitizeId(error?.code || "", 80) || "AUTH_ERROR",
    },
  };
}
