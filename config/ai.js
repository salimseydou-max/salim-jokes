const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_VIRAL_MAX_ITEMS = 10;

function sanitizeText(value, maxLength = 240) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toBoundedInt(value, fallback, min, max) {
  const parsed = toPositiveInt(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

export function getOpenRouterConfig() {
  const apiUrl = sanitizeText(process.env.OPENROUTER_API_URL) || DEFAULT_OPENROUTER_URL;
  const model = sanitizeText(process.env.OPENROUTER_MODEL, 80) || DEFAULT_OPENROUTER_MODEL;
  const timeoutMs = toPositiveInt(process.env.OPENROUTER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  return {
    apiKey: sanitizeText(process.env.OPENROUTER_API_KEY, 500),
    apiUrl,
    model,
    timeoutMs,
    appName: sanitizeText(process.env.OPENROUTER_APP_NAME, 80) || "Voice Joke Club",
    appUrl: sanitizeText(process.env.OPENROUTER_APP_URL, 200),
  };
}

export function getViralContentConfig() {
  const openRouter = getOpenRouterConfig();
  const apiUrl =
    sanitizeText(process.env.VIRAL_CONTENT_API_URL) ||
    sanitizeText(process.env.OPENROUTER_API_URL) ||
    DEFAULT_OPENROUTER_URL;
  const model =
    sanitizeText(process.env.VIRAL_CONTENT_MODEL, 80) ||
    sanitizeText(process.env.OPENROUTER_MODEL, 80) ||
    DEFAULT_OPENROUTER_MODEL;
  const timeoutMs = toPositiveInt(
    process.env.VIRAL_CONTENT_TIMEOUT_MS,
    toPositiveInt(process.env.OPENROUTER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  );
  return {
    apiKey:
      sanitizeText(process.env.VIRAL_CONTENT_API_KEY, 500) ||
      sanitizeText(process.env.OPENROUTER_API_KEY, 500),
    apiUrl,
    model,
    timeoutMs,
    maxItems: toBoundedInt(process.env.VIRAL_CONTENT_MAX_ITEMS, DEFAULT_VIRAL_MAX_ITEMS, 1, 30),
    appName: sanitizeText(process.env.VIRAL_CONTENT_APP_NAME, 80) || openRouter.appName,
    appUrl: sanitizeText(process.env.VIRAL_CONTENT_APP_URL, 200) || openRouter.appUrl,
  };
}
