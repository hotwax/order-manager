import { clusterEvents, distinct, rowMillis } from './cluster';
import type { MoveKind, OrderEvent, OrderEventActor, OrderEventRecord } from './types';

const MOVE_BY_REASON: Record<string, MoveKind> = {
  BROKERED: 'brokered',
  RELEASED: 'released',
  ALLOCATED: 'allocated',
  PARKED: 'parked',
  SHOPIFY_CANCELLATION: 'cancelled',
};

/**
 * What an OrderFacilityChange row did. The BROKERING_REASN_TYPE reasons other than the moves
 * above (DAMAGED, INV_STOLEN, INV_NOT_FOUND) and the rejection reasons (NO_VARIANCE_LOG,
 * NOT_IN_STOCK, REJ_RSN_*) all record a rejection.
 */
export function moveKind(row: any): MoveKind {
  const reason = row?.changeReasonEnumId || '';
  if (MOVE_BY_REASON[reason]) return MOVE_BY_REASON[reason];
  if (reason) return 'rejected';
  return row?.fromFacilityId && row.fromFacilityId !== row.facilityId ? 'moved' : 'assigned';
}

/**
 * Who made a move. A person's login when a row carries one; otherwise the system that says so
 * in the comment, e.g. "Shopify fulfillment sync: fulfilled at this location".
 */
function moveActor(rows: any[]): OrderEventActor | undefined {
  const login = rows.find((row) => row.changeUserLogin)?.changeUserLogin;
  if (login) return { kind: 'user', login };
  const comment = rows.find((row) => row.comments)?.comments || '';
  const system = /^([^:]{3,60}):/.exec(comment)?.[1]?.trim();
  return system ? { kind: 'system', name: system } : undefined;
}

function facilityChangeRecord(row: any): OrderEventRecord {
  return {
    source: 'facilityChange',
    type: row.changeReasonEnumId || '',
    at: rowMillis(row.changeDatetime) || undefined,
    orderItemSeqId: row.orderItemSeqId || undefined,
    shipGroupSeqId: row.shipGroupSeqId || undefined,
    fromFacilityId: row.fromFacilityId || undefined,
    facilityId: row.facilityId || undefined,
    userLogin: row.changeUserLogin || undefined,
    comments: row.comments || undefined,
  };
}

/** One event per facility operation — "3 items released to Broadway", not three lines. */
export function facilityChangeEvents(rows: any[]): OrderEvent[] {
  return clusterEvents(
    rows,
    (row) => [row.changeReasonEnumId || '', row.fromFacilityId || '', row.facilityId || ''].join('|'),
    (row) => rowMillis(row.changeDatetime)
  ).map((cluster) => {
    const first = cluster.rows[0];
    return {
      id: `move-${cluster.id}`,
      kind: 'move',
      move: moveKind(first),
      fromFacilityId: first.fromFacilityId || undefined,
      toFacilityId: first.facilityId || undefined,
      reasonEnumId: first.changeReasonEnumId || undefined,
      comments: cluster.rows.find((row: any) => row.comments)?.comments || undefined,
      at: cluster.value,
      actor: moveActor(cluster.rows),
      shipGroupSeqIds: distinct(cluster.rows, 'shipGroupSeqId'),
      orderItemSeqIds: distinct(cluster.rows, 'orderItemSeqId'),
      records: cluster.rows.map(facilityChangeRecord),
    };
  });
}

/**
 * Brokering moves recovered from `get#OrderFulfillmentTimeline` when the facility changes did
 * not load. The service reads firstBrokeredDate and firstReleasedDate off the same BROKERED and
 * RELEASED rows, so these stand in for those rows and nothing else.
 */
export function fallbackBrokeringEvents(fulfillment: any[]): OrderEvent[] {
  return fulfillment.flatMap((entry: any) => {
    const field = entry?.firstBrokeredDate ? 'firstBrokeredDate' : entry?.firstReleasedDate ? 'firstReleasedDate' : '';
    const at = field ? rowMillis(entry[field]) : 0;
    if (!at) return [];
    return [{
      id: `move-fallback-${entry.shipGroupSeqId}`,
      kind: 'move' as const,
      move: field === 'firstBrokeredDate' ? 'brokered' as const : 'released' as const,
      at,
      shipGroupSeqIds: entry.shipGroupSeqId ? [entry.shipGroupSeqId] : [],
      orderItemSeqIds: [],
      records: [{ source: 'fulfillment' as const, type: field, at, shipGroupSeqId: entry.shipGroupSeqId }],
    }];
  });
}
