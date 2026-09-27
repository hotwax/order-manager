import { describe, expect, it } from 'vitest';
import { buildOrderEvents, moveKind, shipGroupMilestones, type OrderEvent, type OrderEventOf, type OrderEventSources } from '@/utils/orderEvents';

const T = (seconds: number) => 1_790_000_000_000 + seconds * 1_000;

const build = (overrides: Partial<OrderEventSources> = {}) => buildOrderEvents({
  order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [] },
  facilityChanges: [], facilityChangesLoaded: true, unfillable: null, fulfillment: [], returnHeadersById: {}, exchangeChildren: [],
  isVirtualFacility: (facilityId) => ['_NA_', 'PARKING'].includes(facilityId),
  ...overrides,
});

const ofKind = <K extends OrderEvent['kind']>(events: OrderEvent[], kind: K) =>
  events.filter((event): event is OrderEventOf<K> => event.kind === kind);

const move = (changeReasonEnumId: string | undefined, fromFacilityId: string, facilityId: string, at: number, extra: Record<string, any> = {}) =>
  ({ orderItemSeqId: '01', shipGroupSeqId: '00001', changeReasonEnumId, fromFacilityId, facilityId, changeDatetime: T(at), ...extra });

describe('buildOrderEvents', () => {
  it('reads the per-item rows of one move as one event, with the actor any row names', () => {
    const [released] = ofKind(build({
      facilityChanges: ['01', '02', '03'].map((orderItemSeqId, index) => move('RELEASED', '_NA_', 'STORE', 10 + index * 0.01, { orderItemSeqId, changeUserLogin: index ? undefined : 'amy' })),
    }), 'move');

    expect(released).toMatchObject({ move: 'released', orderItemSeqIds: ['01', '02', '03'], actor: { kind: 'user', login: 'amy' } });
    // A system move names its system in the comment.
    const synced = ofKind(build({ facilityChanges: [move('ALLOCATED', 'PARKING', 'WH', 10, { comments: 'Shopify fulfillment sync: fulfilled at this location' })] }), 'move')[0];
    expect(synced.actor).toEqual({ kind: 'system', name: 'Shopify fulfillment sync' });
  });

  it.each([
    [{ changeReasonEnumId: 'BROKERED' }, 'brokered'],
    [{ changeReasonEnumId: 'SHOPIFY_CANCELLATION' }, 'cancelled'],
    [{ changeReasonEnumId: 'NOT_IN_STOCK' }, 'rejected'],
    [{ fromFacilityId: 'STORE', facilityId: 'STORE' }, 'assigned'],
    [{ fromFacilityId: 'STORE', facilityId: 'WH' }, 'moved'],
  ])('reads %j as a %s move', (row, expected) => {
    expect(moveKind(row)).toBe(expected);
  });

  it('marks the first brokering, whether an import assignment to a store or a release', () => {
    const firstOf = (facilityChanges: any[]) => ofKind(build({ facilityChanges }), 'move').filter((event) => event.isFirst).map((event) => event.move);

    expect(firstOf([move(undefined, 'STORE', 'STORE', 10), move('BROKERED', '_NA_', 'WH', 500)])).toEqual(['assigned']);
    expect(firstOf([move('RELEASED', '_NA_', 'STORE', 10), move('NOT_IN_STOCK', 'STORE', 'PARKING', 500), move('RELEASED', 'PARKING', 'WH', 900)])).toEqual(['released']);
    // Items placed in parking at import were not brokered.
    expect(firstOf([move(undefined, 'PARKING', 'PARKING', 10), move('BROKERED', '_NA_', 'WH', 500)])).toEqual(['brokered']);
  });

  it('takes the first brokering from the fulfillment timeline when facility changes are cut off or missing', () => {
    const moves = (overrides: Partial<OrderEventSources>) => ofKind(build(overrides), 'move').map((event) => [event.at, !!event.isFirst]);
    const fulfillment = [{ shipGroupSeqId: '00001', firstBrokeredDate: T(100) }];

    expect(moves({ facilityChanges: [move('BROKERED', '_NA_', 'WH', 5000)], facilityChangesTruncated: true, fulfillment })).toEqual([[T(100), true], [T(5000), false]]);
    // Without that date, nothing on a cut-off page is called first.
    expect(moves({ facilityChanges: [move('BROKERED', '_NA_', 'WH', 5000)], facilityChangesTruncated: true })).toEqual([[T(5000), false]]);
    expect(moves({ facilityChangesLoaded: false, fulfillment })).toEqual([[T(100), true]]);
  });

  it('dates a return by its return date, or by when it was recorded, and never at _NA_', () => {
    const returnOf = (header: any) => ofKind(build({
      order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [], returnItems: [{ returnId: 'R1', orderItemSeqId: '01', returnQuantity: 1, createdStamp: T(9000) }] },
      returnHeadersById: { R1: header },
    }), 'return')[0];

    expect(returnOf({ returnDate: String(T(4000)), destinationFacilityId: '_NA_' })).toMatchObject({ at: T(4000), atKind: undefined, facilityId: undefined });
    expect(returnOf(null)).toMatchObject({ at: T(9000), atKind: 'recorded' });
  });

  it('adds picked, packed and shipped per ship group, and dates the group from them', () => {
    const events = build({
      order: { orderId: 'O1', orderDate: T(0), statuses: [], shipGroups: [{ shipGroupSeqId: '00001', facilityId: 'WH', items: [{ orderItemSeqId: '01' }] }] },
      facilityChanges: [move(undefined, 'WH', 'WH', 20), move('ALLOCATED', 'PARKING', 'WH', 10), move('PARKED', '_NA_', 'PARKING', 5, { shipGroupSeqId: '00002' })],
      fulfillment: [{ shipGroupSeqId: '00001', picklistDate: T(100), packedDate: T(200), shippedDate: T(300) }],
    });

    expect(ofKind(events, 'fulfillment').map((event) => [event.step, event.facilityId])).toEqual([['picked', 'WH'], ['packed', 'WH'], ['shipped', 'WH']]);
    // With no brokered row, a real facility's earliest move dates its brokering; a parked group has none.
    expect(shipGroupMilestones(events, '00001', false)).toEqual({ firstBrokeredDate: T(10), picklistDate: T(100), packedDate: T(200), shippedDate: T(300) });
    expect(shipGroupMilestones(events, '00002', true).firstBrokeredDate).toBeUndefined();
  });

  it('leaves an event undated rather than borrowing the order date, and sorts it last', () => {
    const events = build({ exchangeChildren: [{ orderId: 'O2', itemCount: 1, facilityId: '', value: 0 }], facilityChanges: [move('BROKERED', '_NA_', 'WH', 10)] });

    expect(events[events.length - 1]).toMatchObject({ kind: 'exchange', at: undefined });
  });
});
