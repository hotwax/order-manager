import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Settings } from 'luxon';
import OrderTimeline from '@/components/orders/OrderTimeline.vue';
import type { OrderHistoryStatus } from '@/store/orderDetail';
import { buildOrderEvents } from '@/utils/orderEvents';

const sync = vi.hoisted(() => ({ synced: true, running: true }));
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
vi.mock('@common/db', () => {
  // A list getter's `withSync` reads `sync.synced`; `serviceState.running` reads `sync.running`.
  const table = () => Object.assign(() => [], { withSync: () => ({ data: [], synced: sync.synced }) });
  return {
    get serviceState() { return sync; },
    useSeedData: () => ({
      facilities: table(),
      facilityTypes: table(),
      getFacilities: async () => [],
      getFacilityTypes: async () => [],
      facilityName: (facilityId: string) => FACILITIES[facilityId] ?? facilityId,
      statusDescription: (statusId: string) => statusId,
      enumDescription: (enumId: string) => enumId,
    }),
  };
});

vi.mock('@/store/orderDetail', () => ({
  isVirtualFacilityId: (facilityId: string) => facilityId === 'PARKING',
  useOrderDetailStore: () => ({ orderById: () => null }),
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
  it('shows one line per transaction under its day, opening onto its records', () => {
    const wrapper = mountTimeline();

    expect(wrapper.findAll('.divider').map((divider) => divider.text())).toEqual(['Tuesday, Sep 22, 2026', 'Wednesday, Sep 23, 2026']);
    const cancelled = wrapper.findAll('.accordion').find((accordion) => accordion.text().includes('Imported, already cancelled in Shopify'))!;
    expect(cancelled.text()).toContain('TEE-M from Main Warehouse');
    expect(cancelled.text()).toContain('Moved to parking');
    expect(cancelled.text()).toContain('Created in HotWax');
  });

  it('links a return straight to its page instead of opening it', () => {
    const row = mountTimeline().findAll('.item').find((item) => item.text().includes('Return created'))!;

    expect(row.attributes('data-route')).toBe('/return/R1');
  });

  it('shows loading until the facility list is known, and a retry when history failed', async () => {
    expect(mountTimeline({ ...idle, loading: true }).find('.skeleton').exists()).toBe(true);
    sync.synced = false;
    const waiting = mountTimeline();
    sync.synced = true;
    expect(waiting.findAll('.divider')).toHaveLength(0);

    const failed = mountTimeline({ ...idle, failed: true });
    await failed.find('button').trigger('click');
    expect(failed.emitted('retry')).toHaveLength(1);
  });

  it('shows the history once the facility read lands when sync stopped without filling the tables', async () => {
    Object.assign(sync, { synced: false, running: false });
    try {
      const stopped = mountTimeline();
      expect(stopped.findAll('.divider')).toHaveLength(0);
      await flushPromises();
      expect(stopped.findAll('.divider').length).toBeGreaterThan(0);
    } finally {
      Object.assign(sync, { synced: true, running: true });
    }
  });
});
