import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useOrderActions } from '@/composables/useOrderActions';
import type { EnrichedOrder, EnrichedOrderItem, EnrichedShipGroup } from '@/types/orderDetail';

const item = (orderItemSeqId: string, shipGroupSeqId: string, statusId: string) =>
  ({ orderItemSeqId, shipGroupSeqId, statusId, facilityId: 'F', productId: 'P', quantity: 1 }) as EnrichedOrderItem;

function orderWith(statusId: string, shipGroup: Partial<EnrichedShipGroup>): EnrichedOrder {
  const group = { id: '00001', facilityId: 'F', isVirtual: false, ...shipGroup } as EnrichedShipGroup;
  return {
    id: 'O1',
    statusId,
    shipGroups: [group],
    groupedItems: group.items.map((groupItem) => ({ externalId: groupItem.orderItemSeqId, items: [groupItem] })),
  } as unknown as EnrichedOrder;
}

function actionsFor(order: EnrichedOrder, selectedShipGroupItems: Record<string, string[]> = {}) {
  return useOrderActions({
    order: ref(order),
    loadOrder: vi.fn(),
    selectedItemIds: ref(new Set<string>()),
    selectedShipGroupItems: ref(selectedShipGroupItems),
    selectedSegment: ref('ship-groups'),
  });
}

describe('useOrderActions gating', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('lets an open order change the carrier and method of a group still in motion', () => {
    const items = [item('01', '00001', 'ITEM_APPROVED')];
    const order = orderWith('ORDER_APPROVED', { items });
    const { isShipGroupActionDisabled } = actionsFor(order);
    expect(isShipGroupActionDisabled(order.shipGroups[0], 'EDIT_CARRIER_METHOD')).toBe(false);
    expect(isShipGroupActionDisabled(order.shipGroups[0], 'EDIT_ADDRESS')).toBe(false);
  });

  it('locks a settled group and a terminal order', () => {
    const settled = orderWith('ORDER_APPROVED', { items: [item('01', '00001', 'ITEM_CANCELLED')] });
    expect(actionsFor(settled).isShipGroupActionDisabled(settled.shipGroups[0], 'EDIT_CARRIER_METHOD')).toBe(true);

    const completed = orderWith('ORDER_COMPLETED', { items: [item('01', '00001', 'ITEM_COMPLETED'), item('02', '00001', 'ITEM_APPROVED')] });
    expect(actionsFor(completed).isShipGroupActionDisabled(completed.shipGroups[0], 'EDIT_CARRIER_METHOD')).toBe(true);
  });

  it('narrows release to the checked items, and covers the whole group when nothing is checked', () => {
    const items = [item('01', '00001', 'ITEM_APPROVED'), item('02', '00001', 'ITEM_COMPLETED')];
    const order = orderWith('ORDER_APPROVED', { isVirtual: true, items });

    expect(actionsFor(order).isShipGroupActionDisabled(order.shipGroups[0], 'RELEASE')).toBe(false);
    expect(actionsFor(order, { '00001': ['02'] }).isShipGroupActionDisabled(order.shipGroups[0], 'RELEASE')).toBe(true);
    expect(actionsFor(order, { '00001': ['01'] }).isShipGroupActionDisabled(order.shipGroups[0], 'RELEASE')).toBe(false);
  });
});
