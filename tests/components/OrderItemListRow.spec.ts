import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import OrderItemListRow from '@/components/orders/OrderItemListRow.vue';

vi.mock('@common', () => ({ DxpShopifyImg: { template: '<img />' }, translate: (value: string) => value }));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  return {
    IonBadge: component,
    IonCheckbox: {
      props: ['checked'],
      emits: ['ionChange'],
      template: '<input type="checkbox" class="checkbox" :checked="checked" @change="$emit(\'ionChange\', { detail: { checked: $event.target.checked } })" />',
    },
    IonChip: component,
    IonIcon: component,
    IonItem: component,
    IonLabel: component,
    IonNote: component,
    IonThumbnail: component,
  };
});

const mountRow = (props: Record<string, unknown> = {}) =>
  mount(OrderItemListRow, { props: { primary: 'SKU-1', quantity: 2, quantityLabel: 'qty', amount: '$20.00', ...props } });

describe('order item list row', () => {
  it('shows the ordered quantity at the end of the product item, not in a column of its own', () => {
    const wrapper = mountRow();

    expect(wrapper.find('.order-item-list-key [slot="end"]').text()).toMatch(/^2\s+qty$/);
    // Product, details, status and amount: the four columns the row's grid is sized for. Item
    // actions live in the page footer, so no row carries an actions column.
    expect(wrapper.element.children).toHaveLength(4);
  });

  it('selects only from the checkbox, not from a click anywhere on the product item', async () => {
    const wrapper = mountRow();

    await wrapper.find('.order-item-list-key').trigger('click');
    expect(wrapper.emitted('update:selected')).toBeUndefined();
    expect(wrapper.find('.order-item-list-key').attributes('button')).toBeUndefined();

    await wrapper.find('.checkbox').setValue(true);
    expect(wrapper.emitted('update:selected')).toEqual([[true]]);
  });

  it('leaves the quantity out when the row hides it', () => {
    const wrapper = mountRow({ showQuantity: false });

    expect(wrapper.find('.order-item-list-key [slot="end"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('qty');
  });
});
