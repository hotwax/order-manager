import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  inventoryTransferOpenQuantity,
  isInventoryTransferEligibleItem,
  requestInventoryTransfers,
} from '@/services/inventoryTransfers';

vi.mock('@common', () => ({ api: vi.fn() }));

const source = readFileSync(resolve(process.cwd(), 'src/components/inventory/RequestInventoryTransferModal.vue'), 'utf8');

describe('request inventory transfer modal', () => {
  beforeEach(() => vi.mocked(api).mockReset());

  it('keeps the ship-group destination read-only and excludes it from source selection', () => {
    expect(source).toContain("translate('Destination')");
    expect(source).toContain('{{ destinationFacilityName }}');
    expect(source).toContain('excludedFacilityIds: [props.destinationFacilityId]');
    expect(source).not.toContain('v-model="destinationFacilityId"');
  });

  it('validates physical, open product items and caps requested quantity at open quantity', () => {
    expect(isInventoryTransferEligibleItem({ productId: 'P1', statusId: 'ITEM_APPROVED', quantity: 3 }, false)).toBe(true);
    expect(isInventoryTransferEligibleItem({ productId: 'P1', statusId: 'ITEM_COMPLETED', quantity: 3 }, false)).toBe(false);
    expect(isInventoryTransferEligibleItem({ statusId: 'ITEM_APPROVED', quantity: 3 }, false)).toBe(false);
    expect(isInventoryTransferEligibleItem({ productId: 'P1', statusId: 'ITEM_APPROVED', quantity: 3 }, true)).toBe(false);
    expect(inventoryTransferOpenQuantity({ quantity: 4, cancelledQuantity: 1, fulfilledQuantity: 1 })).toBe(2);
    expect(source).toContain(':max="item.openQuantity"');
    expect(source).toContain('requestedQuantity > item.openQuantity');
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
});
