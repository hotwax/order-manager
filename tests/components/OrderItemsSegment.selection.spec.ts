import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import OrderItemsSegment from '@/components/orders/OrderItemsSegment.vue';

vi.mock('@common', () => ({
  commonUtil: { formatCurrency: (value: number) => String(value), parseDateTimeValue: () => null },
  translate: (value: string) => value,
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  return {
    IonAccordion: component,
    IonAccordionGroup: component,
    IonButton: component,
    IonCard: component,
    IonCardHeader: component,
    IonCardSubtitle: component,
    IonCardTitle: component,
    IonCheckbox: { template: '<div class="select-all"><slot /></div>' },
    IonItem: component,
    IonItemDivider: component,
    IonLabel: component,
    IonList: component,
  };
});

vi.mock('@/composables/useProductIdentity', () => ({
  useProductIdentity: () => ({ getProduct: () => null, primaryIdentifier: () => '', secondaryIdentifier: () => '', featureLabel: () => '' }),
}));

vi.mock('@/utils', () => ({ isKit: () => false }));

// Stand-in for the row, exposing whether it can be selected.
vi.mock('@/components/orders/OrderItemListRow.vue', () => ({
  default: { props: ['selectable', 'primary'], template: '<div class="row" :data-selectable="String(selectable)"><slot name="actions" /></div>' },
}));

const item = (orderItemSeqId: string) => ({
  orderItemSeqId, shipGroupSeqId: '00001', quantity: 1, unitPrice: 10, facilityName: 'Store',
  attributeCount: 0, statuses: [], adjustments: [], statusId: 'ITEM_COMPLETED',
});

function orderWith(statusId: string) {
  return {
    id: 'O1',
    statusId,
    currency: 'USD',
    // One sole-item group and one rolled up group, so both row shapes are covered.
    groupedItems: [
      { externalId: 'A', productId: 'P1', items: [item('01')] },
      { externalId: 'B', productId: 'P2', items: [item('02'), item('03')], totalQty: 2, totalPrice: 20, locationLabel: 'Store', statuses: [], adjustments: [] },
    ],
    payments: { list: [], sections: [], netAmount: 0, receivedTotal: 0 },
    totals: { subtotal: 0, adjustmentRows: [], total: 0 },
  };
}

const mountFor = (statusId: string) => mount(OrderItemsSegment, {
  props: { order: orderWith(statusId) as any, selectedItemIds: new Set<string>(), itemActions: {}, paymentReturnIds: {} },
});

describe('order items selection', () => {
  it.each(['ORDER_COMPLETED', 'ORDER_CANCELLED'])('offers no selection on a %s order', (statusId) => {
    const wrapper = mountFor(statusId);

    expect(wrapper.find('.order-items-toolbar').exists()).toBe(false);
    const rows = wrapper.findAll('.row');
    expect(rows).toHaveLength(4); // sole item, group header and its two items
    expect(rows.every((row) => row.attributes('data-selectable') === 'false')).toBe(true);
  });

  it('keeps selection on an open order, with Add items left to the page footer', () => {
    const wrapper = mountFor('ORDER_APPROVED');

    expect(wrapper.find('.order-items-toolbar').exists()).toBe(true);
    expect(wrapper.find('.order-items-toolbar').text()).not.toContain('Add items');
    expect(wrapper.findAll('.row').every((row) => row.attributes('data-selectable') === 'true')).toBe(true);
  });
});
