import { toMillis } from '@/utils/format';
import { clusterEvents, distinct, rowMillis } from './cluster';
import type { OrderEvent, OrderEventActor, OrderEventRecord } from './types';

const HEADER_SEQ_ID = '_NA_';

/** How close an ITEM_CREATED row must sit to the order date to be part of placing the order. */
const PLACED_WINDOW_MS = 2_000;

export const isHeaderStatus = (row: any) => (row?.orderItemSeqId || HEADER_SEQ_ID) === HEADER_SEQ_ID;

export const userActor = (login?: string): OrderEventActor | undefined => (login ? { kind: 'user', login } : undefined);

function statusRecord(row: any): OrderEventRecord {
  return {
    source: 'status',
    type: row.statusId,
    at: toMillis(row.statusDatetime),
    orderItemSeqId: isHeaderStatus(row) ? undefined : row.orderItemSeqId,
    userLogin: row.statusUserLogin || undefined,
    reason: row.changeReason || undefined,
  };
}

/**
 * Placing and importing the order, then one event per header status and one per item-status
 * operation. The order document carries every OrderStatus row (its `default` master declares
 * `<detail relationship="statuses"/>` unrestricted), so nothing here is fetched separately.
 */
export function statusEvents(order: any): OrderEvent[] {
  const rows: any[] = order?.statuses || [];
  const isShopify = (order?.identifications || []).some((identification: any) => identification.orderIdentificationTypeId === 'SHOPIFY_ORD_ID');
  const created = rows.filter((row) => row.statusId === 'ORDER_CREATED' && isHeaderStatus(row));
  const placedAt = toMillis(order?.orderDate) ?? toMillis(created[0]?.statusDatetime);
  const isPlacement = (row: any) => row.statusId === 'ITEM_CREATED' && placedAt !== undefined
    && Math.abs(rowMillis(row.statusDatetime) - placedAt) <= PLACED_WINDOW_MS;

  const events: OrderEvent[] = [];
  const itemSeqIds = (order?.shipGroups || []).flatMap((shipGroup: any) => (shipGroup.items || []).map((item: any) => item.orderItemSeqId));

  if (placedAt !== undefined) {
    const placementRows = [...created, ...rows.filter(isPlacement)];
    events.push({
      id: 'placed',
      kind: 'placed',
      at: placedAt,
      channelEnumId: order?.salesChannelEnumId,
      isShopify,
      shipGroupSeqIds: [],
      orderItemSeqIds: distinct(placementRows, 'orderItemSeqId').length ? distinct(placementRows, 'orderItemSeqId') : itemSeqIds,
      records: [{ source: 'order', type: 'orderDate', at: toMillis(order?.orderDate) }, ...placementRows.map(statusRecord)],
    });
  }

  const importedAt = toMillis(order?.entryDate);
  if (importedAt !== undefined) {
    events.push({
      id: 'imported',
      kind: 'imported',
      at: importedAt,
      isShopify,
      shipGroupSeqIds: [],
      orderItemSeqIds: [],
      records: [{ source: 'order', type: 'entryDate', at: importedAt }],
    });
  }

  rows
    .filter((row) => isHeaderStatus(row) && row.statusId && row.statusId !== 'ORDER_CREATED')
    .forEach((row) => {
      events.push({
        id: `status-${row.orderStatusId || `${row.statusId}-${row.statusDatetime}`}`,
        kind: 'orderStatus',
        statusId: row.statusId,
        reason: row.changeReason || undefined,
        at: toMillis(row.statusDatetime),
        actor: userActor(row.statusUserLogin),
        shipGroupSeqIds: [],
        orderItemSeqIds: [],
        records: [statusRecord(row)],
      });
    });

  // One item-status event per operation: OMS writes a row per item, milliseconds apart.
  clusterEvents(
    rows.filter((row) => !isHeaderStatus(row) && row.statusId && !isPlacement(row)),
    (row) => `${row.statusId}|${row.changeReason || ''}`,
    (row) => rowMillis(row.statusDatetime)
  ).forEach((cluster) => {
    const first = cluster.rows[0];
    events.push({
      id: `item-status-${cluster.id}`,
      kind: 'itemStatus',
      statusId: first.statusId,
      reason: first.changeReason || undefined,
      at: cluster.value,
      actor: userActor(cluster.rows.find((row: any) => row.statusUserLogin)?.statusUserLogin),
      shipGroupSeqIds: [],
      orderItemSeqIds: distinct(cluster.rows, 'orderItemSeqId'),
      records: cluster.rows.map(statusRecord),
    });
  });

  return events;
}
