import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import OrderItemTransferChip from '@/components/orders/OrderItemTransferChip.vue';
import type { EnrichedTransfer } from '@/types/orderDetail';

vi.mock('@common', () => ({
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  return { IonChip: { emits: ['click'], template: '<button class="chip" @click="$emit(\'click\', $event)"><slot /></button>' }, IonIcon: component, IonLabel: component };
});

const transfer = (statusId: string, from: string, isOpen: boolean) =>
  ({ id: from, statusId, isOpen, fromFacilityName: from }) as EnrichedTransfer;
const label = (transfers: EnrichedTransfer[]) => mount(OrderItemTransferChip, { props: { transfers } }).text();

describe('order item transfer chip', () => {
  it('names where an open transfer is coming from, ahead of older ones', () => {
    expect(label([transfer('IXF_CANCELLED', 'Old store', false), transfer('IXF_REQUESTED', '2301 E. 51st St.', true)])).toBe('Transfer from 2301 E. 51st St.');
  });

  it('says where the stock came from once a transfer is complete', () => {
    expect(label([transfer('IXF_COMPLETE', 'Nashville', false), transfer('IXF_CANCELLED', 'Austin', false)])).toBe('Transferred from Nashville');
  });

  it('says the transfer was cancelled when that is all there is', () => {
    expect(label([transfer('IXF_CANCELLED', 'Austin', false)])).toBe('Transfer cancelled');
  });

  it('shows nothing for an item without transfers', () => {
    expect(mount(OrderItemTransferChip, { props: { transfers: [] } }).find('.chip').exists()).toBe(false);
  });

  it('asks for the details when tapped', async () => {
    const wrapper = mount(OrderItemTransferChip, { props: { transfers: [transfer('IXF_REQUESTED', 'Nashville', true)] } });
    await wrapper.find('.chip').trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });
});
