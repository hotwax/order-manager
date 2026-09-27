import { mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Settings } from 'luxon';
import OrderTimeline from '@/components/orders/OrderTimeline.vue';
import type { OrderEventSourceStatus } from '@/store/orderDetail';
import { buildOrderEvents } from '@/utils/orderEvents';

const seedFacilities = vi.hoisted(() => ({ ids: ['WH'], status: 'loaded' }));
const FACILITIES: Record<string, string> = { WH: 'Main Warehouse', PARKING: 'Rejected Item Parking' };

vi.mock('@common', () => ({
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const box = (tag: string, className: string) => ({ template: `<${tag} class="${className}"><slot /></${tag}>` });
  return {
    IonAccordion: box('section', 'accordion'),
    IonAccordionGroup: box('div', 'accordion-group'),
    IonButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
    IonIcon: { template: '<i />' },
    IonItem: { props: ['routerLink'], template: '<div class="item" :data-route="routerLink"><slot /></div>' },
    IonItemDivider: box('div', 'divider'),
    IonLabel: box('div', 'label'),
    IonList: box('div', 'list'),
    IonNote: box('span', 'note'),
    IonSkeletonText: { template: '<span class="skeleton" />' },
  };
});

vi.mock('@/composables/useOrderDetail', () => ({ FACILITY_CHANGE_PAGE_SIZE: 200 }));
vi.mock('@/composables/useProductIdentity', () => ({ useProductIdentity: () => ({ primaryIdentifier: () => 'TEE-M' }) }));
vi.mock('@/store/orderDetail', () => ({
  isVirtualFacilityId: (facilityId: string) => facilityId === 'PARKING',
  useOrderDetailStore: () => ({ orderById: () => null }),
}));
vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    facilities: seedFacilities,
    facilityName: (facilityId: string) => FACILITIES[facilityId] ?? facilityId,
    statusDescription: (statusId: string) => statusId,
    describe: (value: string) => value,
    enumDescription: (enumId: string) => enumId,
  }),
}));

// 2:00 PM on Tuesday, Sep 22, 2026 in Los Angeles.
const T = (seconds: number) => Date.UTC(2026, 8, 22, 21, 0, 0) + seconds * 1_000;

/** Placed at 2:00, cancelled in Shopify as it was imported at 2:10, and returned a day later. */
const events = buildOrderEvents({
  order: {
    orderId: 'O1', orderDate: T(0), entryDate: T(600),
    shipGroups: [{ shipGroupSeqId: '00001', facilityId: 'PARKING', items: [{ orderItemSeqId: '01', productId: 'P1' }] }],
    statuses: [
      { statusId: 'ORDER_APPROVED', statusDatetime: T(600.01) },
      { orderItemSeqId: '01', statusId: 'ITEM_CANCELLED', changeReason: 'SHOPIFY_CANCELLATION', statusDatetime: T(600.04) },
      { statusId: 'ORDER_CANCELLED', changeReason: 'SHOPIFY_CANCELLATION', statusDatetime: T(600.05) },
    ],
    returnItems: [{ returnId: 'R1', orderItemSeqId: '01', returnQuantity: 1, createdStamp: T(86_400) }],
  },
  facilityChanges: [{ orderItemSeqId: '01', changeReasonEnumId: 'SHOPIFY_CANCELLATION', fromFacilityId: 'WH', facilityId: 'PARKING', changeDatetime: T(600.03) }],
  facilityChangesLoaded: true, unfillable: null, fulfillment: [], returnHeadersById: {}, exchangeChildren: [],
  isVirtualFacility: (facilityId) => facilityId === 'PARKING',
});

const idle: OrderEventSourceStatus = { loading: [], failed: [], facilityChangesTruncated: false };
const order: any = { originFacilityId: '', originFacilityName: '', shipGroups: [{ id: '00001', isPosCompleted: false, items: [{ orderItemSeqId: '01', productId: 'P1' }] }] };

const mountTimeline = (sourceStatus = idle, list = events) => mount(OrderTimeline, {
  props: { order, events: list, sourceStatus, linkRoute: (link: any) => `/${link.kind}/${link.id}` },
});

beforeAll(() => {
  Settings.defaultZone = 'America/Los_Angeles';
});

describe('OrderTimeline', () => {
  it('shows one line per transaction under its day, opening onto its records', () => {
    const wrapper = mountTimeline();

    expect(wrapper.findAll('.divider').map((divider) => divider.text())).toEqual(['Tuesday, Sep 22, 2026', 'Wednesday, Sep 23, 2026']);
    const cancelled = wrapper.findAll('.accordion').find((accordion) => accordion.text().includes('Imported, already cancelled in Shopify'))!;
    expect(cancelled.text()).toContain('TEE-M from Main Warehouse');
    expect(cancelled.findAll(':scope > .list > .item')).toHaveLength(5);
  });

  it('links a return straight to its page instead of opening it', () => {
    const row = mountTimeline().findAll('.item').find((item) => item.text().includes('Return created'))!;

    expect(row.attributes('data-route')).toBe('/return/R1');
  });

  it('shows a loading row while a source loads, and waits for the facility list', () => {
    expect(mountTimeline({ ...idle, loading: ['facilityChanges'] }).find('.skeleton').exists()).toBe(true);

    seedFacilities.ids = [];
    seedFacilities.status = 'loading';
    try {
      const wrapper = mountTimeline();
      expect(wrapper.find('.skeleton').exists()).toBe(true);
      expect(wrapper.findAll('.divider')).toHaveLength(0);
    } finally {
      seedFacilities.ids = ['WH'];
      seedFacilities.status = 'loaded';
    }
  });

  it('names the sources that failed and asks the page to retry them', async () => {
    const wrapper = mountTimeline({ ...idle, failed: ['facilityChanges'] });

    expect(wrapper.text()).toContain('Facility moves');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('says there is no history rather than showing placeholder rows', () => {
    expect(mountTimeline(idle, []).text()).toContain('No history recorded');
  });
});
