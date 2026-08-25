import { OrderActionValidator } from '@/utils/OrderActionValidator';

export interface ShipGroupItemStates {
  /** Items carrying a status. Items without one cannot be reasoned about and are ignored. */
  total: number;
  fulfilled: number;
  /** Every item has stopped — nothing in this group will move again. */
  settled: boolean;
  /** Every item finished. */
  allFulfilled: boolean;
  /** Stopped, with some finished and some not — cancelled alongside completed. */
  partiallyFulfilled: boolean;
  /** Stopped with nothing finished: the whole group was cancelled or rejected. */
  allCancelled: boolean;
}

/**
 * Where a ship group stands according to its items, which is the authority for anything
 * terminal.
 *
 * `get#OrderFulfillmentTimeline` records how far a *moving* group has travelled, but says
 * nothing about one that has stopped — and on some instances it records almost nothing at all.
 * Deriving the card purely from those dates left a finished group reading "25% Complete" with
 * Pick/Pack/Ship still "Pending", because a physical facility scores 25% for being brokered and
 * no later date ever arrives.
 *
 * Items without a `statusId` are skipped rather than counted as unfinished: a group whose
 * statuses have not loaded yet should read as in-progress, not as freshly cancelled.
 */
export function shipGroupItemStates(items: any[] | undefined | null): ShipGroupItemStates {
  const known = (items || []).filter((item: any) => item?.statusId);
  const fulfilled = known.filter((item: any) => OrderActionValidator.isItemFulfilled(item)).length;
  const terminal = known.filter((item: any) => OrderActionValidator.isItemTerminal(item)).length;
  const settled = known.length > 0 && terminal === known.length;

  return {
    total: known.length,
    fulfilled,
    settled,
    allFulfilled: known.length > 0 && fulfilled === known.length,
    partiallyFulfilled: settled && fulfilled > 0 && fulfilled < known.length,
    allCancelled: settled && fulfilled === 0
  };
}
