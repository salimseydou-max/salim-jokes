const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_FROM_EMAIL = "no-reply@voicejokeclub.app";
const DEFAULT_APP_NAME = "Voice Joke Club";

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

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function sanitizeText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function getVerificationConfig() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    appName: sanitizeText(process.env.VERIFICATION_APP_NAME || DEFAULT_APP_NAME, 80) || DEFAULT_APP_NAME,
    fromEmail:
      sanitizeText(process.env.VERIFICATION_FROM_EMAIL || DEFAULT_FROM_EMAIL, 320) ||
      DEFAULT_FROM_EMAIL,
    timeoutMs: toPositiveInt(process.env.VERIFICATION_DELIVERY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    allowMockDelivery: toBoolean(process.env.VERIFICATION_ALLOW_MOCK_DELIVERY, !isProd),
    exposeMockCode: toBoolean(process.env.VERIFICATION_EXPOSE_MOCK_CODE, false),
    resendApiKey: sanitizeText(process.env.RESEND_API_KEY, 500),
    sendgridApiKey: sanitizeText(process.env.SENDGRID_API_KEY, 500),
    twilioAccountSid: sanitizeText(process.env.TWILIO_ACCOUNT_SID, 120),
    twilioAuthToken: sanitizeText(process.env.TWILIO_AUTH_TOKEN, 240),
    twilioFromNumber: sanitizeText(process.env.TWILIO_FROM_NUMBER, 40),
  };
}
