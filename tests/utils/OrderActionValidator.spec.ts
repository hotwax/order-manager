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
    expect(actions.find((a) => a.id === 'CLONE')!.kind).toBe('footer');
  });

  it('the cancel button morphs: "Cancel order" with no selection, "Cancel items" once items are selected (never both)', () => {
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
    expect(withSelection.map((a) => a.id)).toContain('CANCEL_ITEMS');
    expect(withSelection.map((a) => a.id)).not.toContain('ORDER_CANCELLED');
    // morphing cancel stays on the start (kind 'status') so it converts in place
    expect(withSelection.find((a) => a.id === 'CANCEL_ITEMS')!.kind).toBe('status');
  });

  it('surfaces Return once the order has a completed item', () => {
    const actions = OrderActionValidator.getOrderFooterActions(
      createdOrder,
      createdOrderTransitions(),
      [],
      { allItems: [{ statusId: 'ITEM_COMPLETED' }] }
    );
    expect(actions.map((a) => a.id)).toContain('RETURN');
  });

  it('a terminal order yields no status transitions (Clone still valid)', () => {
    const actions = OrderActionValidator.getOrderFooterActions({ statusId: 'ORDER_COMPLETED' }, createdOrderTransitions(), [], { allItems: [] });
    expect(actions.filter((a) => a.kind === 'status')).toEqual([]);
    expect(actions.map((a) => a.id)).toContain('CLONE');
  });
});
