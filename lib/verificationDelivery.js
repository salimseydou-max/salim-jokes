import { getVerificationConfig } from "../config/verification.js";

function createDeliveryError(message, statusCode = 500, code = "VERIFICATION_DELIVERY_FAILED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizePhoneNumber(value) {
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function createMaskedTarget(type, target) {
  if (type === "email") {
    const [left = "", right = ""] = String(target || "").split("@");
    const visibleLeft = left.slice(0, 2);
    return `${visibleLeft}${"*".repeat(Math.max(0, left.length - visibleLeft.length))}@${right}`;
  }
  const digits = String(target || "").replace(/\D/g, "");
  const suffix = digits.slice(-4);
  return `***${suffix}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw createDeliveryError(
        "Verification provider timed out. Please try again.",
        504,
        "VERIFICATION_PROVIDER_TIMEOUT"
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizePayload(input = {}) {
  const type = sanitizeText(input.type, 20).toLowerCase();
  const code = sanitizeText(input.code, 12);
  const expiresAtMs = Number(input.expiresAt);
  if (type !== "email" && type !== "phone") {
    throw createDeliveryError(
      "Verification channel must be email or phone.",
      400,
      "VERIFICATION_INVALID_TYPE"
    );
  }
  if (!/^\d{4,8}$/.test(code)) {
    throw createDeliveryError(
      "Verification code is invalid.",
      400,
      "VERIFICATION_INVALID_CODE"
    );
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw createDeliveryError(
      "Verification expiration is invalid.",
      400,
      "VERIFICATION_INVALID_EXPIRY"
    );
  }

  if (type === "email") {
    const email = sanitizeText(input.target, 320).toLowerCase();
    if (!isValidEmail(email)) {
      throw createDeliveryError(
        "Please enter a valid email address.",
        400,
        "VERIFICATION_INVALID_EMAIL"
      );
    }
    return {
      type,
      target: email,
      code,
      expiresAtMs,
    };
  }

  const phone = sanitizePhoneNumber(input.target);
  if (!phone) {
    throw createDeliveryError(
      "Please enter a valid phone number.",
      400,
      "VERIFICATION_INVALID_PHONE"
    );
  }
  return {
    type,
    target: phone,
    code,
    expiresAtMs,
  };
}

function buildMessages(config, payload) {
  const expiresInMin = Math.max(1, Math.round((payload.expiresAtMs - Date.now()) / 60000));
  const subject = `${config.appName} verification code`;
  const text = `Your ${config.appName} verification code is ${payload.code}. It expires in ${expiresInMin} minute(s).`;
  const html =
    `<p>Your <strong>${config.appName}</strong> verification code is <strong>${payload.code}</strong>.</p>` +
    `<p>This code expires in ${expiresInMin} minute(s).</p>`;
  const smsText = `${config.appName} code: ${payload.code}. Expires in ${expiresInMin} min.`;
  return {
    subject,
    text,
    html,
    smsText,
  };
}

async function sendEmailWithResend(config, target, messages) {
  const response = await fetchWithTimeout(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [target],
        subject: messages.subject,
        text: messages.text,
        html: messages.html,
      }),
    },
    config.timeoutMs
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createDeliveryError(
      data?.message || data?.error || "Email delivery failed.",
      502,
      "VERIFICATION_EMAIL_FAILED"
    );
  }
  return {
    provider: "resend",
    messageId: sanitizeText(data?.id, 120),
  };
}

async function sendEmailWithSendgrid(config, target, messages) {
  const response = await fetchWithTimeout(
    "https://api.sendgrid.com/v3/mail/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: target }],
          },
        ],
        from: { email: config.fromEmail },
        subject: messages.subject,
        content: [
          { type: "text/plain", value: messages.text },
          { type: "text/html", value: messages.html },
        ],
      }),
    },
    config.timeoutMs
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw createDeliveryError(
      data?.errors?.[0]?.message || "Email delivery failed.",
      502,
      "VERIFICATION_EMAIL_FAILED"
    );
  }
  return {
    provider: "sendgrid",
    messageId: sanitizeText(response.headers.get("x-message-id"), 160),
  };
}

async function sendSmsWithTwilio(config, target, smsText) {
  const authToken = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString(
    "base64"
  );
  const response = await fetchWithTimeout(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      config.twilioAccountSid
    )}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: target,
        From: config.twilioFromNumber,
        Body: smsText,
      }),
    },
    config.timeoutMs
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createDeliveryError(
      data?.message || "SMS delivery failed.",
      502,
      "VERIFICATION_SMS_FAILED"
    );
  }
  return {
    provider: "twilio",
    messageId: sanitizeText(data?.sid, 120),
  };
}

function ensureEmailProviderConfigured(config) {
  if (config.resendApiKey && config.fromEmail) {
    return "resend";
  }
  if (config.sendgridApiKey && config.fromEmail) {
    return "sendgrid";
  }
  return "";
}

function ensureSmsProviderConfigured(config) {
  if (config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber) {
    return "twilio";
  }
  return "";
}

export async function deliverVerificationCode(input = {}) {
  const config = getVerificationConfig();
  const payload = normalizePayload(input);
  const messages = buildMessages(config, payload);
  const maskedTarget = createMaskedTarget(payload.type, payload.target);

  if (payload.type === "email") {
    const provider = ensureEmailProviderConfigured(config);
    if (!provider) {
      if (config.allowMockDelivery) {
        return {
          delivered: true,
          mock: true,
          provider: "mock",
          type: payload.type,
          target: payload.target,
          maskedTarget,
          ...(config.exposeMockCode ? { code: payload.code } : {}),
        };
      }
      throw createDeliveryError(
        "Email delivery is not configured. Set RESEND_API_KEY or SENDGRID_API_KEY and VERIFICATION_FROM_EMAIL.",
        503,
        "VERIFICATION_EMAIL_NOT_CONFIGURED"
      );
    }
    const result =
      provider === "resend"
        ? await sendEmailWithResend(config, payload.target, messages)
        : await sendEmailWithSendgrid(config, payload.target, messages);
    return {
      delivered: true,
      mock: false,
      provider: result.provider,
      type: payload.type,
      target: payload.target,
      maskedTarget,
      messageId: result.messageId,
    };
  }

  const smsProvider = ensureSmsProviderConfigured(config);
  if (!smsProvider) {
    if (config.allowMockDelivery) {
      return {
        delivered: true,
        mock: true,
        provider: "mock",
        type: payload.type,
        target: payload.target,
        maskedTarget,
        ...(config.exposeMockCode ? { code: payload.code } : {}),
      };
    }
    throw createDeliveryError(
      "SMS delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
      503,
      "VERIFICATION_SMS_NOT_CONFIGURED"
    );
  }
  const result = await sendSmsWithTwilio(config, payload.target, messages.smsText);
  return {
    delivered: true,
    mock: false,
    provider: result.provider,
    type: payload.type,
    target: payload.target,
    maskedTarget,
    messageId: result.messageId,
  };
}

export function toSafeVerificationDeliveryError(error) {
  const status = Number(error?.statusCode);
  const safeStatus = Number.isFinite(status) && status >= 400 && status <= 599 ? status : 500;
  const safeMessage =
    safeStatus >= 500
      ? "Verification delivery failed."
      : sanitizeText(error?.message, 220) || "Verification delivery failed.";
  return {
    status: safeStatus,
    body: {
      success: false,
      error: safeMessage,
      code: sanitizeText(error?.code, 80) || "VERIFICATION_DELIVERY_FAILED",
    },
  };
}
