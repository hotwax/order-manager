import { describe, expect, it } from 'vitest';
import { OrderActionValidator } from '@/utils/OrderActionValidator';

/**
 * Enriched transition rows as seed.allowedTransitions() returns them, modelled
 * on the Default flow seed (ofbiz-oms-udm BOrderSeedData.xml): CREATED has
 * unconditional APPROVED + CANCELLED edges and system-only HOLD + REJECTED
 * edges guarded by conditionExpression "directStatusChange == false".
 */
function createdOrderTransitions() {
  return [
    { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_APPROVED', transitionName: 'Approve Order', toStatusDescription: 'Approved' },
    { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_HOLD', transitionName: 'Hold Order', toStatusDescription: 'Hold', conditionExpression: 'directStatusChange == false' },
    { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_REJECTED', transitionName: 'Reject Order', toStatusDescription: 'Rejected', conditionExpression: 'directStatusChange == false' },
    { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_CANCELLED', transitionName: 'Cancel Order', toStatusDescription: 'Cancelled' }
  ];
}

describe('isUserDrivenTransition', () => {
  it('allows a transition with no conditionExpression', () => {
    expect(OrderActionValidator.isUserDrivenTransition({ toStatusId: 'ORDER_APPROVED' })).toBe(true);
  });

  it('excludes a system-only transition gated on directStatusChange == false', () => {
    expect(OrderActionValidator.isUserDrivenTransition({ conditionExpression: 'directStatusChange == false' })).toBe(false);
    // tolerant of spacing
    expect(OrderActionValidator.isUserDrivenTransition({ conditionExpression: 'directStatusChange==false' })).toBe(false);
  });

  it('conservatively excludes an unrecognized conditionExpression', () => {
    expect(OrderActionValidator.isUserDrivenTransition({ conditionExpression: 'someOtherFlag == true' })).toBe(false);
  });
});

describe('getOrderStatusActions', () => {
  it('surfaces Approve order for a created order, from the transition table', () => {
    const actions = OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_CREATED' }, createdOrderTransitions());
    const approve = actions.find((a) => a.toStatusId === 'ORDER_APPROVED');
    expect(approve).toBeTruthy();
    expect(approve!.id).toBe('ORDER_APPROVED');
    expect(approve!.label).toBe('Approve order');
  });

  it('includes only user-drivable transitions (Approve, Cancel) and drops system-only Hold/Reject', () => {
    const actions = OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_CREATED' }, createdOrderTransitions());
    expect(actions.map((a) => a.toStatusId).sort()).toEqual(['ORDER_APPROVED', 'ORDER_CANCELLED']);
  });

  it('marks Cancel order danger and leaves Approve uncoloured', () => {
    const actions = OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_CREATED' }, createdOrderTransitions());
    expect(actions.find((a) => a.toStatusId === 'ORDER_CANCELLED')!.color).toBe('danger');
    expect(actions.find((a) => a.toStatusId === 'ORDER_APPROVED')!.color).toBeUndefined();
  });

  it('returns no actions for a terminal order even if the table has rows', () => {
    expect(OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_COMPLETED' }, createdOrderTransitions())).toEqual([]);
    expect(OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_CANCELLED' }, createdOrderTransitions())).toEqual([]);
  });

  it('returns no actions when the table is empty', () => {
    expect(OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_CREATED' }, [])).toEqual([]);
  });

  it('falls back to transitionName, then toStatusDescription, for an unknown destination', () => {
    const named = OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_APPROVED' }, [
      { toStatusId: 'ORDER_SENT', transitionName: 'Send Order', toStatusDescription: 'Sent' }
    ]);
    expect(named[0].label).toBe('Send Order');

    const descOnly = OrderActionValidator.getOrderStatusActions({ statusId: 'ORDER_APPROVED' }, [
      { toStatusId: 'ORDER_SENT', toStatusDescription: 'Sent' }
    ]);
    expect(descOnly[0].label).toBe('Sent');
  });
});

describe('getOrderFooterActions (unified footer)', () => {
  const createdOrder = { statusId: 'ORDER_CREATED' };

  it('a created order with no selection and no completed items: Approve + Cancel order (status) and Clone, but NOT Return or Cancel items', () => {
    const actions = OrderActionValidator.getOrderFooterActions(createdOrder, createdOrderTransitions(), [], { allItems: [] });
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('ORDER_APPROVED');
    expect(ids).toContain('ORDER_CANCELLED'); // "Cancel order" status transition
    expect(ids).toContain('CLONE');
    expect(ids).not.toContain('RETURN');       // no completed item → invalid → absent
    expect(ids).not.toContain('CANCEL_ITEMS'); // no selection → invalid → absent
  });

  it('tags status transitions kind=status (Approve solid) and footer actions kind=footer', () => {
    const actions = OrderActionValidator.getOrderFooterActions(createdOrder, createdOrderTransitions(), [], { allItems: [] });
    const approve = actions.find((a) => a.id === 'ORDER_APPROVED')!;
    expect(approve.kind).toBe('status');
    expect(approve.fill).toBe('solid');
    expect(approve.toStatusId).toBe('ORDER_APPROVED');
    expect(actions.find((a) => a.id === 'ORDER_CANCELLED')!.kind).toBe('footer');
    expect(actions.find((a) => a.id === 'CLONE')!.kind).toBe('footer');
  });

  it('keeps the bulk "Cancel items" half hidden while cancel does not sync to Shopify, leaving whole-order cancel intact', () => {
    const noSelection = OrderActionValidator.getOrderFooterActions(createdOrder, createdOrderTransitions(), [], { allItems: [] });
    expect(noSelection.map((a) => a.id)).toContain('ORDER_CANCELLED');
    expect(noSelection.map((a) => a.id)).not.toContain('CANCEL_ITEMS');

    const selected = [{ orderItemSeqId: '1', statusId: 'ITEM_CREATED' }];
    const withSelection = OrderActionValidator.getOrderFooterActions(
      createdOrder,
      createdOrderTransitions(),
      selected,
      { allItems: selected, orderAllowedToStatusIds: new Set(['ORDER_APPROVED', 'ORDER_CANCELLED']) }
    );
    // selecting items no longer morphs the button into the bulk cancel...
    expect(withSelection.map((a) => a.id)).not.toContain('CANCEL_ITEMS');
    // ...it stays the whole-order cancel, still on the end so the button never disappears
    expect(withSelection.map((a) => a.id)).toContain('ORDER_CANCELLED');
    expect(withSelection.find((a) => a.id === 'ORDER_CANCELLED')!.kind).toBe('footer');
  });

  it('keeps Return out of the footer while returns do not sync to Shopify', () => {
    const actions = OrderActionValidator.getOrderFooterActions(
      createdOrder,
      createdOrderTransitions(),
      [],
      { allItems: [{ statusId: 'ITEM_COMPLETED' }] }
    );
    expect(actions.map((a) => a.id)).not.toContain('RETURN');
  });

  it('still validates the hidden bulk actions, so clearing the flag restores them', () => {
    const selected = [{ orderItemSeqId: '1', statusId: 'ITEM_CREATED' }];
    const cancellable = OrderActionValidator.getFooterActions(createdOrder, selected, { allItems: selected });
    expect(cancellable.find((a) => a.id === 'CANCEL_ITEMS')!.validation.allowed).toBe(true);

    const returnable = OrderActionValidator.getFooterActions(createdOrder, [], { allItems: [{ statusId: 'ITEM_COMPLETED' }] });
    expect(returnable.find((a) => a.id === 'RETURN')!.validation.allowed).toBe(true);
  });

  it('a terminal order yields no status transitions (Clone still valid)', () => {
    const actions = OrderActionValidator.getOrderFooterActions({ statusId: 'ORDER_COMPLETED' }, createdOrderTransitions(), [], { allItems: [] });
    expect(actions.filter((a) => a.kind === 'status')).toEqual([]);
    expect(actions.map((a) => a.id)).toContain('CLONE');
  });
});

describe('settled ship groups are read-only', () => {
  const approvedOrder = { statusId: 'ORDER_APPROVED' };
  const virtual = { isVirtual: true };
  const group = (items: any[]) => ({
    id: '00001',
    facilityId: 'BROKERING_QUEUE',
    facilityParentTypeId: 'VIRTUAL_FACILITY',
    items,
  });
  const completed = { orderItemSeqId: '01', statusId: 'ITEM_COMPLETED' };
  const cancelled = { orderItemSeqId: '02', statusId: 'ITEM_CANCELLED' };
  const open = { orderItemSeqId: '03', statusId: 'ITEM_APPROVED' };

  const check = (items: any[], actionId: any, selection = items) =>
    OrderActionValidator.validateShipGroupAction(approvedOrder, group(items), actionId, selection, virtual);

  it('recognises a group whose items have all stopped', () => {
    expect(OrderActionValidator.isShipGroupSettled(group([completed, cancelled]))).toBe(true);
    expect(OrderActionValidator.isShipGroupSettled(group([completed, open]))).toBe(false);
  });

  it('does not lock a group whose item statuses have not loaded', () => {
    // Mid-load the card must read as still moving, not briefly freeze itself.
    expect(OrderActionValidator.isShipGroupSettled(group([{ orderItemSeqId: '01' }]))).toBe(false);
    expect(OrderActionValidator.isShipGroupSettled(group([]))).toBe(false);
    expect(check([{ orderItemSeqId: '01' }], 'EDIT_CARRIER_METHOD').allowed).toBe(true);
  });

  it('blocks every action that would move or re-ship a cancelled group', () => {
    const cancelledGroup = [cancelled];
    for (const actionId of ['BROKER', 'PARK_ITEMS', 'RELEASE', 'ADD_TASK', 'ADD_ITEMS', 'EDIT_CARRIER_METHOD', 'EDIT_ADDRESS']) {
      const result = check(cancelledGroup, actionId);
      expect(result.allowed, actionId).toBe(false);
      expect(result.reason, actionId).toBe('Every item in this ship group has been cancelled or completed.');
    }
  });

  it('blocks the same actions on a completed and on a partially fulfilled group', () => {
    expect(check([completed], 'EDIT_CARRIER_METHOD').allowed).toBe(false);
    expect(check([completed, cancelled], 'EDIT_CARRIER_METHOD').allowed).toBe(false);
    expect(check([completed, cancelled], 'ADD_ITEMS').allowed).toBe(false);
  });

  it('blocks pull back on a settled physical group', () => {
    const physical = { id: '00001', facilityId: 'BROADWAY', items: [cancelled] };
    const result = OrderActionValidator.validateShipGroupAction(
      approvedOrder, physical, 'PULL_BACK', [cancelled], { isVirtual: false }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Every item in this ship group has been cancelled or completed.');
  });

  it('blocks adding a task to a group that has stopped', () => {
    expect(check([cancelled], 'ADD_TASK').allowed).toBe(false);
    expect(check([completed, cancelled], 'ADD_TASK').allowed).toBe(false);
    // ...but a group still in motion takes tasks as before.
    expect(check([completed, open], 'ADD_TASK').allowed).toBe(true);
  });

  it('leaves a group with any open item fully actionable', () => {
    expect(check([completed, open], 'EDIT_CARRIER_METHOD').allowed).toBe(true);
    expect(check([completed, open], 'BROKER', []).allowed).toBe(true);
  });
});

describe('ship-group fulfillment approval gate', () => {
  const createdOrder = { statusId: 'ORDER_CREATED' };
  const approvedOrder = { statusId: 'ORDER_APPROVED' };
  const virtualShipGroup = {
    id: '00001',
    facilityId: 'BROKERING_QUEUE',
    facilityParentTypeId: 'VIRTUAL_FACILITY',
  };
  const selectedItems = [{ orderItemSeqId: '01', statusId: 'ITEM_CREATED' }];

  it('blocks brokering and release actions until the order is approved', () => {
    const broker = OrderActionValidator.validateShipGroupAction(
      createdOrder,
      virtualShipGroup,
      'BROKER',
      [],
      { isVirtual: true }
    );
    expect(broker.allowed).toBe(false);
    expect(broker.reason).toBe('Order must be approved before brokering.');

    const release = OrderActionValidator.validateShipGroupAction(
      createdOrder,
      virtualShipGroup,
      'RELEASE',
      selectedItems,
      { isVirtual: true }
    );
    expect(release.allowed).toBe(false);
    expect(release.reason).toBe('Order must be approved before releasing items to a facility.');
  });

  it('allows brokering and release actions for approved orders that satisfy existing gates', () => {
    expect(OrderActionValidator.validateShipGroupAction(
      approvedOrder,
      virtualShipGroup,
      'BROKER',
      [],
      { isVirtual: true }
    ).allowed).toBe(true);

    expect(OrderActionValidator.validateShipGroupAction(
      approvedOrder,
      virtualShipGroup,
      'RELEASE',
      selectedItems,
      { isVirtual: true }
    ).allowed).toBe(true);
  });

  it('treats the item list as a filter, not a precondition', () => {
    // The view passes the whole ship group when nothing is checked, so an
    // empty list means the ship group itself has nothing to act on.
    const empty = OrderActionValidator.validateShipGroupAction(
      approvedOrder,
      virtualShipGroup,
      'PARK_ITEMS',
      [],
      { isVirtual: true }
    );
    expect(empty.allowed).toBe(false);
    expect(empty.reason).toBe('This ship group has no items to park.');

    expect(OrderActionValidator.validateShipGroupAction(
      approvedOrder,
      virtualShipGroup,
      'PARK_ITEMS',
      [{ orderItemSeqId: '01', statusId: 'ITEM_CREATED' }, { orderItemSeqId: '02', statusId: 'ITEM_CANCELLED' }],
      { isVirtual: true }
    ).allowed).toBe(true);
  });

  it('blocks the item facility chip release path until the order is approved', () => {
    const createdValidation = OrderActionValidator.validateItemAction(
      createdOrder,
      selectedItems[0],
      'REJECT_AND_RELEASE',
      { isVirtual: false }
    );
    expect(createdValidation.allowed).toBe(false);
    expect(createdValidation.reason).toBe('Order must be approved before releasing items to a facility.');

    expect(OrderActionValidator.validateItemAction(
      approvedOrder,
      selectedItems[0],
      'REJECT_AND_RELEASE',
      { isVirtual: false }
    ).allowed).toBe(true);
  });
});

/**
 * The per-row Cancel button reads this, so what it refuses is what the row must not offer.
 * A row that only checked the item's own status would offer every case below.
 */
describe('validateItemAction CANCEL_ITEM', () => {
  const approvedItem = { orderItemSeqId: '01', statusId: 'ITEM_APPROVED' };
  const cancellable = new Set(['ITEM_CANCELLED', 'ITEM_COMPLETED']);

  it('allows cancelling a live item on a live order the table lets reach ITEM_CANCELLED', () => {
    const result = OrderActionValidator.validateItemAction(
      { statusId: 'ORDER_APPROVED' },
      approvedItem,
      'CANCEL_ITEM',
      { itemAllowedToStatusIds: cancellable, allItems: [approvedItem] }
    );
    expect(result.allowed).toBe(true);
  });

  it('refuses a live item once the ORDER is terminal', () => {
    ['ORDER_COMPLETED', 'ORDER_CANCELLED'].forEach((statusId) => {
      const result = OrderActionValidator.validateItemAction(
        { statusId },
        approvedItem,
        'CANCEL_ITEM',
        { itemAllowedToStatusIds: cancellable, allItems: [approvedItem] }
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Order is already/);
    });
  });

  it('refuses when the status flow has no ITEM_CANCELLED edge from the current item status', () => {
    const result = OrderActionValidator.validateItemAction(
      { statusId: 'ORDER_APPROVED' },
      approvedItem,
      'CANCEL_ITEM',
      { itemAllowedToStatusIds: new Set(['ITEM_COMPLETED']), allItems: [approvedItem] }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/status flow/);
  });

  it('still refuses an item that is itself terminal', () => {
    const result = OrderActionValidator.validateItemAction(
      { statusId: 'ORDER_APPROVED' },
      { orderItemSeqId: '01', statusId: 'ITEM_COMPLETED' },
      'CANCEL_ITEM',
      { itemAllowedToStatusIds: cancellable, allItems: [] }
    );
    expect(result.allowed).toBe(false);
  });
});
