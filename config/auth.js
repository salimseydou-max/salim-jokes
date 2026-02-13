const DEFAULT_AUTH_STORAGE_FILE = "/tmp/jokes-auth.json";
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PASSWORD_MIN_LENGTH = 8;
const DEFAULT_MAX_SESSIONS_PER_USER = 6;
const DEFAULT_SESSION_COOKIE_NAME = "joke_auth_session";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function getAuthConfig() {
  const secureByDefault = process.env.NODE_ENV === "production";
  return {
    authStorageFile: (process.env.AUTH_STORAGE_FILE || DEFAULT_AUTH_STORAGE_FILE).trim(),
    sessionTtlMs: toPositiveInt(process.env.AUTH_SESSION_TTL_MS, DEFAULT_SESSION_TTL_MS),
    passwordMinLength: toPositiveInt(
      process.env.AUTH_PASSWORD_MIN_LENGTH,
      DEFAULT_PASSWORD_MIN_LENGTH
    ),
    maxSessionsPerUser: toPositiveInt(
      process.env.AUTH_MAX_SESSIONS_PER_USER,
      DEFAULT_MAX_SESSIONS_PER_USER
    ),
    sessionCookieName:
      (process.env.AUTH_SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE_NAME).trim() ||
      DEFAULT_SESSION_COOKIE_NAME,
    secureCookies: toBoolean(process.env.AUTH_SECURE_COOKIES, secureByDefault),
  };
}
