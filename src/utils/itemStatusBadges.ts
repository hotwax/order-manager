/** One state an order item row reports. */
export interface ItemStatusBadge {
  /** The status' description, already resolved for display. */
  label: string;
  /** Ionic color for the badge. */
  color?: string;
  /**
   * Units sitting in this state. Set only where a row rolls several order items up, so a row
   * standing for a single line names its state with no stray "1".
   */
  count?: number;
}

interface RollableItem {
  statusId: string;
  status: string;
  statusColor?: string;
  quantity: number;
}

/**
 * One badge per distinct order item status carrying the units sitting in it, so a rolled up
 * product row reports how the line actually splits ("2 Approved", "1 Completed") instead of
 * collapsing every state into one joined label. Counts are quantities, so they add up to the
 * total qty the same row shows. Statuses keep item order, which is the order the row's child
 * items are listed in. An item whose status has no description at all is left out — there is
 * no state to name — so counts only cover what the row can actually label.
 */
export function rollUpItemStatuses(items: RollableItem[]): ItemStatusBadge[] {
  const byStatusId = new Map<string, ItemStatusBadge>();

  items.forEach((item) => {
    if (!item.status) return;
    const quantity = Number(item.quantity || 0);
    const rolledUp = byStatusId.get(item.statusId);
    if (rolledUp) {
      rolledUp.count = Number(rolledUp.count || 0) + quantity;
      return;
    }
    byStatusId.set(item.statusId, { label: item.status, color: item.statusColor, count: quantity });
  });

  return [...byStatusId.values()];
}
