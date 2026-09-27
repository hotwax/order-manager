import { beforeAll, describe, expect, it } from 'vitest';
import { Settings } from 'luxon';
import { buildOrderEvents, type OrderEvent } from '@/utils/orderEvents';
import { chainEvents, formatElapsed, groupTransactions, timelineDays, type TimelineContext } from '@/utils/orderTimeline';

// 2:00 PM on Tuesday, Sep 22, 2026 in Los Angeles.
const T = (seconds: number) => Date.UTC(2026, 8, 22, 21, 0, 0) + seconds * 1_000;
const FACILITIES: Record<string, string> = { WH: 'Main Warehouse', STORE: 'Downtown Store', PARKING: 'Rejected Item Parking', _NA_: 'Brokering Queue' };
const isVirtualFacility = (facilityId: string) => ['PARKING', '_NA_'].includes(facilityId);

const ctx = (itemTotal = 1): TimelineContext => ({
  translate: (key, params) => key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
  facilityName: (facilityId) => FACILITIES[facilityId] ?? facilityId,
  statusDescription: (statusId) => statusId,
  describe: (value) => value,
  enumDescription: (enumId) => enumId,
  isVirtualFacility,
  itemTotal,
  shipGroupOfItem: { '01': '00001', '02': '00001' },
  posShipGroupIds: new Set(),
  orderLabel: (orderId) => orderId,
  itemLabel: (orderItemSeqId) => ({ '01': 'TEE-M', '02': 'HOODIE-L' } as Record<string, string>)[orderItemSeqId] ?? '',
});

/** A Shopify order placed at T(0) and imported at T(600), with its later history. */
function timeline(statuses: any[], facilityChanges: any[] = [], items = ['01']) {
  const events = buildOrderEvents({
    order: {
      orderId: 'O1', orderDate: T(0), entryDate: T(600), salesChannelEnumId: 'WEB_SALES_CHANNEL',
      identifications: [{ orderIdentificationTypeId: 'SHOPIFY_ORD_ID' }],
      shipGroups: [{ shipGroupSeqId: '00001', facilityId: 'WH', items: items.map((orderItemSeqId) => ({ orderItemSeqId })) }],
      statuses: [{ statusId: 'ORDER_CREATED', statusDatetime: T(0) }, ...statuses],
    },
    facilityChanges, facilityChangesLoaded: true, unfillable: null, fulfillment: [],
    returnHeadersById: {}, exchangeChildren: [], isVirtualFacility,
  });
  return groupTransactions(events, ctx(items.length));
}

const move = (orderItemSeqId: string, changeReasonEnumId: string | undefined, fromFacilityId: string, facilityId: string, at: number, changeUserLogin?: string) =>
  ({ orderItemSeqId, changeReasonEnumId, fromFacilityId, facilityId, changeDatetime: at, changeUserLogin });

beforeAll(() => {
  Settings.defaultZone = 'America/Los_Angeles';
});

