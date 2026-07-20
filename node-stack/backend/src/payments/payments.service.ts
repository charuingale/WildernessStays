import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Payment abstraction. When STRIPE_SECRET_KEY is configured, charges are
 * created against Stripe's PaymentIntents API (via raw fetch to avoid a
 * hard dependency); otherwise a mock reference is issued so the demo
 * works end-to-end without credentials.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripeKey = process.env.STRIPE_SECRET_KEY;

  async charge(amountCad: number, description: string): Promise<{ ref: string; provider: string }> {
    if (!this.stripeKey) {
      // Fail closed in production unless mock mode is explicitly allowed.
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
        throw new Error('Payments are not configured (set STRIPE_SECRET_KEY or ALLOW_MOCK_PAYMENTS=true)');
      }
      const ref = `mock_pi_${randomUUID().slice(0, 12)}`;
      this.logger.log(`Mock payment of CAD ${amountCad.toFixed(2)} — ${ref}`);
      return { ref, provider: 'mock' };
    }
    const body = new URLSearchParams({
      amount: String(Math.round(amountCad * 100)),
      currency: 'cad',
      description,
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
    });
    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Stripe error: ${err}`);
      throw new Error('Payment processing failed');
    }
    const intent = (await res.json()) as { id: string };
    return { ref: intent.id, provider: 'stripe' };
  }

  /**
   * Refund (part of) a charge. Mock mode issues a mock reference.
   * `operationId` becomes Stripe's idempotency key so retries can't double-refund.
   */
  async refund(amountCad: number, paymentRef: string, operationId?: string): Promise<{ ref: string; provider: string }> {
    if (amountCad <= 0) return { ref: 'no_refund_due', provider: 'none' };
    if (!this.stripeKey || !paymentRef || paymentRef.startsWith('mock_')) {
      const ref = `mock_re_${randomUUID().slice(0, 12)}`;
      this.logger.log(`Mock refund of CAD ${amountCad.toFixed(2)} for ${paymentRef} — ${ref}`);
      return { ref, provider: 'mock' };
    }
    const body = new URLSearchParams({
      payment_intent: paymentRef,
      amount: String(Math.round(amountCad * 100)),
    });
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
      body,
    });
    if (!res.ok) {
      this.logger.error(`Stripe refund error: ${await res.text()}`);
      throw new Error('Refund processing failed');
    }
    const refund = (await res.json()) as { id: string };
    return { ref: refund.id, provider: 'stripe' };
  }
}
