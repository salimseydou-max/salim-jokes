import { featureFlags } from "../../config/featureFlags.js";
import { BillingSystem } from "./billingSystem.js";
import { ensureDefaultUserPlan, setUserPlan, USER_PLANS } from "./planManager.js";

const DEFAULT_PREMIUM_PRICE_CENTS = 0;

export class SubscriptionManager {
  constructor(billingSystem = new BillingSystem()) {
    this.billingSystem = billingSystem;
  }

  getStatus(userId) {
    return {
      plan: ensureDefaultUserPlan(userId),
      monetizationEnabled: featureFlags.monetizationEnabled,
      premiumFeaturesVisible: featureFlags.premiumFeaturesVisible,
      paymentCheckoutEnabled: featureFlags.paymentCheckoutEnabled,
    };
  }

  async requestPremiumUpgrade(userId, options = {}) {
    ensureDefaultUserPlan(userId);
    if (!featureFlags.monetizationEnabled || !featureFlags.paymentCheckoutEnabled) {
      return {
        ok: false,
        enabled: false,
        plan: USER_PLANS.FREE,
        message: "Subscriptions are disabled by feature flags.",
      };
    }
    const invoice = this.billingSystem.createInvoice({
      userId,
      plan: USER_PLANS.PREMIUM,
      amountCents: Number(options.amountCents) || DEFAULT_PREMIUM_PRICE_CENTS,
      currency: String(options.currency || "USD"),
    });
    return this.billingSystem.beginCheckout(invoice, {
      provider: options.provider,
    });
  }

  async downgradeToFree(userId) {
    const plan = setUserPlan(userId, USER_PLANS.FREE);
    return {
      ok: true,
      plan,
      message: "Plan changed to free.",
    };
  }
}
