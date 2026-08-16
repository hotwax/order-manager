import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useOrderDetailStore } from '@/store/orderDetail';
import { UNFILLABLE_SAMPLE_SIZE, useOrderDetail } from '@/composables/useOrderDetail';

vi.mock('@common', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    api: vi.fn(),
    cookieHelper: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() })),
  };
});

vi.mock('@/composables/useOrderDetail', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, useOrderDetail: vi.fn() };
});

vi.mock('@/store/seed', () => ({
  useSeedStore: vi.fn(() => ({ orderAdjustmentTypeDescription: (id: string) => id })),
}));

const ORDER_ID = 'M102510';

/**
 * The order document as `GET oms/orders?dependentLevels=1` returns it. Its OrderHeader
 * `default` master declares `<detail relationship="statuses"/>` unrestricted, so the
 * OrderStatus rows arrive complete — there is no separate status fetch.
 */
function orderEntryWithStatuses(statuses: any[]) {
  return { payload: { statuses }, status: 'loaded' as const, loadedAt: '', error: '' };
}

function mockOrderDetail(overrides: Record<string, any> = {}) {
  vi.mocked(useOrderDetail).mockReturnValue({
    getOrder: vi.fn(),
    getWorkEfforts: vi.fn(),
    getCommunicationEvents: vi.fn(),
    getRiskAssessments: vi.fn(),
    getFacilityChanges: vi.fn().mockResolvedValue({ data: [] }),
    getUnfillableAttempts: vi.fn().mockResolvedValue({ data: [] }),
    getInventoryIssuance: vi.fn().mockResolvedValue({ data: [] }),
    ...overrides,
  } as any);
}

