import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

describe('order detail inventory transfer requests', () => {
  it('offers an item request only for eligible items at physical ship groups', () => {
    expect(source).toContain('isInventoryTransferRequestEligible(soleItem)');
    expect(source).toContain('isInventoryTransferRequestEligible(item)');
    expect(source).toContain('@click.stop="requestInventoryTransferForItem(soleItem)"');
    expect(source).toContain('@click.stop="requestInventoryTransferForItem(item)"');
    expect(source).toContain('isInventoryTransferEligibleItem(inventoryTransferItem(item), isVirtualFacilityForItem(item))');
  });

  it('uses selected eligible ship-group items or all eligible items when none are selected', () => {
    expect(source).toContain('function inventoryTransferItemsForShipGroup(shipGroup: any)');
    expect(source).toContain('actionableItemObjectsForShipGroup(shipGroup)');
    expect(source).toContain('.filter((item: any) => isInventoryTransferRequestEligible(item))');
    expect(source).toContain('@click="requestInventoryTransfersForShipGroup(shipGroup)"');
    expect(source).toContain(':disabled="!inventoryTransferItemsForShipGroup(shipGroup).length"');
  });

  it('passes destination from the current physical ship group into the modal', () => {
    expect(source).toContain('component: RequestInventoryTransferModal');
    expect(source).toContain('destinationFacilityId: shipGroup.facilityId');
    expect(source).toContain('orderItemSeqId: item.orderItemSeqId');
    expect(source).toContain('productId: group?.productId');
  });
});
