import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  fetchFacilitySalesVelocity,
  fetchFacilityStock,
  fetchOrderInventoryTransfers,
  inventoryTransferOpenQuantity,
  isInventoryTransferEligibleItem,
  requestInventoryTransfers,
} from '@/services/inventoryTransfers';

const mocks = vi.hoisted(() => ({ runSolrQuery: vi.fn() }));

vi.mock('@common', () => ({ api: vi.fn(), useSolrSearch: () => ({ runSolrQuery: mocks.runSolrQuery }) }));

describe('inventory transfers service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    mocks.runSolrQuery.mockReset();
  });

  it('only transfers open product items at a physical facility, up to what is still open', () => {
    expect(isInventoryTransferEligibleItem({ productId: 'P1', statusId: 'ITEM_APPROVED', quantity: 3 }, false)).toBe(true);
    expect(isInventoryTransferEligibleItem({ productId: 'P1', statusId: 'ITEM_COMPLETED', quantity: 3 }, false)).toBe(false);
    expect(isInventoryTransferEligibleItem({ statusId: 'ITEM_APPROVED', quantity: 3 }, false)).toBe(false);
    expect(isInventoryTransferEligibleItem({ productId: 'P1', statusId: 'ITEM_APPROVED', quantity: 3 }, true)).toBe(false);
    expect(inventoryTransferOpenQuantity({ quantity: 4, cancelledQuantity: 1, fulfilledQuantity: 1 })).toBe(2);
  });

  it('creates one requested InventoryTransfer per item with a shared reference prefix', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ data: { inventoryTransferId: '1001' } })
      .mockResolvedValueOnce({ data: { inventoryTransferId: '1002' } });

    await expect(requestInventoryTransfers({
      transfers: [{
        productId: 'P1', quantity: 2, facilityId: 'SOURCE', facilityIdTo: 'DEST',
        orderId: 'ORDER_1', orderItemSeqId: '01', comments: 'urgent',
      }, {
        productId: 'P2', quantity: 1, facilityId: 'SOURCE', facilityIdTo: 'DEST',
        orderId: 'ORDER_1', orderItemSeqId: '02',
      }],
      requestReferencePrefix: 'OM-REQUEST',
    })).resolves.toEqual(['1001', '1002']);

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/inventoryTransfers', method: 'POST', data: expect.objectContaining({
        statusId: 'IXF_REQUESTED', sourceId: 'ORDER_MANAGER', sourceReferenceId: 'OM-REQUEST-01',
        facilityId: 'SOURCE', facilityIdTo: 'DEST', orderId: 'ORDER_1', orderItemSeqId: '01',
      }),
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/inventoryTransfers', method: 'POST', data: expect.objectContaining({
        sourceReferenceId: 'OM-REQUEST-02', orderItemSeqId: '02',
      }),
    });
  });

  it('loads every page of an order\'s transfers, not just the first', async () => {
    const page = (size: number, from: number) => Array.from({ length: size }, (_, index) => ({ inventoryTransferId: String(from + index), orderId: 'O1' }));
    vi.mocked(api)
      .mockResolvedValueOnce({ data: page(250, 0) } as any)
      .mockResolvedValueOnce({ data: page(3, 250) } as any);

    await expect(fetchOrderInventoryTransfers('O1')).resolves.toHaveLength(253);
    expect(api).toHaveBeenCalledTimes(2);
    expect(api).toHaveBeenLastCalledWith({
      url: 'oms/inventoryTransfers', method: 'GET',
      params: { orderId: 'O1', orderByField: '-createdStamp', pageIndex: 1, pageSize: 250 },
    });
  });

  it('keeps only the order\'s own transfers, in case the orderId filter is ever ignored', async () => {
    // Moqui returns every row when it doesn't know a filter field.
    vi.mocked(api).mockResolvedValue({ data: [
      { inventoryTransferId: '1', orderId: 'O1', orderItemSeqId: '01' },
      { inventoryTransferId: '2', orderId: 'OTHER', orderItemSeqId: '01' },
    ] } as any);

    await expect(fetchOrderInventoryTransfers('O1')).resolves.toEqual([{ inventoryTransferId: '1', orderId: 'O1', orderItemSeqId: '01' }]);
  });

  it('sums stock per facility across its inventory items, with zero where there is none', async () => {
    vi.mocked(api).mockResolvedValue({ data: [
      { facilityId: 'A', availableToPromiseTotal: 3, quantityOnHandTotal: 4 },
      { facilityId: 'A', availableToPromiseTotal: '2', quantityOnHandTotal: '2' },
      { facilityId: 'OTHER', availableToPromiseTotal: 9, quantityOnHandTotal: 9 },
    ] } as any);

    await expect(fetchFacilityStock('P1', ['A', 'B'])).resolves.toEqual({ A: { atp: 5, qoh: 6 }, B: { atp: 0, qoh: 0 } });
    expect(api).toHaveBeenCalledWith({
      url: 'oms/inventoryLogs', method: 'GET',
      params: expect.objectContaining({ productId: 'P1', facilityId: 'A,B', facilityId_op: 'in' }),
    });
  });

  it('counts each facility\'s completed order items for the product over the last 30 days, per day', async () => {
    mocks.runSolrQuery.mockResolvedValue({ data: { facets: { facilities: { buckets: [{ val: 'WH', count: 9 }, { val: 'STORE', count: 3 }] } } } });

    await expect(fetchFacilitySalesVelocity('P1')).resolves.toEqual({ WH: 0.3, STORE: 0.1 });
    const { json } = mocks.runSolrQuery.mock.calls[0][0];
    expect(json.filter).toEqual(expect.arrayContaining([
      'docType: ORDER', 'productId: "P1"', 'orderItemStatusId: ITEM_COMPLETED', 'orderDate:[NOW-30DAYS TO NOW]',
    ]));
    expect(json.facet.facilities).toMatchObject({ type: 'terms', field: 'facilityId' });
  });
});
