export const PAYMENT_PROVIDERS = Object.freeze({
  STRIPE: "stripe",
  PAYPAL: "paypal",
  FUTURE: "future",
});

class BasePaymentProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  async createCheckoutSession() {
    return {
      ok: false,
      provider: this.providerName,
      checkoutUrl: "",
      sessionId: "",
      message: "Checkout is disabled.",
    };
  }

  async cancelCheckoutSession() {
    return {
      ok: false,
      provider: this.providerName,
      message: "Checkout cancellation is disabled.",
    };
  }
}

class StripeProvider extends BasePaymentProvider {
  constructor() {
    super(PAYMENT_PROVIDERS.STRIPE);
  }
}

class PayPalProvider extends BasePaymentProvider {
  constructor() {
    super(PAYMENT_PROVIDERS.PAYPAL);
  }
}

class FutureProvider extends BasePaymentProvider {
  constructor() {
    super(PAYMENT_PROVIDERS.FUTURE);
  }
}

export function createPaymentProviderRegistry() {
  return new Map([
    [PAYMENT_PROVIDERS.STRIPE, new StripeProvider()],
    [PAYMENT_PROVIDERS.PAYPAL, new PayPalProvider()],
    [PAYMENT_PROVIDERS.FUTURE, new FutureProvider()],
  ]);
}
