import { featureFlags } from "../config/featureFlags.js";
import {
  getCurrentUserPlan,
  setCurrentUserPlan,
  USER_PLANS,
} from "./planStore.js";

export class SubscriptionManager {
  constructor({ billingSystem }) {
    this.billingSystem = billingSystem;
  }

  getStatus() {
    return {
      plan: getCurrentUserPlan(),
      monetizationEnabled: featureFlags.monetizationEnabled,
      premiumFeaturesVisible: featureFlags.premiumFeaturesVisible,
      paymentCheckoutEnabled: featureFlags.paymentCheckoutEnabled,
    };
  }

  async upgradeToPremium(input = {}) {
    if (!featureFlags.monetizationEnabled || !featureFlags.paymentCheckoutEnabled) {
      return {
        ok: false,
        enabled: false,
        plan: getCurrentUserPlan(),
        message: "Subscriptions are disabled by feature flags.",
      };
    }
    const invoice = this.billingSystem.createInvoice({
      userId: input.userId,
      plan: USER_PLANS.PREMIUM,
      amountCents: Number(input.amountCents) || 0,
      currency: String(input.currency || "USD"),
    });
    return this.billingSystem.beginCheckout(invoice, { provider: input.provider });
  }

  async downgradeToFree() {
    const record = setCurrentUserPlan(USER_PLANS.FREE);
    return {
      ok: true,
      plan: record.plan,
      updatedAt: record.updatedAt,
      message: "Plan updated locally.",
    };
  }
}
