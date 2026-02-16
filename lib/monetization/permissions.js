import { USER_PLANS } from "./planManager.js";

const PLAN_PERMISSIONS = Object.freeze({
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

export function getPermissionsForPlan(plan) {
  return PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS[USER_PLANS.FREE];
}

export function hasPlanPermission(plan, permission) {
  if (!permission || typeof permission !== "string") {
    return false;
  }
  return getPermissionsForPlan(plan).includes(permission);
}
