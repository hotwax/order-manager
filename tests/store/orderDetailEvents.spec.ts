import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useOrderDetailStore } from '@/store/orderDetail';
import { api } from '@common';
import { FACILITY_CHANGE_PAGE_SIZE, UNFILLABLE_SAMPLE_SIZE, useOrderDetail } from '@/composables/useOrderDetail';

vi.mock('@common', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    api: vi.fn(),
    cookieHelper: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() })),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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
    getCommunicationEvents: vi.fn(),
    getRiskAssessments: vi.fn(),
    getFacilityChanges: vi.fn().mockResolvedValue({ data: [] }),
    getUnfillableAttempts: vi.fn().mockResolvedValue({ data: [] }),
    getInventoryIssuance: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any);
}

describe('order detail event sources', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useOrderDetail).mockReset();
    mockOrderDetail();
  });

  it('builds the order events from the document statuses and the loaded facility changes', () => {
    const store = useOrderDetailStore();
    store.byOrderId[ORDER_ID] = orderEntryWithStatuses([
      { statusId: 'ORDER_APPROVED', statusDatetime: '2026-06-26 14:00:00.000', statusUserLogin: 'ops.user' },
    ]);
    // OMS writes one OrderFacilityChange row per order item; these three are one release.
    store.facilityChangesByOrderId[ORDER_ID] = [
      { orderItemSeqId: '01', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.892', changeUserLogin: 'swati.pandey' },
      { orderItemSeqId: '02', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.898' },
      { orderItemSeqId: '03', changeReasonEnumId: 'RELEASED', fromFacilityId: '_NA_', facilityId: 'BROADWAY', changeDatetime: '2026-06-26 14:17:51.901' },
    ];

    const events = store.orderEventsByOrderId(ORDER_ID);

    expect(events.map((event) => event.kind)).toEqual(['orderStatus', 'move']);
    expect(events[1]).toMatchObject({ move: 'released', orderItemSeqIds: ['01', '02', '03'], isFirst: true });
  });

  it('has no events when the order document has not loaded', () => {
    const store = useOrderDetailStore();

    expect(store.orderEventsByOrderId(ORDER_ID)).toEqual([]);
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
      getInventoryIssuance: vi.fn().mockResolvedValue([
        { orderItemSeqId: '01', inventoryItemId: '1008212', itemIssuanceId: '108495', quantityOnHandDiff: -1, lastQuantityOnHand: 12, effectiveDate: 1786895792358 },
        { orderItemSeqId: '02', inventoryItemId: '1008213', itemIssuanceId: '108496', quantityOnHandDiff: -1, lastQuantityOnHand: -2, effectiveDate: 1786895792367 },
      ]),
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
      getInventoryIssuance: vi.fn().mockResolvedValue([
        { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '1', quantityOnHandDiff: -1, lastQuantityOnHand: 10, effectiveDate: 1 },
        { orderItemSeqId: '01', inventoryItemId: 'B', itemIssuanceId: '2', quantityOnHandDiff: -2, lastQuantityOnHand: 5, effectiveDate: 2 },
      ]),
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
      getInventoryIssuance: vi.fn().mockResolvedValue([
        { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '2', quantityOnHandDiff: -1, lastQuantityOnHand: 9, effectiveDate: 2 },
        { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '1', quantityOnHandDiff: -1, lastQuantityOnHand: 10, effectiveDate: 1 },
      ]),
    });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({
      '01': { issued: 2, qohBefore: 10, qohAfter: 8 },
    });
  });

  it('ignores reservation rows that carry no issuance id', async () => {
    mockOrderDetail({
      getInventoryIssuance: vi.fn().mockResolvedValue([
        { orderItemSeqId: '01', inventoryItemId: 'A', reasonEnumId: 'INV_RES_CREATE', availableToPromiseDiff: -1, quantityOnHandDiff: 0, lastQuantityOnHand: 99 },
        { orderItemSeqId: '01', inventoryItemId: 'A', itemIssuanceId: '108495', quantityOnHandDiff: -1, lastQuantityOnHand: 10, effectiveDate: 2 },
      ]),
    });
    const store = useOrderDetailStore();

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(store.issuanceByItemSeqIdByOrderId(ORDER_ID)).toEqual({
      '01': { issued: 1, qohBefore: 10, qohAfter: 9 },
    });
  });

  it('asks for the product and facility of every POS-completed line, and no others', async () => {
    const getInventoryIssuance = vi.fn().mockResolvedValue([]);
    mockOrderDetail({ getInventoryIssuance });
    const store = useOrderDetailStore();
    store.byOrderId[ORDER_ID] = {
      payload: {
        shipGroups: [
          { shipGroupSeqId: '00001', shipmentMethodTypeId: 'POS_COMPLETED', facilityId: 'FASHION_ISLAND', items: [{ orderItemSeqId: '01', productId: '151000' }] },
          { shipGroupSeqId: '00002', shipmentMethodTypeId: 'STANDARD', facilityId: 'BROADWAY', items: [{ orderItemSeqId: '02', productId: '151001' }] },
        ],
      },
      status: 'loaded', loadedAt: '', error: '',
    } as any;

    await store.fetchInventoryIssuance(ORDER_ID);

    expect(getInventoryIssuance).toHaveBeenCalledWith(ORDER_ID, [{ productId: '151000', facilityId: 'FASHION_ISLAND' }]);
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
    const events = store.orderEventsByOrderId(ORDER_ID);
    expect(events.filter((event) => event.kind === 'orderStatus')).toHaveLength(1);
    expect(events.filter((event) => event.kind === 'move')).toEqual([]);
    expect(store.unfillableAttemptsByOrderId(ORDER_ID)).toMatchObject({ count: 1 });
    // The timeline says some history is missing.
    expect(store.orderHistoryStatus(ORDER_ID)).toEqual({ loading: false, failed: true, truncated: false });
  });

  it('fetches again after a load that was already running when a forced reload arrives', async () => {
    // An action reloads the order while the first load is still in flight: the reload must not
    // return the rows fetched before the action.
    let release!: () => void;
    const firstLoad = new Promise<{ data: any[] }>((resolve) => { release = () => resolve({ data: [] }); });
    const getFacilityChanges = vi.fn()
      .mockReturnValueOnce(firstLoad)
      .mockResolvedValueOnce({ data: [{ orderItemSeqId: '01', changeReasonEnumId: 'NOT_IN_STOCK', fromFacilityId: 'BROADWAY', facilityId: 'PARKING', changeDatetime: 1_790_000_000_000 }] });
    mockOrderDetail({ getFacilityChanges });
    const store = useOrderDetailStore();

    const initial = store.fetchOrderEvents(ORDER_ID);
    const reload = store.fetchOrderEvents(ORDER_ID, true);
    release();
    await Promise.all([initial, reload]);

    expect(getFacilityChanges).toHaveBeenCalledTimes(2);
    expect(store.facilityChangesByOrderId[ORDER_ID]).toHaveLength(1);
  });

  it('clears a failure when the history is fetched again', async () => {
    const getFacilityChanges = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: [] });
    mockOrderDetail({ getFacilityChanges });
    vi.mocked(api).mockResolvedValue({ data: [] });
    const store = useOrderDetailStore();
    await store.fetchOrderEvents(ORDER_ID);

    await store.retryOrderHistory(ORDER_ID);

    expect(getFacilityChanges).toHaveBeenCalledTimes(2);
    expect(store.orderHistoryStatus(ORDER_ID).failed).toBe(false);
  });
});

