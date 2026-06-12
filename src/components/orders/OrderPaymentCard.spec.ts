import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order payment card', () => {
  it('keeps payment rows in a reusable Ionic card', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/orders/OrderPaymentCard.vue'), 'utf8');

    expect(source).toContain('<ion-card>');
    expect(source).toContain("<ion-card-title>{{ translate('Payment') }}</ion-card-title>");
    expect(source).toContain('<ion-item v-for="(payment, index) in payments"');
    expect(source).toContain('<p class="overline">{{ payment.paymentMethodTypeId || payment.method }}</p>');
    expect(source).toContain("<ion-item v-if=\"!payments.length\">");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
