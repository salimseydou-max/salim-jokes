import { featureFlags } from "../../config/featureFlags.js";

export const USER_PLANS = Object.freeze({
  FREE: "free",
  PREMIUM: "premium",
});

const runtime =
  globalThis.__VJC_PLAN_RUNTIME__ ||
  {
    userPlans: new Map(),
  };

if (!globalThis.__VJC_PLAN_RUNTIME__) {
  globalThis.__VJC_PLAN_RUNTIME__ = runtime;
}

function normalizeUserId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_\-:.]/g, "").slice(0, 120);
}

function normalizePlan(value) {
  return value === USER_PLANS.PREMIUM ? USER_PLANS.PREMIUM : USER_PLANS.FREE;
}

export function getUserPlan(userId) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return USER_PLANS.FREE;
  }
  const currentPlan = runtime.userPlans.get(safeUserId);
  return normalizePlan(currentPlan);
}

export function setUserPlan(userId, plan) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return USER_PLANS.FREE;
  }
  const normalizedPlan = normalizePlan(plan);
  if (!featureFlags.monetizationEnabled && normalizedPlan === USER_PLANS.PREMIUM) {
    runtime.userPlans.set(safeUserId, USER_PLANS.FREE);
    return USER_PLANS.FREE;
  }
  runtime.userPlans.set(safeUserId, normalizedPlan);
  return normalizedPlan;
}

export function ensureDefaultUserPlan(userId) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return USER_PLANS.FREE;
  }
  if (!runtime.userPlans.has(safeUserId)) {
    runtime.userPlans.set(safeUserId, USER_PLANS.FREE);
  }
  return getUserPlan(safeUserId);
}
