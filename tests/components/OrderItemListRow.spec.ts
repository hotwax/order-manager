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
    IonItem: { template: '<div class="item"><slot /></div>' },
    IonLabel: component,
    IonNote: component,
    IonThumbnail: component,
  };
});

// The preview directive's value, as the thumbnail last mounted it.
let preview: unknown;
const global = { directives: { imagePreview: { mounted: (_el: HTMLElement, binding: { value: unknown }) => { preview = binding.value; } } } };

const mountRow = (props: Record<string, unknown> = {}) =>
  mount(OrderItemListRow, { props: { primary: 'SKU-1', quantity: 2, quantityLabel: 'qty', amount: '$20.00', ...props }, global });

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
    // An ion-item holding a single checkbox turns its whole area into that checkbox.
    expect(wrapper.find('.item .checkbox').exists()).toBe(false);

    await wrapper.find('.checkbox').setValue(true);
    expect(wrapper.emitted('update:selected')).toEqual([[true]]);
  });

  it('keeps the image slot for a product without an image, so its label lines up', () => {
    expect(mountRow({ imageUrl: '' }).find('.order-item-list-key img').exists()).toBe(true);
  });

  it('titles the image preview with the row\'s primary identifier, not the product name', () => {
    mountRow({ primary: 'SHIRT-M', imageUrl: 'shirt.jpg' });

    expect(preview).toEqual({ mainImageUrl: 'shirt.jpg', productName: 'SHIRT-M' });
  });

  it('shows no image on a row that names an order item', () => {
    expect(mountRow({ showImage: false }).find('.order-item-list-key img').exists()).toBe(false);
  });

  it('puts extra detail chips, such as a transfer, under the facility and above the attributes', () => {
    const wrapper = mount(OrderItemListRow, {
      props: { primary: 'SKU-1', quantity: 1, quantityLabel: 'qty', amount: '$1.00', facilityLabel: 'Ponyride', attributesLabel: '0 attributes' },
      slots: { details: '<span class="transfer">Transfer from 51st St.</span>' },
      global,
    });

    const chips = [...wrapper.find('.order-item-details').element.children].map((chip) => chip.textContent?.trim());
    expect(chips).toEqual(['Ponyride', 'Transfer from 51st St.', '0 attributes']);
  });

  it('leaves the quantity out when the row hides it', () => {
    const wrapper = mountRow({ showQuantity: false });

    expect(wrapper.find('.order-item-list-key [slot="end"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('qty');
  });
});
