export type FulfillmentLineStatus = 'Open' | 'Inflight' | 'Packed';

export interface ShipGroupFulfillmentTimeline {
  firstBrokeredDate?: string | number | null;
  firstReleasedDate?: string | number | null;
  picklistDate?: string | number | null;
  packedDate?: string | number | null;
  shippedDate?: string | number | null;
}

export function fulfillmentLineStatus(
  timeline?: ShipGroupFulfillmentTimeline | null
): FulfillmentLineStatus | undefined {
  if (timeline?.packedDate || timeline?.shippedDate) return 'Packed';
  if (timeline?.picklistDate) return 'Inflight';
  if (timeline?.firstBrokeredDate || timeline?.firstReleasedDate) return 'Open';
  return undefined;
}

export function fulfillmentLineStatusColor(status: FulfillmentLineStatus): string {
  if (status === 'Packed') return 'success';
  if (status === 'Inflight') return 'warning';
  return 'primary';
}
