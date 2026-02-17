import { readStorageValue, writeStorageValue } from "./storage.js";

const STORAGE_KEY = "vjc.verification.v1";
const CODE_TTL_MS = 10 * 60 * 1000;

function sanitizeText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeTarget(value) {
  return sanitizeText(value, 320).toLowerCase();
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  return {
    pending: state.pending && typeof state.pending === "object" ? state.pending : {},
    verified: state.verified && typeof state.verified === "object" ? state.verified : {},
  };
}

export function createVerificationService(options = {}) {
  const storageKey = options.storageKey || STORAGE_KEY;
  const transport =
    options.transport && typeof options.transport.sendCode === "function"
      ? options.transport
      : null;
  let state = normalizeState(readStorageValue(storageKey, {}, "local"));

  function persist() {
    writeStorageValue(storageKey, state, "local");
  }

  function makeKey(type, target) {
    return `${sanitizeText(type, 24)}:${normalizeTarget(target)}`;
  }

  async function requestCode(type, target) {
    const normalizedTarget = normalizeTarget(target);
    if (!normalizedTarget) {
      throw new Error(`Enter a valid ${type}.`);
    }
    const key = makeKey(type, normalizedTarget);
    const code = createCode();
    const expiresAt = Date.now() + CODE_TTL_MS;
    state.pending[key] = {
      type: sanitizeText(type, 24),
      target: normalizedTarget,
      code,
      expiresAt,
      requestedAt: Date.now(),
    };
    persist();
    if (transport) {
      try {
        await transport.sendCode({
          type,
          target: normalizedTarget,
          code,
          expiresAt,
        });
      } catch (error) {
        // Keep local verification available when transport is missing.
      }
    }
    return {
      type,
      target: normalizedTarget,
      code,
      expiresAt,
    };
  }

  function verifyCode(type, target, code) {
    const normalizedTarget = normalizeTarget(target);
    const key = makeKey(type, normalizedTarget);
    const pending = state.pending[key];
    if (!pending) {
      return false;
    }
    if (Date.now() > Number(pending.expiresAt)) {
      delete state.pending[key];
      persist();
      return false;
    }
    if (String(code || "").trim() !== String(pending.code)) {
      return false;
    }
    state.verified[key] = {
      type: pending.type,
      target: pending.target,
      verifiedAt: new Date().toISOString(),
    };
    delete state.pending[key];
    persist();
    return true;
  }

  function isVerified(type, target) {
    const key = makeKey(type, target);
    return Boolean(state.verified[key]);
  }

  function clearVerification(type, target) {
    const key = makeKey(type, target);
    delete state.pending[key];
    delete state.verified[key];
    persist();
  }

  return {
    requestCode,
    verifyCode,
    isVerified,
    clearVerification,
  };
}
