import { toMillis } from '@/utils/format';
import { fallbackBrokeringEvents, facilityChangeEvents } from './facilityChanges';
import { exchangeEvents, returnEvents } from './lineage';
import { statusEvents } from './statuses';
import type { FulfillmentStep, OrderEvent, OrderEventOf, OrderEventSources } from './types';

export * from './types';
export { clusterEvents, EVENT_CLUSTER_MS } from './cluster';
export { moveKind } from './facilityChanges';

const FULFILLMENT_FIELDS: Array<[string, FulfillmentStep]> = [
  ['picklistDate', 'picked'],
  ['packedDate', 'packed'],
  ['shippedDate', 'shipped'],
];

// Ties at the same millisecond read in this order, so a transaction's story never depends on it.
const KIND_ORDER: Record<OrderEvent['kind'], number> = {
  placed: 0, imported: 1, orderStatus: 2, move: 3, itemStatus: 4, fulfillment: 5, unfillable: 6, return: 7, exchange: 8,
};

/** Picked, packed and shipped per ship group, dated by `get#OrderFulfillmentTimeline`. */
function fulfillmentEvents(order: any, fulfillment: any[]): OrderEvent[] {
  const shipGroups: Record<string, any> = Object.fromEntries((order?.shipGroups || []).map((sg: any) => [sg.shipGroupSeqId, sg]));
  return fulfillment.flatMap((entry: any) => FULFILLMENT_FIELDS.flatMap(([field, step]) => {
    const at = toMillis(entry?.[field]);
    if (at === undefined) return [];
    const shipGroup = shipGroups[entry.shipGroupSeqId];
    return [{
      id: `${step}-${entry.shipGroupSeqId}`,
      kind: 'fulfillment' as const,
      step,
      facilityId: shipGroup?.facilityId,
      at,
      shipGroupSeqIds: [entry.shipGroupSeqId],
      orderItemSeqIds: (shipGroup?.items || [])
        .filter((item: any) => item.statusId !== 'ITEM_CANCELLED')
        .map((item: any) => item.orderItemSeqId),
      records: [{ source: 'fulfillment' as const, type: field, at, shipGroupSeqId: entry.shipGroupSeqId }],
    }];
  }));
}

/** Whether a move put items somewhere they will be fulfilled from. */
export function isBrokeringMove(event: OrderEvent, isVirtualFacility: (facilityId: string) => boolean): boolean {
  if (event.kind !== 'move') return false;
  if (event.move === 'brokered' || event.move === 'released') return true;
  return event.move === 'assigned' && !!event.toFacilityId && !isVirtualFacility(event.toFacilityId);
}

/**
 * The order's history as typed events, oldest first. Undated events sort last. The earliest
 * brokering move — brokered, released, or assigned to a real facility at import — is marked first.
 */
export function buildOrderEvents(sources: OrderEventSources): OrderEvent[] {
  const { order } = sources;
  if (!order) return [];

  const moves = sources.facilityChangesLoaded
    ? facilityChangeEvents(sources.facilityChanges)
    : fallbackBrokeringEvents(sources.fulfillment);
  // A full page holds only the newest moves. The fulfillment timeline dates each group's first
  // brokering from the whole history, so recover the ones that fell off the page.
  const truncated = sources.facilityChangesLoaded && !!sources.facilityChangesTruncated;
  if (truncated) {
    const oldest = Math.min(...moves.map((move) => move.at ?? Infinity));
    moves.push(...fallbackBrokeringEvents(sources.fulfillment).filter((move) => (move.at as number) < oldest));
  }

  const events: OrderEvent[] = [
    ...statusEvents(order),
    ...moves,
    ...fulfillmentEvents(order, sources.fulfillment),
    ...returnEvents(order, sources.returnHeadersById),
    ...exchangeEvents(order, sources.exchangeChildren),
  ];

  const lastAttempt = toMillis(sources.unfillable?.lastAttemptDate);
  if (sources.unfillable && lastAttempt !== undefined) {
    events.push({
      id: 'unfillable',
      kind: 'unfillable',
      attempts: sources.unfillable.count,
      atLeast: sources.unfillable.atLeast,
      at: lastAttempt,
      shipGroupSeqIds: [],
      orderItemSeqIds: [],
      records: [{ source: 'unfillable', type: 'UNFILLABLE', at: lastAttempt }],
    });
  }

  events.sort((left, right) => {
    if (left.at === undefined || right.at === undefined) {
      if (left.at !== right.at) return left.at === undefined ? 1 : -1;
    } else if (left.at !== right.at) {
      return left.at - right.at;
    }
    return KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  });

  // With a cut-off history the oldest move on the page is not necessarily the first; only a
  // brokering recovered from the fulfillment timeline is known to be.
  const first = events.find((event) => event.at !== undefined && isBrokeringMove(event, sources.isVirtualFacility)) as OrderEventOf<'move'> | undefined;
  if (first && (!truncated || first.records.every((record) => record.source === 'fulfillment'))) first.isFirst = true;

  return events;
}

export interface ShipGroupMilestones {
  firstBrokeredDate?: number;
  picklistDate?: number;
  packedDate?: number;
  shippedDate?: number;
}

/**
 * The brokered → pick → pack → ship dates for one ship group. Brokering is dated by the group's
 * earliest brokered or released move; a group on a real facility with neither was placed there
 * by its earliest facility change instead (an import assignment writes no BROKERED row). On a
 * virtual facility those rows record parking, rejections and cancellations, never a brokering.
 */
export function shipGroupMilestones(events: OrderEvent[], shipGroupSeqId: string, isVirtual: boolean): ShipGroupMilestones {
  const ofGroup = events.filter((event) => event.at !== undefined && event.shipGroupSeqIds.includes(shipGroupSeqId));
  const moves = ofGroup.filter((event): event is OrderEventOf<'move'> => event.kind === 'move');
  const brokering = moves.find((event) => event.move === 'brokered' || event.move === 'released');
  const step = (name: FulfillmentStep) => ofGroup.find((event) => event.kind === 'fulfillment' && event.step === name)?.at;

  return {
    firstBrokeredDate: brokering?.at ?? (isVirtual ? undefined : moves[0]?.at),
    picklistDate: step('picked'),
    packedDate: step('packed'),
    shippedDate: step('shipped'),
  };
}
