import { featureFlags } from "../config/featureFlags.js";
import {
  PAYMENT_PROVIDERS,
  createPaymentProviderRegistry,
} from "./paymentProviders.js";

export class PaymentGateway {
  constructor(registry = createPaymentProviderRegistry()) {
    this.registry = registry;
  }

  registerProvider(name, providerAdapter) {
    if (!name || !providerAdapter) {
      return;
    }
    this.registry.set(name, providerAdapter);
  }

  getProvider(name) {
    return (
      this.registry.get(name) ||
      this.registry.get(PAYMENT_PROVIDERS.FUTURE)
    );
  }

  async createCheckoutSession(request = {}) {
    if (!featureFlags.monetizationEnabled || !featureFlags.paymentCheckoutEnabled) {
      return {
        ok: false,
        enabled: false,
        provider: request.provider || PAYMENT_PROVIDERS.STRIPE,
        checkoutUrl: "",
        sessionId: "",
        message: "Payment checkout is disabled by feature flags.",
      };
    }
    const provider = this.getProvider(request.provider || PAYMENT_PROVIDERS.STRIPE);
    return provider.createCheckoutSession(request);
  }

  async cancelCheckoutSession(request = {}) {
    if (!featureFlags.monetizationEnabled || !featureFlags.paymentCheckoutEnabled) {
      return {
        ok: false,
        enabled: false,
        provider: request.provider || PAYMENT_PROVIDERS.STRIPE,
        message: "Payment checkout is disabled by feature flags.",
      };
    }
    const provider = this.getProvider(request.provider || PAYMENT_PROVIDERS.STRIPE);
    return provider.cancelCheckoutSession(request);
  }
}

export function createDefaultPaymentGateway() {
  return new PaymentGateway(createPaymentProviderRegistry());
}
