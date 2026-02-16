import { featureFlags } from "../../config/featureFlags.js";
import { hasPlanPermission } from "./permissions.js";
import { getUserPlan, USER_PLANS } from "./planManager.js";

const PREMIUM_FEATURE_PERMISSION_MAP = Object.freeze({
  premiumFeedBoost: "premium.priority_feed",
  offlineCollections: "premium.offline_pack",
  highFidelityNarration: "premium.access",
});

export function canAccessPremiumFeature(userId, featureKey) {
  if (!featureFlags.monetizationEnabled || !featureFlags.premiumFeaturesVisible) {
    return false;
  }
  const plan = getUserPlan(userId);
  if (plan !== USER_PLANS.PREMIUM) {
    return false;
  }
  const permission = PREMIUM_FEATURE_PERMISSION_MAP[featureKey] || "premium.access";
  return hasPlanPermission(plan, permission);
}

export function canIncludePremiumContent(userId) {
  return canAccessPremiumFeature(userId, "premiumFeedBoost");
}