describe('groupTransactions', () => {
  it('reads a Shopify cancellation at import as one line, never a rejection', () => {
    const [placed, imported] = timeline([
      { statusId: 'ORDER_APPROVED', statusDatetime: T(600.01) },
      { orderItemSeqId: '01', statusId: 'ITEM_CANCELLED', changeReason: 'SHOPIFY_CANCELLATION', statusDatetime: T(600.04) },
      { statusId: 'ORDER_CANCELLED', changeReason: 'SHOPIFY_CANCELLATION', statusDatetime: T(600.05) },
    ], [move('01', 'SHOPIFY_CANCELLATION', 'WH', 'PARKING', T(600.03))]);

    expect(placed.headline).toBe('Order placed in Shopify');
    expect(imported).toMatchObject({ headline: 'Imported, already cancelled in Shopify', details: ['TEE-M from Main Warehouse'], notes: [] });
    expect(imported.records.map((record) => record.title)).toEqual(['Created in HotWax', 'ORDER_APPROVED', 'Moved to parking', 'ITEM_CANCELLED', 'ORDER_CANCELLED']);
  });

  it('keeps First brokered, and reads two rows to one place once', () => {
    // The brokering lands 3 s after the import, so it is its own line.
    const txs = timeline([{ statusId: 'ORDER_APPROVED', statusDatetime: T(603.3) }], [
      move('01', 'BROKERED', '_NA_', 'STORE', T(603)), move('02', 'BROKERED', '_NA_', 'STORE', T(603.1)),
      move('01', undefined, 'STORE', 'STORE', T(603.2)), move('02', undefined, 'STORE', 'STORE', T(603.2)),
    ], ['01', '02']);

    expect(txs.map((tx) => tx.headline)).toEqual(['Order placed in Shopify', 'Imported from Shopify', 'First brokered']);
    expect(txs[2]).toMatchObject({ details: ['2 items to Downtown Store'], notes: ['Approved for fulfillment'] });
  });

  it('reads the move into parking an operator cancellation makes as the cancellation', () => {
    const cancelled = timeline([
      ...['01', '02'].map((orderItemSeqId) => ({ orderItemSeqId, statusId: 'ITEM_CANCELLED', changeReason: 'NO_VARIANCE_LOG', statusUserLogin: 'ops.user', statusDatetime: T(9000.2) })),
      { statusId: 'ORDER_CANCELLED', changeReason: 'NO_VARIANCE_LOG', statusUserLogin: 'ops.user', statusDatetime: T(9000.4) },
    ], ['01', '02'].map((id) => move(id, 'NO_VARIANCE_LOG', 'WH', 'PARKING', T(9000.1), 'ops.user')), ['01', '02']).pop()!;

    expect(cancelled).toMatchObject({ headline: 'Order cancelled', details: ['2 items from Main Warehouse'], notes: [], reason: 'NO_VARIANCE_LOG', actor: 'ops.user' });
    expect(cancelled.records.map((record) => record.title)).not.toContain('Rejected');
    // The row names the reason and the person once; the records do not repeat them.
    expect(cancelled.records.flatMap((record) => record.lines)).not.toContain('By ops.user');
  });

  it('folds a store rejecting and releasing an item into one run that keeps every step', () => {
    const txs = timeline([], [
      move('01', 'RELEASED', '_NA_', 'STORE', T(700), 'lead'),
      move('01', 'NO_VARIANCE_LOG', 'STORE', 'PARKING', T(5000), 'lead'),
      move('01', 'RELEASED', 'PARKING', 'STORE', T(5400), 'lead'),
      move('01', 'NOT_IN_STOCK', 'STORE', 'PARKING', T(5430), 'lead'),
      move('01', 'RELEASED', 'PARKING', 'STORE', T(5480), 'lead'),
      move('01', 'NOT_IN_STOCK', 'STORE', 'PARKING', T(5500), 'lead'),
      move('01', 'RELEASED', 'PARKING', 'WH', T(90000), 'ops.user'),
    ]);
    const run = txs[3];

    expect(txs.map((tx) => tx.headline)).toEqual(['Order placed in Shopify', 'Imported from Shopify', 'First brokered', 'Rejected and re-brokered', 'Released']);
    expect(txs[2].details).toEqual(['TEE-M released to Downtown Store']);
    expect(run.details).toEqual(['3 rejections and 2 releases']);
    expect(run.children!.map((tx) => [tx.headline, tx.details[0], tx.reason])).toEqual([
      ['Rejected', 'TEE-M from Downtown Store', 'NO_VARIANCE_LOG'],
      ['Released', 'TEE-M to Downtown Store', ''],
      ['Rejected', 'TEE-M from Downtown Store', 'NOT_IN_STOCK'],
      ['Released', 'TEE-M to Downtown Store', ''],
      ['Rejected', 'TEE-M from Downtown Store', 'NOT_IN_STOCK'],
    ]);
  });
});

describe('chainEvents', () => {
  const event = (seconds: number, login?: string): OrderEvent => ({
    id: `m${seconds}`, kind: 'move', move: 'rejected', at: T(seconds), actor: login ? { kind: 'user', login } : undefined,
    shipGroupSeqIds: [], orderItemSeqIds: ['01'], records: [],
  });

  it('chains events less than 2 s apart and splits at a longer gap', () => {
    expect(chainEvents([event(0), event(1), event(2.5), event(6)]).map((group) => group.length)).toEqual([3, 1]);
  });

  it('never merges two people\'s actions, however close', () => {
    expect(chainEvents([event(0, 'amy'), event(0.5, 'raj')]).map((group) => group.length)).toEqual([1, 1]);
  });

  it('caps a transaction at 10 s', () => {
    expect(chainEvents(Array.from({ length: 12 }, (_, index) => event(index * 1.5))).map((group) => group.length)).toEqual([7, 5]);
  });
});

describe('timelineDays', () => {
  it('puts each line under its day with the time since the line before', () => {
    const txs = timeline([{ orderItemSeqId: '01', statusId: 'ITEM_CANCELLED', statusDatetime: T(2 * 86_400 + 3_900) }]);
    const days = timelineDays(txs, ctx());

    expect(days.map((day) => day.label)).toEqual(['Tuesday, Sep 22, 2026', 'Thursday, Sep 24, 2026']);
    expect(days.flatMap((day) => day.entries.map((entry) => [entry.time, entry.elapsed]))).toEqual([
      ['2:00 PM', ''],
      ['2:10 PM', '10 minutes later'],
      ['3:05 PM', '2 days 1 hour later'],
    ]);
  });
});

describe('formatElapsed', () => {
  const T0 = Date.UTC(2026, 8, 1, 10, 0, 0);
  const minutes = (count: number) => count * 60_000;

  it.each([
    [20_000, ''],
    [minutes(1), '1 minute'],
    [minutes(59) + 40_000, '59 minutes'],
    [minutes(179) + 45_000, '3 hours'],
    [minutes(25 * 60), '1 day 1 hour'],
    [minutes(42 * 60 + 57), '1 day 19 hours'],
    [-minutes(3), ''],
  ])('reads %d ms as "%s"', (span, expected) => {
    expect(formatElapsed(T0, T0 + span, ctx().translate)).toBe(expected);
  });
});
