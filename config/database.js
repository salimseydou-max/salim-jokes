const DEFAULT_CACHE_TTL_MS = 30000;
const DEFAULT_QUERY_LIMIT = 20;
const DEFAULT_MAX_QUERY_LIMIT = 100;
const DEFAULT_STORAGE_FILE = "/tmp/jokes-database.json";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeApiUrl(value) {
  if (!value) {
    return "";
  }
  return String(value).trim().replace(/\/+$/, "");
}

function createConfigError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getDatabaseConfig() {
  return {
    apiKey: (process.env.DATABASE_API_KEY || "").trim(),
    apiUrl: normalizeApiUrl(process.env.DATABASE_API_URL || ""),
    storageFile: (process.env.DATABASE_STORAGE_FILE || DEFAULT_STORAGE_FILE).trim(),
    cacheTtlMs: toPositiveInt(process.env.DATABASE_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS),
    defaultQueryLimit: toPositiveInt(process.env.DATABASE_QUERY_LIMIT, DEFAULT_QUERY_LIMIT),
    maxQueryLimit: toPositiveInt(process.env.DATABASE_MAX_QUERY_LIMIT, DEFAULT_MAX_QUERY_LIMIT),
  };
}

export function ensureDatabaseConfig() {
  const config = getDatabaseConfig();
  if (!config.apiKey) {
    throw createConfigError("Database is not configured");
  }
  return config;
}

export function getDatabaseAuthHeaders(extraHeaders = {}) {
  const config = ensureDatabaseConfig();
  return {
    ...extraHeaders,
    Authorization: `Bearer ${config.apiKey}`,
    "x-api-key": config.apiKey,
  };
}

export function createSafeDatabaseError(message, statusCode = 500) {
  return createConfigError(message, statusCode);
}
