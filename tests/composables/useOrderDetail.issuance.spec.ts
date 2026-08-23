import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('inventory issuance lookup', () => {
  const service = readFileSync(resolve(process.cwd(), 'src/composables/useOrderDetail.ts'), 'utf8');
  const store = readFileSync(resolve(process.cwd(), 'src/store/orderDetail.ts'), 'utf8');

  it('reads the detail rows per inventory item, not by orderId alone', () => {
    // `oms/inventoryItem/detail?orderId=…` makes Moqui read the literal `detail` as the
    // {inventoryItemId} path segment and answer 405 on every verb. Verified on rails-oms.
    expect(service).not.toContain('url: "oms/inventoryItem/detail"');
    expect(service).toContain('url: `oms/inventoryItem/${inventoryItemId}/detail`');
    expect(service).toContain('itemIssuanceId_op: "empty"');
    expect(service).toContain('itemIssuanceId_not: "Y"');
  });

  it('resolves the inventory item from the line product at the ship group facility', () => {
    expect(service).toContain('url: "oms/productFacilities"');
    expect(service).toContain('productId_op: "in"');
    expect(service).toContain('facilityId_op: "in"');
    // The batched response is the whole cross product, so unwanted pairs must be dropped.
    expect(service).toContain('wantedPairs.has(`${row.productId}|${row.facilityId}`)');
  });

  it('only looks up counter sales, the only rows that show an issuance badge', () => {
    expect(store).toContain('shipGroup?.shipmentMethodTypeId !== "POS_COMPLETED"');
    expect(store).toContain('issuanceLookupLines(this.byOrderId[orderId]?.payload)');
  });
});
