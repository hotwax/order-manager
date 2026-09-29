import { toMillis } from '@/utils/format';
import type { ExchangeChild, OrderEvent } from './types';

const NOT_A_FACILITY = '_NA_';

export const realFacilityId = (facilityId?: string) => (facilityId && facilityId !== NOT_A_FACILITY ? facilityId : undefined);

/**
 * One event per return raised against the order. The return header carries the business date
 * (returnDate) and where it was processed; the embedded ReturnItem rows carry only the time they
 * were written, which on an imported order is the import. That write time is used only when the
 * header could not be loaded, and is marked as such.
 */
export function returnEvents(order: any, returnHeadersById: Record<string, any | null>): OrderEvent[] {
  const byReturn = new Map<string, any[]>();
  (order?.returnItems || []).forEach((item: any) => {
    if (!item.returnId) return;
    if (!byReturn.has(item.returnId)) byReturn.set(item.returnId, []);
    byReturn.get(item.returnId)!.push(item);
  });

  return [...byReturn.entries()].map(([returnId, items]) => {
    const header = returnHeadersById[returnId];
    const businessDate = toMillis(header?.returnDate) ?? toMillis(header?.entryDate);
    const writtenAt = items.map((item) => toMillis(item.createdStamp)).filter((value): value is number => value !== undefined);
    const recordedAt = writtenAt.length ? Math.min(...writtenAt) : undefined;
    return {
      id: `return-${returnId}`,
      kind: 'return' as const,
      returnId,
      itemCount: items.reduce((sum, item) => sum + (Number(item.returnQuantity || 0) || 1), 0),
      facilityId: realFacilityId(header?.destinationFacilityId),
      at: businessDate ?? recordedAt,
      atKind: businessDate === undefined && recordedAt !== undefined ? 'recorded' as const : undefined,
      shipGroupSeqIds: [],
      orderItemSeqIds: [...new Set(items.map((item) => item.orderItemSeqId).filter(Boolean))],
      records: items.map((item) => ({
        source: 'return' as const,
        type: item.statusId || 'RETURN_ITEM',
        at: toMillis(item.createdStamp),
        orderItemSeqId: item.orderItemSeqId,
        refId: item.returnId,
      })),
      link: { kind: 'return' as const, id: returnId },
    };
  });
}

/**
 * Exchange lineage both ways: OrderItemAssoc rows of type EXCHANGE on this order point at the
 * order it was exchanged from; exchange orders created from this one are discovered by the store.
 */
export function exchangeEvents(order: any, children: ExchangeChild[]): OrderEvent[] {
  const orderId = order?.orderId;
  const assocs = (order?.itemAssocs || []).filter((assoc: any) =>
    assoc.orderItemAssocTypeId === 'EXCHANGE' && assoc.toOrderId && assoc.toOrderId !== orderId);
  const sources = [...new Set<string>(assocs.map((assoc: any) => assoc.toOrderId))];

  return [
    ...sources.map((sourceId) => {
      const rows = assocs.filter((assoc: any) => assoc.toOrderId === sourceId);
      const dates = rows.map((row: any) => toMillis(row.createdStamp)).filter((value: any): value is number => value !== undefined);
      return {
        id: `exchange-from-${sourceId}`,
        kind: 'exchange' as const,
        direction: 'from' as const,
        orderId: sourceId,
        at: dates.length ? Math.min(...dates) : undefined,
        shipGroupSeqIds: [],
        orderItemSeqIds: [...new Set<string>(rows.map((row: any) => row.orderItemSeqId).filter(Boolean))],
        records: rows.map((row: any) => ({ source: 'exchange' as const, type: 'EXCHANGE', at: toMillis(row.createdStamp), orderItemSeqId: row.orderItemSeqId, refId: sourceId })),
        link: { kind: 'exchangeSource' as const, id: sourceId },
      };
    }),
    ...children.map((child) => ({
      id: `exchange-to-${child.orderId}`,
      kind: 'exchange' as const,
      direction: 'to' as const,
      orderId: child.orderId,
      itemCount: child.itemCount,
      facilityId: realFacilityId(child.facilityId),
      at: child.value || undefined,
      shipGroupSeqIds: [],
      orderItemSeqIds: [],
      records: [{ source: 'exchange' as const, type: 'EXCHANGE', at: child.value || undefined, refId: child.orderId }],
      link: { kind: 'exchangeChild' as const, id: child.orderId },
    })),
  ];
}
