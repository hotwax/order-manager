import { mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Settings } from 'luxon';
import OrderTimeline from '@/components/orders/OrderTimeline.vue';
import type { OrderHistoryStatus } from '@/store/orderDetail';
import { buildOrderEvents } from '@/utils/orderEvents';

const seedFacilities = vi.hoisted(() => ({ ids: ['WH'], status: 'loaded' }));
const FACILITIES: Record<string, string> = { WH: 'Main Warehouse', PARKING: 'Rejected Item Parking' };

vi.mock('@common', () => ({
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));

vi.mock('@ionic/vue', () => {
  const box = (tag: string, className: string) => ({ template: `<${tag} class="${className}"><slot /></${tag}>` });
  return {
    IonButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
    IonIcon: { template: '<i />' },
    IonItem: { props: ['routerLink'], emits: ['click'], template: '<div class="item" :data-route="routerLink" @click="$emit(\'click\')"><slot /></div>' },
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

const idle: OrderHistoryStatus = { loading: false, failed: false, truncated: false };
const order: any = { originFacilityId: '', originFacilityName: '', shipGroups: [{ id: '00001', isPosCompleted: false, items: [{ orderItemSeqId: '01', productId: 'P1' }] }] };

const mountTimeline = (status = idle, list = events) => mount(OrderTimeline, {
  props: { order, events: list, status, linkRoute: (link: any) => `/${link.kind}/${link.id}` },
});

beforeAll(() => {
  Settings.defaultZone = 'America/Los_Angeles';
});

describe('OrderTimeline', () => {
  it('shows one line per transaction under its day, and opens it onto its records', async () => {
    const wrapper = mountTimeline();

    expect(wrapper.findAll('.divider').map((divider) => divider.text())).toEqual(['Tuesday, Sep 22, 2026', 'Wednesday, Sep 23, 2026']);
    const cancelled = wrapper.findAll('.item').find((item) => item.text().includes('Imported, already cancelled in Shopify'))!;
    expect(cancelled.text()).toContain('TEE-M from Main Warehouse');
    await cancelled.trigger('click');
    expect(wrapper.text()).toContain('Moved to parking');
    expect(wrapper.text()).toContain('Created in HotWax');
  });

  it('links a return straight to its page instead of opening it', () => {
    const row = mountTimeline().findAll('.item').find((item) => item.text().includes('Return created'))!;

    expect(row.attributes('data-route')).toBe('/return/R1');
  });

  it('shows loading until the facility list is known, and a retry when history failed', async () => {
    expect(mountTimeline({ ...idle, loading: true }).find('.skeleton').exists()).toBe(true);
    seedFacilities.ids = [];
    seedFacilities.status = 'loading';
    const waiting = mountTimeline();
    seedFacilities.ids = ['WH'];
    seedFacilities.status = 'loaded';
    expect(waiting.findAll('.divider')).toHaveLength(0);

    const failed = mountTimeline({ ...idle, failed: true });
    await failed.find('button').trigger('click');
    expect(failed.emitted('retry')).toHaveLength(1);
  });
});
