import { getCurrentUserPlan, USER_PLANS } from "./planStore.js";

export const PLAN_PERMISSIONS = Object.freeze({
  [USER_PLANS.FREE]: Object.freeze([
    "feed.read",
    "joke.submit",
    "joke.favorite",
    "joke.share",
  ]),
  [USER_PLANS.PREMIUM]: Object.freeze([
    "feed.read",
    "joke.submit",
    "joke.favorite",
    "joke.share",
    "premium.access",
    "premium.priority_feed",
    "premium.offline_pack",
  ]),
});

export function getPermissionsForPlan(plan = getCurrentUserPlan()) {
  const normalizedPlan = plan === USER_PLANS.PREMIUM ? USER_PLANS.PREMIUM : USER_PLANS.FREE;
  return PLAN_PERMISSIONS[normalizedPlan] || PLAN_PERMISSIONS[USER_PLANS.FREE];
}

export function hasPermission(permission, plan = getCurrentUserPlan()) {
  if (!permission || typeof permission !== "string") {
    return false;
  }
  return getPermissionsForPlan(plan).includes(permission);
}
