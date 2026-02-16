import { featureFlags } from "../../config/featureFlags.js";
import { BillingSystem } from "./billingSystem.js";
import { canAccessPremiumFeature, canIncludePremiumContent } from "./premiumAccess.js";
import { ensureDefaultUserPlan, getUserPlan, setUserPlan } from "./planManager.js";
import { hasPlanPermission } from "./permissions.js";
import { SubscriptionManager } from "./subscriptionManager.js";

const billingSystem = new BillingSystem();
const subscriptionManager = new SubscriptionManager(billingSystem);

export function createMonetizationRuntime() {
  return {
    featureFlags,
    billingSystem,
    subscriptionManager,
    ensureDefaultUserPlan,
    getUserPlan,
    setUserPlan,
    hasPlanPermission,
    canAccessPremiumFeature,
    canIncludePremiumContent,
  };
}
