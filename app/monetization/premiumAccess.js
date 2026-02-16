import { featureFlags } from "../config/featureFlags.js";
import { hasPermission } from "./permissions.js";
import { getCurrentUserPlan, USER_PLANS } from "./planStore.js";

const PREMIUM_FEATURE_PERMISSION_MAP = Object.freeze({
  advancedFeedFilters: "premium.priority_feed",
  expandedSavedCollections: "premium.offline_pack",
  immersiveAudioNarration: "premium.access",
});

export function canAccessPremiumFeature(featureKey, options = {}) {
  if (!featureFlags.monetizationEnabled || !featureFlags.premiumFeaturesVisible) {
    return false;
  }
  const plan = options.plan || getCurrentUserPlan();
  if (plan !== USER_PLANS.PREMIUM) {
    return false;
  }
  const permission = PREMIUM_FEATURE_PERMISSION_MAP[featureKey] || "premium.access";
  return hasPermission(permission, plan);
}