describe('order detail event sources', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useOrderDetail).mockReset();
    mockOrderDetail();
  });

  it('collapses the per-item rows of one facility move into a single event', () => {
    const store = useOrderDetailStore();
    // OMS writes one OrderFacilityChange row per order item; these three are one release.
    store.facilityChangesByOrderId[ORDER_ID] = [
      { orderItemSeqId: '01', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.892', changeUserLogin: 'swati.pandey' },
      { orderItemSeqId: '02', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.898' },
      { orderItemSeqId: '03', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.901' },
    ];

    const events = store.facilityChangeEventsByOrderId(ORDER_ID);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ changeReasonEnumId: 'RELEASED', facilityId: 'BROADWAY', itemCount: 3 });
    // The actor is on one row only; the cluster still reports it.
    expect(events[0].changeUserLogin).toBe('swati.pandey');
  });

  it('keeps a repeated move to the same facility as separate events', () => {
    const store = useOrderDetailStore();
    store.facilityChangesByOrderId[ORDER_ID] = [
      { orderItemSeqId: '01', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.892' },
      { orderItemSeqId: '01', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 15:02:11.100' },
    ];

    expect(store.facilityChangeEventsByOrderId(ORDER_ID)).toHaveLength(2);
  });

  it('groups item cancellations by reason and ignores routine item statuses', () => {
    const store = useOrderDetailStore();
    store.byOrderId[ORDER_ID] = orderEntryWithStatuses([
      { orderItemSeqId: '01', statusId: 'ITEM_CREATED', statusDatetime: '2026-07-08 12:00:00.000' },
      { orderItemSeqId: '01', statusId: 'ITEM_CANCELLED', changeReason: 'AUTO_CANCEL', statusDatetime: '2026-07-08 12:55:14.164', statusUserLogin: 'system' },
      { orderItemSeqId: '02', statusId: 'ITEM_CANCELLED', changeReason: 'AUTO_CANCEL', statusDatetime: '2026-07-08 12:55:14.201' },
      { orderItemSeqId: '03', statusId: 'ITEM_CANCELLED', changeReason: 'BAD_REVIEW', statusDatetime: '2026-07-08 12:55:14.205' },
    ]);

    const events = store.itemStatusEventsByOrderId(ORDER_ID);

    expect(events).toHaveLength(2);
    expect(events.map((event) => [event.changeReason, event.itemCount])).toEqual(
      expect.arrayContaining([['AUTO_CANCEL', 2], ['BAD_REVIEW', 1]])
    );
  });

  it('takes header statuses from the order document, newest first, with actor and reason', () => {
    const store = useOrderDetailStore();
    store.byOrderId[ORDER_ID] = orderEntryWithStatuses([
      { statusId: 'ORDER_APPROVED', statusDatetime: '2026-07-08 10:00:00.000', statusUserLogin: 'ops.user' },
      { statusId: 'ORDER_HOLD', statusDatetime: '2026-07-08 11:00:00.000', statusUserLogin: 'ops.user', changeReason: 'Manual' },
      { orderItemSeqId: '01', statusId: 'ITEM_CANCELLED', statusDatetime: '2026-07-08 12:00:00.000' },
    ]);

    const headerStatuses = store.headerStatusesByOrderId(ORDER_ID);

    // Item-scoped rows are excluded here; they drive the item events instead.
    expect(headerStatuses.map((status: any) => status.statusId)).toEqual(['ORDER_HOLD', 'ORDER_APPROVED']);
    expect(headerStatuses[0].statusUserLogin).toBe('ops.user');
    expect(headerStatuses[0].changeReason).toBe('Manual');
  });

  it('reports no statuses when the order document has not loaded', () => {
    const store = useOrderDetailStore();

    expect(store.headerStatusesByOrderId(ORDER_ID)).toEqual([]);
  });

  it('counts one failed brokering run as one attempt however many items it touched', async () => {
    // Real shape from rails-uat order M107555: one routing run, three unfillable items.
    mockOrderDetail({
      getUnfillableAttempts: vi.fn().mockResolvedValue({
        data: [
          { orderItemSeqId: '03', routingRunId: 'M100510', changeDatetime: '2026-05-28 06:26:06.334' },
          { orderItemSeqId: '02', routingRunId: 'M100510', changeDatetime: '2026-05-28 06:26:06.328' },
          { orderItemSeqId: '01', routingRunId: 'M100510', changeDatetime: '2026-05-28 06:26:06.322' },
        ],
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchOrderEvents(ORDER_ID);

    expect(store.unfillableAttemptsByOrderId(ORDER_ID)).toEqual({
      count: 1,
      atLeast: false,
      lastAttemptDate: '2026-05-28 06:26:06.334',
    });
  });

  it('counts repeated brokering runs separately', async () => {
    mockOrderDetail({
      getUnfillableAttempts: vi.fn().mockResolvedValue({
        data: [
          { orderItemSeqId: '01', routingRunId: 'RUN_2', changeDatetime: '2026-07-18 06:52:09.098' },
          { orderItemSeqId: '02', routingRunId: 'RUN_2', changeDatetime: '2026-07-18 06:52:09.100' },
          { orderItemSeqId: '01', routingRunId: 'RUN_1', changeDatetime: '2026-07-17 06:52:09.098' },
        ],
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchOrderEvents(ORDER_ID);

    expect(store.unfillableAttemptsByOrderId(ORDER_ID)).toMatchObject({ count: 2, atLeast: false });
  });

  it('marks the attempt count as a floor when the sample filled its page', async () => {
    mockOrderDetail({
      getUnfillableAttempts: vi.fn().mockResolvedValue({
        data: Array.from({ length: UNFILLABLE_SAMPLE_SIZE }, (_unused, index) => ({
          routingRunId: `RUN_${index}`,
          changeDatetime: `2026-07-18 06:52:09.${String(index).padStart(3, '0')}`,
        })),
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchOrderEvents(ORDER_ID);

    expect(store.unfillableAttemptsByOrderId(ORDER_ID)).toMatchObject({
      count: UNFILLABLE_SAMPLE_SIZE,
      atLeast: true,
    });
  });

  it('records no unfillable summary when the order has none', async () => {
    const store = useOrderDetailStore();

    await store.fetchOrderEvents(ORDER_ID);

    expect(store.unfillableAttemptsByOrderId(ORDER_ID)).toBeNull();
  });

  it('reads issued quantity and the stock movement from the inventory detail rows', async () => {
    // Real shape from rails-uat order 118954: one issuance row per line. lastQuantityOnHand
    // is the balance before the row, so after = last + diff.
    mockOrderDetail({
      getInventoryIssuance: vi.fn().mockResolvedValue({
        data: [
          { orderItemSeqId: '01', inventoryItemId: '1008212', itemIssuanceId: '108495', quantityOnHandDiff: -1, lastQuantityOnHand: 12, effectiveDate: 1786895792358 },
          { orderItemSeqId: '02', inventoryItemId: '1008213', itemIssuanceId: '108496', quantityOnHandDiff: -1, lastQuantityOnHand: -2, effectiveDate: 1786895792367 },
        ],
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({
      '01': { issued: 1, qohBefore: 12, qohAfter: 11 },
      // Negative stock is normal in this data; the arithmetic is unchanged.
      '02': { issued: 1, qohBefore: -2, qohAfter: -3 },
    });
  });

  it('adds the stock positions when one line issues from two inventory items', async () => {
    mockOrderDetail({
      getInventoryIssuance: vi.fn().mockResolvedValue({
        data: [
          { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '1', quantityOnHandDiff: -1, lastQuantityOnHand: 10, effectiveDate: 1 },
          { orderItemSeqId: '01', inventoryItemId: 'B', itemIssuanceId: '2', quantityOnHandDiff: -2, lastQuantityOnHand: 5, effectiveDate: 2 },
        ],
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({
      '01': { issued: 3, qohBefore: 15, qohAfter: 12 },
    });
  });

  it('chains rather than double-counts two issuances against the same inventory item', async () => {
    // The second row's lastQuantityOnHand already reflects the first, so summing both
    // opening balances would report a stock position that never existed.
    mockOrderDetail({
      getInventoryIssuance: vi.fn().mockResolvedValue({
        data: [
          { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '2', quantityOnHandDiff: -1, lastQuantityOnHand: 9, effectiveDate: 2 },
          { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '1', quantityOnHandDiff: -1, lastQuantityOnHand: 10, effectiveDate: 1 },
        ],
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({
      '01': { issued: 2, qohBefore: 10, qohAfter: 8 },
    });
  });

  it('ignores reservation rows that carry no issuance id', async () => {
    mockOrderDetail({
      getInventoryIssuance: vi.fn().mockResolvedValue({
        data: [
          { orderItemSeqId: '01', inventoryItemId: 'A', reasonEnumId: 'INV_RES_CREATE', availableToPromiseDiff: -1, quantityOnHandDiff: 0, lastQuantityOnHand: 99 },
          { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '108495', quantityOnHandDiff: -1, lastQuantityOnHand: 10, effectiveDate: 2 },
        ],
      }),
    });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({
      '01': { issued: 1, qohBefore: 10, qohAfter: 9 },
    });
  });

  it('reports unknown rather than zero when the issuance call fails', async () => {
    mockOrderDetail({ getInventoryIssuance: vi.fn().mockRejectedValue(new Error('boom')) });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    // Null, not {} — a failed lookup must never render as "inventory not issued".
    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toBeNull();
    expect(store.issuanceStatusByOrderId[ORDER_ID]).toBe('error');
  });

  it('distinguishes an order with no issuance rows from one that never loaded', async () => {
    const store = useOrderDetailStore();
    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toBeNull();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({});
  });

  it('keeps the document statuses and the unfillable summary when facility changes fail', async () => {
    mockOrderDetail({
      getFacilityChanges: vi.fn().mockRejectedValue(new Error('boom')),
      getUnfillableAttempts: vi.fn().mockResolvedValue({
        data: [{ routingRunId: 'RUN_1', changeDatetime: '2026-07-18 06:52:09.098' }],
      }),
    });
    const store = useOrderDetailStore();
    store.byOrderId[ORDER_ID] = orderEntryWithStatuses([
      { statusId: 'ORDER_APPROVED', statusDatetime: '2026-07-08 10:00:00.000' },
    ]);

    await store.fetchOrderEvents(ORDER_ID);

    // Statuses come off the document, so a failed sibling call cannot take them out.
    expect(store.headerStatusesByOrderId(ORDER_ID)).toHaveLength(1);
    expect(store.facilityChangeEventsByOrderId(ORDER_ID)).toEqual([]);
    expect(store.unfillableAttemptsByOrderId(ORDER_ID)).toMatchObject({ count: 1 });
    expect(store.orderEventsStatusByOrderId[ORDER_ID]).toBe('error');
  });
});
