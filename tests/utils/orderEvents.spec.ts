import { describe, expect, it } from 'vitest';
import { buildOrderEvents, moveKind, shipGroupMilestones, type OrderEvent, type OrderEventOf, type OrderEventSources } from '@/utils/orderEvents';

const T = (seconds: number) => 1_790_000_000_000 + seconds * 1_000;

function sources(overrides: Partial<OrderEventSources> = {}): OrderEventSources {
  return {
    order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [] },
    facilityChanges: [],
    facilityChangesLoaded: true,
    unfillable: null,
    fulfillment: [],
    returnHeadersById: {},
    exchangeChildren: [],
    isVirtualFacility: (facilityId) => ['_NA_', 'PARKING'].includes(facilityId),
    ...overrides,
  };
}

const ofKind = <K extends OrderEvent['kind']>(events: OrderEvent[], kind: K) =>
  events.filter((event): event is OrderEventOf<K> => event.kind === kind);

describe('buildOrderEvents', () => {
  it('collapses the per-item rows of one facility move into a single event', () => {
    // OMS writes one OrderFacilityChange row per order item; these three are one release.
    const events = buildOrderEvents(sources({
      facilityChanges: [
        { orderItemSeqId: '01', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.892', changeUserLogin: 'swati.pandey' },
        { orderItemSeqId: '02', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.898' },
        { orderItemSeqId: '03', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.901' },
      ],
    }));

    const moves = ofKind(events, 'move');
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ move: 'released', toFacilityId: 'BROADWAY', orderItemSeqIds: ['01', '02', '03'] });
    // The actor is on one row only; the event still reports it, and keeps every row as a record.
    expect(moves[0].actor).toEqual({ kind: 'user', login: 'swati.pandey' });
    expect(moves[0].records).toHaveLength(3);
  });

  it('groups item cancellations by reason, and folds the items created with the order into placing it', () => {
    const events = buildOrderEvents(sources({
      order: {
        orderId: 'O1', orderDate: '2026-07-08 12:00:00.000', shipGroups: [],
        statuses: [
          { orderItemSeqId: '01', statusId: 'ITEM_CREATED', statusDatetime: '2026-07-08 12:00:00.000' },
          { orderItemSeqId: '01', statusId: 'ITEM_CANCELLED', changeReason: 'AUTO_CANCEL', statusDatetime: '2026-07-08 12:55:14.164', statusUserLogin: 'system' },
          { orderItemSeqId: '02', statusId: 'ITEM_CANCELLED', changeReason: 'AUTO_CANCEL', statusDatetime: '2026-07-08 12:55:14.201' },
          { orderItemSeqId: '03', statusId: 'ITEM_CANCELLED', changeReason: 'BAD_REVIEW', statusDatetime: '2026-07-08 12:55:14.205' },
          { orderItemSeqId: '04', statusId: 'ITEM_CREATED', statusDatetime: '2026-07-09 09:00:00.000' },
        ],
      },
    }));

    const items = ofKind(events, 'itemStatus');
    expect(items.filter((event) => event.statusId === 'ITEM_CANCELLED').map((event) => [event.reason, event.orderItemSeqIds.length]))
      .toEqual([['AUTO_CANCEL', 2], ['BAD_REVIEW', 1]]);
    // Item 01 was created with the order; item 04 was added a day later, which is its own event.
    expect(ofKind(events, 'placed')[0].records.map((record) => record.type)).toEqual(['orderDate', 'ITEM_CREATED']);
    expect(items.filter((event) => event.statusId === 'ITEM_CREATED').map((event) => event.orderItemSeqIds)).toEqual([['04']]);
  });

  it.each([
    [{ changeReasonEnumId: 'BROKERED' }, 'brokered'],
    [{ changeReasonEnumId: 'RELEASED' }, 'released'],
    [{ changeReasonEnumId: 'ALLOCATED' }, 'allocated'],
    [{ changeReasonEnumId: 'PARKED' }, 'parked'],
    [{ changeReasonEnumId: 'SHOPIFY_CANCELLATION' }, 'cancelled'],
    [{ changeReasonEnumId: 'NOT_IN_STOCK' }, 'rejected'],
    [{ changeReasonEnumId: 'INV_NOT_FOUND' }, 'rejected'],
    [{ fromFacilityId: 'AUSTIN', facilityId: 'AUSTIN' }, 'assigned'],
    [{ facilityId: 'AUSTIN' }, 'assigned'],
    [{ fromFacilityId: 'AUSTIN', facilityId: 'BOSTON' }, 'moved'],
  ])('reads %j as a %s move', (row, expected) => {
    expect(moveKind(row)).toBe(expected);
  });

  it('names the system behind a move from its comment when no person made it', () => {
    const [move] = ofKind(buildOrderEvents(sources({
      facilityChanges: [{ changeReasonEnumId: 'ALLOCATED', fromFacilityId: 'PARKING', facilityId: 'WH', changeDatetime: T(10), comments: 'Shopify fulfillment sync: fulfilled at this location' }],
    })), 'move');

    expect(move.actor).toEqual({ kind: 'system', name: 'Shopify fulfillment sync' });
  });

  it('marks the first brokering, whether it was an import assignment or a release', () => {
    const firstOf = (facilityChanges: any[]) => ofKind(buildOrderEvents(sources({ facilityChanges })), 'move')
      .filter((move) => move.isFirst).map((move) => [move.move, move.toFacilityId]);

    // An import that assigned the item to a store counts as brokering it.
    expect(firstOf([
      { fromFacilityId: 'STORE', facilityId: 'STORE', changeDatetime: T(10) },
      { changeReasonEnumId: 'BROKERED', fromFacilityId: '_NA_', facilityId: 'WH', changeDatetime: T(500) },
    ])).toEqual([['assigned', 'STORE']]);
    expect(firstOf([
      { changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'STORE', changeDatetime: T(10) },
      { changeReasonEnumId: 'NOT_IN_STOCK', fromFacilityId: 'STORE', facilityId: 'PARKING', changeDatetime: T(500) },
      { changeReasonEnumId: 'RELEASED', fromFacilityId: 'PARKING', facilityId: 'WH', changeDatetime: T(900) },
    ])).toEqual([['released', 'STORE']]);
  });

  it('never counts an assignment to a parking facility as brokering', () => {
    const moves = ofKind(buildOrderEvents(sources({
      facilityChanges: [
        { fromFacilityId: 'PARKING', facilityId: 'PARKING', changeDatetime: T(10) },
        { changeReasonEnumId: 'BROKERED', fromFacilityId: '_NA_', facilityId: 'WH', changeDatetime: T(500) },
      ],
    })), 'move');

    expect(moves.map((move) => [move.move, !!move.isFirst])).toEqual([['assigned', false], ['brokered', true]]);
  });

  it('recovers the brokering dates from the fulfillment timeline when facility changes did not load', () => {
    const moves = ofKind(buildOrderEvents(sources({
      facilityChanges: [],
      facilityChangesLoaded: false,
      fulfillment: [{ shipGroupSeqId: '00001', firstBrokeredDate: T(40) }, { shipGroupSeqId: '00002', firstReleasedDate: T(30) }],
    })), 'move');

    expect(moves.map((move) => [move.move, move.at, !!move.isFirst])).toEqual([['released', T(30), true], ['brokered', T(40), false]]);
  });

  it('dates a return by its return date and drops a facility of _NA_', () => {
    // The return items were written by the import; the return itself happened earlier.
    const [ret] = ofKind(buildOrderEvents(sources({
      order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [], returnItems: [{ returnId: 'R1', orderItemSeqId: '01', returnQuantity: 1, createdStamp: T(9000) }] },
      returnHeadersById: { R1: { returnDate: String(T(4000)), destinationFacilityId: '_NA_' } },
    })), 'return');

    expect(ret).toMatchObject({ at: T(4000), atKind: undefined, facilityId: undefined, link: { kind: 'return', id: 'R1' } });
  });

  it('falls back to when the return was recorded, and says so, when its header is unavailable', () => {
    const [ret] = ofKind(buildOrderEvents(sources({
      order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [], returnItems: [{ returnId: 'R1', orderItemSeqId: '01', returnQuantity: 2, createdStamp: T(900) }] },
      returnHeadersById: { R1: null },
    })), 'return');

    expect(ret).toMatchObject({ at: T(900), atKind: 'recorded', itemCount: 2 });
  });

  it('leaves an event undated rather than borrowing the order date, and sorts it last', () => {
    const events = buildOrderEvents(sources({
      exchangeChildren: [{ orderId: 'O2', itemCount: 1, facilityId: '', value: 0 }],
      facilityChanges: [{ changeReasonEnumId: 'BROKERED', fromFacilityId: '_NA_', facilityId: 'WH', changeDatetime: T(10) }],
    }));

    expect(events[events.length - 1]).toMatchObject({ kind: 'exchange', direction: 'to', at: undefined });
  });

  it('adds picked, packed and shipped per ship group from the fulfillment timeline', () => {
    const events = buildOrderEvents(sources({
      order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [{ shipGroupSeqId: '00001', facilityId: 'WH', items: [{ orderItemSeqId: '01' }, { orderItemSeqId: '02', statusId: 'ITEM_CANCELLED' }] }] },
      fulfillment: [{ shipGroupSeqId: '00001', picklistDate: T(100), packedDate: T(200), shippedDate: T(300) }],
    }));

    expect(ofKind(events, 'fulfillment').map((event) => [event.step, event.at, event.facilityId, event.orderItemSeqIds])).toEqual([
      ['picked', T(100), 'WH', ['01']],
      ['packed', T(200), 'WH', ['01']],
      ['shipped', T(300), 'WH', ['01']],
    ]);
  });
});

describe('shipGroupMilestones', () => {
  it('dates a physical group from its earliest facility change when it has no brokered row', () => {
    const events = buildOrderEvents(sources({
      facilityChanges: [
        { shipGroupSeqId: '00001', fromFacilityId: 'STORE_A', facilityId: 'STORE_A', changeDatetime: T(20) },
        { shipGroupSeqId: '00001', changeReasonEnumId: 'ALLOCATED', fromFacilityId: 'PARKING', facilityId: 'STORE_A', changeDatetime: T(10) },
        { shipGroupSeqId: '00002', changeReasonEnumId: 'PARKED', fromFacilityId: '_NA_', facilityId: 'PARKING', changeDatetime: T(5) },
      ],
      fulfillment: [{ shipGroupSeqId: '00001', picklistDate: T(100) }],
    }));

    expect(shipGroupMilestones(events, '00001', false)).toEqual({ firstBrokeredDate: T(10), picklistDate: T(100), packedDate: undefined, shippedDate: undefined });
    // A parked group's facility changes record parking and rejections, never a brokering.
    expect(shipGroupMilestones(events, '00002', true).firstBrokeredDate).toBeUndefined();
  });
});
