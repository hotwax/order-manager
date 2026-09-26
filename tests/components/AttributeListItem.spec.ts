import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AttributeListItem from '@/components/orders/AttributeListItem.vue';

vi.mock('@common', () => ({ translate: (value: string) => value }));

const mountItem = (props: Record<string, unknown>, slots = {}) => mount(AttributeListItem, { props: { name: 'gift_message', ...props }, slots });

describe('AttributeListItem', () => {
  it('shows the name with its value and description', () => {
    const wrapper = mountItem({ value: 'Happy birthday', description: 'From checkout' });

    expect(wrapper.find('dt').text()).toBe('gift_message');
    expect(wrapper.find('.attribute-kv__value').text()).toBe('Happy birthday');
    expect(wrapper.find('.attribute-kv__description').text()).toBe('From checkout');
  });

  it.each([undefined, null, '', '   '])('says the value is not available rather than dropping it (%j)', (value) => {
    const wrapper = mountItem({ value });

    expect(wrapper.find('.attribute-kv__value').text()).toBe('Value not available');
  });

  it('leaves the description out when there is none', () => {
    expect(mountItem({ value: 'x' }).find('.attribute-kv__description').exists()).toBe(false);
  });

  it('renders row actions passed in the end slot', () => {
    const wrapper = mountItem({ value: 'x' }, { end: '<button class="delete">Delete</button>' });

    expect(wrapper.find('button.delete').exists()).toBe(true);
  });
});
