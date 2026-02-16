import { featureFlags } from "../config/featureFlags.js";

export class BillingSystem {
  constructor({ paymentGateway }) {
    this.paymentGateway = paymentGateway;
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
    return invoice;
  }

  async beginCheckout(invoice, options = {}) {
    if (!featureFlags.monetizationEnabled || !featureFlags.paymentCheckoutEnabled) {
      return {
        ok: false,
        enabled: false,
        invoiceId: invoice?.id || "",
        message: "Billing checkout is disabled by feature flags.",
      };
    }
    return this.paymentGateway.createCheckoutSession({
      provider: options.provider,
      invoiceId: invoice.id,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
    });
  }

  markInvoicePaid(invoiceId) {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      return null;
    }
    invoice.status = "paid";
    invoice.updatedAt = new Date().toISOString();
    return { ...invoice };
  }

  getInvoice(invoiceId) {
    const invoice = this.invoices.get(invoiceId);
    return invoice ? { ...invoice } : null;
  }
}
