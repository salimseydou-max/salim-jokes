export const USER_PLANS = Object.freeze({
  FREE: "free",
  PREMIUM: "premium",
});

const PLAN_STORAGE_KEY = "vjc.user-plan.v1";
const DEFAULT_PLAN_RECORD = Object.freeze({
  plan: USER_PLANS.FREE,
  updatedAt: "",
});

function getLocalStorageSafe() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function normalizePlan(value) {
  return value === USER_PLANS.PREMIUM ? USER_PLANS.PREMIUM : USER_PLANS.FREE;
}

function parsePlanRecord(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return { ...DEFAULT_PLAN_RECORD };
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_PLAN_RECORD };
    }
    return {
      plan: normalizePlan(parsed.plan),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch (error) {
    return { ...DEFAULT_PLAN_RECORD };
  }
}

function savePlanRecord(record) {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(PLAN_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    // Ignore storage failures to keep UI responsive.
  }
}

export function getPlanRecord() {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return { ...DEFAULT_PLAN_RECORD };
  }
  return parsePlanRecord(storage.getItem(PLAN_STORAGE_KEY));
}

export function getCurrentUserPlan() {
  const record = getPlanRecord();
  return normalizePlan(record.plan);
}

export function setCurrentUserPlan(nextPlan) {
  const normalized = normalizePlan(nextPlan);
  const record = {
    plan: normalized,
    updatedAt: new Date().toISOString(),
  };
  savePlanRecord(record);
  return record;
}
