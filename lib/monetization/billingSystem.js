import { featureFlags } from "../../config/featureFlags.js";
import {
  createPaymentProviderRegistry,
  PAYMENT_PROVIDERS,
} from "./paymentProviders.js";

export class BillingSystem {
  constructor(registry = createPaymentProviderRegistry()) {
    this.providers = registry;
    this.invoices = new Map();
  }

  createInvoice(input = {}) {
    const now = Date.now();
    const invoice = {
      id: `invoice_${now}_${Math.random().toString(36).slice(2, 8)}`,
      userId: String(input.userId || "anonymous"),
      plan: String(input.plan || "free"),
      amountCents: Number(input.amountCents) || 0,
      currency: String(input.currency || "USD"),
      status: "draft",
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
    this.invoices.set(invoice.id, invoice);
    return { ...invoice };
  }

  getProvider(name) {
    return (
      this.providers.get(name) ||
      this.providers.get(PAYMENT_PROVIDERS.STRIPE) ||
      this.providers.get(PAYMENT_PROVIDERS.FUTURE)
    );
  }

  async beginCheckout(invoice, options = {}) {
    if (!featureFlags.monetizationEnabled || !featureFlags.paymentCheckoutEnabled) {
      return {
        ok: false,
        enabled: false,
        invoiceId: invoice?.id || "",
        checkoutUrl: "",
        sessionId: "",
        message: "Billing checkout is disabled by feature flags.",
      };
    }
    const provider = this.getProvider(options.provider || PAYMENT_PROVIDERS.STRIPE);
    return provider.createCheckoutSession({
      invoiceId: invoice.id,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
    });
  }
}
