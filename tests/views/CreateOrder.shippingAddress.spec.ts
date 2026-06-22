import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('create order shipping address modal', () => {
  it('passes the address prop expected by the modal and stores the confirmed result', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/CreateOrder.vue'), 'utf8');
    const modalStart = source.indexOf('async function openShippingAddressModal');
    const modalSource = source.slice(modalStart, source.indexOf('async function openCustomLineModal', modalStart));

    expect(modalSource).toContain('customerAddress: { ...orderForm.value.shippingAddress }');
    expect(modalSource).toContain('const { data } = await addressModal.onWillDismiss();');
    expect(modalSource).toContain('if (data?.address)');
    expect(modalSource).toContain('orderForm.value.shippingAddress = {');
    expect(modalSource).toContain('...data.address');
  });
});
