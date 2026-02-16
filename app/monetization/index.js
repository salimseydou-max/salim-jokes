import { featureFlags, getFeatureFlags } from "../config/featureFlags.js";
import { BillingSystem } from "./billingSystem.js";
import { createDefaultPaymentGateway } from "./paymentGateway.js";
import { hasPermission } from "./permissions.js";
import { canAccessPremiumFeature } from "./premiumAccess.js";
import { getCurrentUserPlan } from "./planStore.js";
import { SubscriptionManager } from "./subscriptionManager.js";

export function createMonetizationInfrastructure() {
  const paymentGateway = createDefaultPaymentGateway();
  const billingSystem = new BillingSystem({ paymentGateway });
  const subscriptionManager = new SubscriptionManager({ billingSystem });

  return Object.freeze({
    featureFlags,
    getFeatureFlags,
    paymentGateway,
    billingSystem,
    subscriptionManager,
    getCurrentUserPlan,
    hasPermission,
    canAccessPremiumFeature,
  });
}
