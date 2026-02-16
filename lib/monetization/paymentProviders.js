export const PAYMENT_PROVIDERS = Object.freeze({
  STRIPE: "stripe",
  PAYPAL: "paypal",
  FUTURE: "future",
});

class BasePaymentProvider {
  constructor(name) {
    this.name = name;
  }

  async createCheckoutSession() {
    return {
      ok: false,
      provider: this.name,
      sessionId: "",
      checkoutUrl: "",
      message: "Checkout is disabled.",
    };
  }

  async verifyWebhook() {
    return {
      ok: false,
      provider: this.name,
      message: "Webhook validation is disabled.",
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
