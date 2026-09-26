import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { modalController } from '@ionic/vue';
import { useOrderActions } from '@/composables/useOrderActions';
import type { EnrichedOrder, EnrichedOrderItem, EnrichedShipGroup } from '@/types/orderDetail';

// Like the app's i18n: named placeholders are filled from the params, and render empty without them.
vi.mock('@common', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  translate: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
}));
vi.mock('@ionic/vue', async (importOriginal) => ({ ...(await importOriginal<any>()), modalController: { create: vi.fn() } }));
vi.mock('@/utils', async (importOriginal) => ({ ...(await importOriginal<any>()), showToast: vi.fn() }));

const item = (orderItemSeqId: string, shipGroupSeqId: string, statusId = 'ITEM_APPROVED') =>
  ({ orderItemSeqId, shipGroupSeqId, statusId, productId: `P${orderItemSeqId}`, quantity: 1, facilityId: 'F' }) as EnrichedOrderItem;

/** Two physical ship groups at different stores, and a parked (virtual) one. */
const shipGroups = [
  { id: '00001', facilityId: 'STORE_A', isVirtual: false },
  { id: '00002', facilityId: 'STORE_B', isVirtual: false },
  { id: '00003', facilityId: 'PARKING', isVirtual: true },
] as EnrichedShipGroup[];

function setup(items: EnrichedOrderItem[], checked: string[], canTransfer = true, { statusId = 'ORDER_APPROVED', groups = shipGroups } = {}) {
  const order = {
    id: 'O1',
    statusId,
    shipGroups: groups.map((shipGroup) => ({ ...shipGroup, items: items.filter((entry) => entry.shipGroupSeqId === shipGroup.id) })),
    groupedItems: items.map((groupItem) => ({ externalId: groupItem.orderItemSeqId, items: [groupItem] })),
  } as unknown as EnrichedOrder;
  const selectedItemIds = ref(new Set<string>(checked));
  const actions = useOrderActions({
    order: ref(order),
    loadOrder: vi.fn(),
    selectedItemIds,
    selectedShipGroupItems: ref({}),
    selectedSegment: ref('items'),
    canRequestInventoryTransfer: ref(canTransfer),
  });
  return { actions, selectedItemIds };
}

const transferAction = (actions: ReturnType<typeof setup>['actions']) =>
  actions.footerActions.value.find((action: any) => action.id === 'REQUEST_TRANSFER');
const endActionIds = (actions: ReturnType<typeof setup>['actions']) =>
  actions.footerActions.value.filter((action: any) => action.kind === 'footer').map((action: any) => action.id);

/** Each transfer modal opened resolves with the next role in the list. */
function transferModalsDismissWith(...roles: string[]) {
  roles.forEach((role) => vi.mocked(modalController.create).mockResolvedValueOnce({
    present: vi.fn(),
    onWillDismiss: vi.fn().mockResolvedValue({ role }),
  } as any));
}

const destinations = () => vi.mocked(modalController.create).mock.calls.map(([options]: any) => ({
  destination: options.componentProps.destinationFacilityId,
  items: options.componentProps.items.map((entry: any) => entry.orderItemSeqId),
}));

describe('footer item actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(modalController.create).mockReset();
  });

  it('offers no transfer until items are selected', () => {
    const { actions } = setup([item('01', '00001')], []);

    expect(transferAction(actions)).toBeUndefined();
  });

  it('counts only the selected items a transfer applies to', () => {
    // 02 is completed and 03 is parked at a virtual facility, so neither can be transferred.
    const { actions } = setup([item('01', '00001'), item('02', '00001', 'ITEM_COMPLETED'), item('03', '00003')], ['01', '02', '03']);

    expect(transferAction(actions)).toBeDefined();
    expect(actions.footerActionLabel(transferAction(actions))).toBe('Request transfer for 1 items');
  });

  it('offers no transfer without the permission, or when nothing selected can be transferred', () => {
    expect(transferAction(setup([item('01', '00001')], ['01'], false).actions)).toBeUndefined();
    expect(transferAction(setup([item('01', '00001', 'ITEM_COMPLETED')], ['01']).actions)).toBeUndefined();
  });

  it('requests one transfer per destination store, then clears the selection', async () => {
    const { actions, selectedItemIds } = setup([item('01', '00001'), item('02', '00002'), item('03', '00001')], ['01', '02', '03']);
    transferModalsDismissWith('confirm', 'confirm');

    await actions.runFooterAction(transferAction(actions));

    expect(destinations()).toEqual([
      { destination: 'STORE_A', items: ['01', '03'] },
      { destination: 'STORE_B', items: ['02'] },
    ]);
    expect(selectedItemIds.value.size).toBe(0);
  });

  it('offers Add items on an open order, first on the end ahead of the item actions', () => {
    expect(endActionIds(setup([item('01', '00001')], []).actions)[0]).toBe('ADD_ITEMS');
    expect(endActionIds(setup([item('01', '00001')], ['01']).actions).slice(0, 2)).toEqual(['ADD_ITEMS', 'REQUEST_TRANSFER']);
  });

  it('offers no Add items once the order is completed', () => {
    expect(endActionIds(setup([item('01', '00001', 'ITEM_COMPLETED')], [], true, { statusId: 'ORDER_COMPLETED' }).actions)).not.toContain('ADD_ITEMS');
  });

  it('adds items to the only ship group straight away', async () => {
    const { actions } = setup([item('01', '00001')], [], true, { groups: [shipGroups[0]] });
    transferModalsDismissWith('cancel');

    await actions.runFooterAction(actions.footerActions.value.find((action: any) => action.id === 'ADD_ITEMS'));

    expect(vi.mocked(modalController.create).mock.calls[0][0]).toMatchObject({ componentProps: { orderId: 'O1', shipGroupSeqId: '00001' } });
  });

  it('stops at the first cancelled request and keeps the selection when nothing was requested', async () => {
    const { actions, selectedItemIds } = setup([item('01', '00001'), item('02', '00002')], ['01', '02']);
    transferModalsDismissWith('cancel');

    await actions.runFooterAction(transferAction(actions));

    expect(destinations()).toHaveLength(1);
    expect(selectedItemIds.value.size).toBe(2);
  });
});
