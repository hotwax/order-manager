import { mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Settings } from 'luxon';
import OrderTimeline from '@/components/orders/OrderTimeline.vue';
import type { OrderEventSourceStatus } from '@/store/orderDetail';
import { fixtureEvents, fixtureIsVirtual, RAILS_UAT } from '../support/orderTimelineFixture';

vi.mock('@common', () => ({
  // Blank a missing param, so a count the component forgets to pass shows up as an empty string.
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const box = (tag: string, className: string) => ({ template: `<${tag} class="${className}"><slot /></${tag}>` });
  return {
    IonAccordion: { props: ['value'], template: '<section class="accordion" :data-value="value"><slot /></section>' },
    IonAccordionGroup: box('div', 'accordion-group'),
    IonButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
    IonIcon: { template: '<i class="icon" />' },
    IonItem: { props: ['routerLink', 'button'], template: '<div class="item" :data-route="routerLink"><slot /></div>' },
    IonItemDivider: box('div', 'divider'),
    IonLabel: box('div', 'label'),
    IonList: box('div', 'list'),
    IonNote: box('span', 'note'),
    IonSkeletonText: { template: '<span class="skeleton" />' },
  };
});

vi.mock('@/composables/useOrderDetail', () => ({ FACILITY_CHANGE_PAGE_SIZE: 200 }));

vi.mock('@/composables/useProductIdentity', () => ({
  useProductIdentity: () => ({ primaryIdentifier: (productId: string) => RAILS_UAT.productLabels[productId] ?? '' }),
}));

vi.mock('@/store/orderDetail', () => ({
  isVirtualFacilityId: (facilityId: string) => fixtureIsVirtual(facilityId),
  useOrderDetailStore: () => ({ orderById: (orderId: string) => RAILS_UAT.orders[orderId]?.order ?? null }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    facilityName: (facilityId: string) => RAILS_UAT.facilities[facilityId]?.name ?? facilityId,
    statusDescription: (statusId: string) => statusId,
    describe: (value: string) => value,
    enumDescription: (enumId: string) => ({ WEB_SALES_CHANNEL: 'Web Channel', NOT_IN_STOCK: 'Not in Stock' } as Record<string, string>)[enumId] ?? enumId,
  }),
}));

/** A row's headline: the text its label holds before the detail lines. */
const headline = (row: any): string => ([...row.find('.label').element.childNodes] as Node[])
  .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())?.textContent?.trim() || '';

const idle: OrderEventSourceStatus = { loading: [], failed: [], facilityChangesTruncated: false };

/** The page's view of a fixture order: the ship groups the timeline reads item counts from. */
function enrichedOrder(orderId: string): any {
  const order = RAILS_UAT.orders[orderId].order;
  return {
    originFacilityId: order.originFacilityId,
    originFacilityName: '',
    shipGroups: order.shipGroups.map((sg: any) => ({ id: sg.shipGroupSeqId, isPosCompleted: sg.shipmentMethodTypeId === 'POS_COMPLETED', items: sg.items })),
  };
}

function mountTimeline(orderId: string, sourceStatus: OrderEventSourceStatus = idle) {
  return mount(OrderTimeline, {
    props: {
      order: enrichedOrder(orderId),
      events: fixtureEvents(orderId),
      sourceStatus,
      linkRoute: (link: any) => `/${link.kind}/${link.id}`,
    },
  });
}

beforeAll(() => {
  Settings.defaultZone = 'America/Los_Angeles';
});

describe('OrderTimeline', () => {
  it('puts each business transaction under its day, with the time only', () => {
    const wrapper = mountTimeline('158647');

    expect(wrapper.findAll('.divider').map((divider) => divider.text())).toEqual(['Tuesday, Sep 22, 2026']);
    const rows = wrapper.findAll('.accordion-group > .item, .accordion-group > .accordion > .item');
    expect(rows.map((row) => headline(row))).toEqual(['Order placed in Shopify', 'Imported, already cancelled in Shopify']);
    expect(rows.map((row) => row.find(':scope > .note').text())).toEqual(['2:33 PM', '3:13 PM']);
  });

  it('opens a transaction onto the rows it groups', () => {
    const wrapper = mountTimeline('158647');
    const imported = wrapper.findAll('.accordion')[1];

    // Six rows: the import date, the approval, the move into parking and three cancellation rows.
    expect(imported.findAll(':scope > .list > .item')).toHaveLength(6);
    expect(imported.text()).toContain('Rejected Item Parking');
    // Each record names the item by its product and says what happened, not which field it came from.
    expect(imported.text()).toContain('861B-398E-12130:XL');
    expect(imported.text()).toContain('Created in HotWax');
  });

  it('opens a folded run onto every transaction it holds', () => {
    const wrapper = mountTimeline('123768');
    const run = wrapper.findAll('.accordion').find((accordion) => accordion.text().includes('Rejected and re-brokered'))!;

    expect(run.findAll(':scope > .list > .item').map((item) => headline(item)))
      .toEqual(['Rejected', 'Released', 'Rejected', 'Released', 'Rejected']);
  });

  it('links a return straight to its page instead of opening it', () => {
    const wrapper = mountTimeline('115548');
    const row = wrapper.findAll('.item').find((item) => item.text().includes('Return created'))!;

    expect(row.attributes('data-route')).toMatch(/^\/return\//);
  });

  it('shows a loading row while a source is still loading', () => {
    expect(mountTimeline('158647', { ...idle, loading: ['facilityChanges'] }).find('.skeleton').exists()).toBe(true);
    expect(mountTimeline('158647').find('.skeleton').exists()).toBe(false);
  });

  it('names the sources that failed and asks the page to retry them', async () => {
    const wrapper = mountTimeline('158647', { ...idle, failed: ['facilityChanges', 'fulfillment'] });

    expect(wrapper.text()).toContain("Some history couldn't load");
    expect(wrapper.text()).toContain('Facility moves, Pick, pack and ship dates');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('says when older facility moves are not shown', () => {
    expect(mountTimeline('158647', { ...idle, facilityChangesTruncated: true }).text()).toContain('Showing the latest 200 facility moves');
  });

  it('says there is no history rather than showing placeholder rows', () => {
    const wrapper = mount(OrderTimeline, { props: { order: enrichedOrder('158647'), events: [], sourceStatus: idle, linkRoute: () => undefined } });

    expect(wrapper.text()).toContain('No history recorded');
  });
});
