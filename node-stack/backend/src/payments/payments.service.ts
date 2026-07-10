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
}
