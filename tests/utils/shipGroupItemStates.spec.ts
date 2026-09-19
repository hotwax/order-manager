import { describe, expect, it } from 'vitest';
import { shipGroupItemStates } from '@/utils/shipGroupItemStates';

const completed = { statusId: 'ITEM_COMPLETED' };
const cancelled = { statusId: 'ITEM_CANCELLED' };
const approved = { statusId: 'ITEM_APPROVED' };
const unloaded = { orderItemSeqId: '01' };

describe('shipGroupItemStates', () => {
  it('counts only items that carry a status', () => {
    expect(shipGroupItemStates([completed, unloaded, cancelled])).toEqual({
      total: 2, fulfilled: 1, settled: true
    });
  });

  it('calls a group settled once every item has stopped', () => {
    expect(shipGroupItemStates([completed, completed]).settled).toBe(true);
    expect(shipGroupItemStates([cancelled, cancelled]).settled).toBe(true);
    expect(shipGroupItemStates([completed, cancelled]).settled).toBe(true);
  });

  it('leaves a group with any open item unsettled', () => {
    expect(shipGroupItemStates([completed, approved]).settled).toBe(false);
    expect(shipGroupItemStates([approved]).settled).toBe(false);
  });

  it('does not call an empty or still-loading group settled', () => {
    // A group mid-load must read as in progress, not as freshly cancelled.
    expect(shipGroupItemStates([])).toEqual({ total: 0, fulfilled: 0, settled: false });
    expect(shipGroupItemStates([unloaded, unloaded])).toEqual({ total: 0, fulfilled: 0, settled: false });
    expect(shipGroupItemStates(undefined)).toEqual({ total: 0, fulfilled: 0, settled: false });
    expect(shipGroupItemStates(null)).toEqual({ total: 0, fulfilled: 0, settled: false });
  });

  it('reports the fulfilled fraction the progress bar is drawn from', () => {
    // `fulfilled / total` is what the card uses for a settled group, so it has to answer
    // all three terminal cases on its own: everything landed, nothing did, and in between.
    const all = shipGroupItemStates([completed, completed]);
    expect(all.fulfilled / all.total).toBe(1);

    const none = shipGroupItemStates([cancelled, cancelled]);
    expect(none.fulfilled / none.total).toBe(0);

    const mixed = shipGroupItemStates([completed, cancelled, cancelled, completed]);
    expect(mixed).toEqual({ total: 4, fulfilled: 2, settled: true });
    expect(mixed.fulfilled / mixed.total).toBe(0.5);
  });

  it('counts only completed items as fulfilled', () => {
    expect(shipGroupItemStates([cancelled, approved]).fulfilled).toBe(0);
  });
});