describe('getFacilityChanges', () => {
  it('reads the newest moves first, so a full page drops the oldest', async () => {
    const { useOrderDetail: realUseOrderDetail } = await vi.importActual<any>('@/composables/useOrderDetail');
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ data: [] });

    await realUseOrderDetail().getFacilityChanges(ORDER_ID);

    expect(vi.mocked(api).mock.calls[0][0]).toMatchObject({ params: { orderByField: '-changeDatetime', pageSize: FACILITY_CHANGE_PAGE_SIZE } });
  });
});

describe('getInventoryIssuance', () => {
  it('reads each line\'s inventory item from ProductFacility, then its issuance rows for the order', async () => {
    const { useOrderDetail: realUseOrderDetail } = await vi.importActual<any>('@/composables/useOrderDetail');
    vi.mocked(api).mockReset();
    vi.mocked(api).mockImplementation(async ({ url }: any) => {
      // The `in` filters cross both products with both facilities, so one row is not a line.
      if (url === 'oms/productFacilities') return { data: [
        { productId: 'P1', facilityId: 'F1', inventoryItemId: 'I1' },
        { productId: 'P1', facilityId: 'F2', inventoryItemId: 'I_NOT_A_LINE' },
        { productId: 'P2', facilityId: 'F2', inventoryItemId: 'I2' },
      ] };
      return { data: [{ inventoryItemId: url.split('/')[2], orderItemSeqId: '01', itemIssuanceId: 'X' }] };
    });

    const rows = await realUseOrderDetail().getInventoryIssuance(ORDER_ID, [
      { productId: 'P1', facilityId: 'F1' },
      { productId: 'P2', facilityId: 'F2' },
    ]);

    const urls = vi.mocked(api).mock.calls.map(([request]: any) => request.url);
    expect(urls).toEqual(['oms/productFacilities', 'oms/inventoryItem/I1/detail', 'oms/inventoryItem/I2/detail']);
    expect(vi.mocked(api).mock.calls[1][0]).toMatchObject({ params: { orderId: ORDER_ID, itemIssuanceId_op: 'empty', itemIssuanceId_not: 'Y' } });
    expect(rows.map((row: any) => row.inventoryItemId)).toEqual(['I1', 'I2']);
  });

  it('makes no call for an order with no issued lines', async () => {
    const { useOrderDetail: realUseOrderDetail } = await vi.importActual<any>('@/composables/useOrderDetail');
    vi.mocked(api).mockReset();

    expect(await realUseOrderDetail().getInventoryIssuance(ORDER_ID, [])).toEqual([]);
    expect(api).not.toHaveBeenCalled();
  });
});
