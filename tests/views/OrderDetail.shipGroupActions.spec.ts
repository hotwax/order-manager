import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail ship group actions', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
  const validator = readFileSync(resolve(process.cwd(), 'src/utils/OrderActionValidator.ts'), 'utf8');
  const actions = source.slice(
    source.indexOf('<div class="ship-group-actions">'),
    source.indexOf('<!-- Gift message modal -->')
  );

  it('reads in the order a ship group travels: broker, release, then park', () => {
    const at = (label: string) => actions.indexOf(`translate('${label}')`);

    expect(at('Broker')).toBeGreaterThan(-1);
    expect(at('Broker')).toBeLessThan(at('Release'));
    expect(at('Release')).toBeLessThan(at('Park'));
    expect(at('Park')).toBeLessThan(at('Add Task'));
    expect(at('Add Task')).toBeLessThan(at('Add Items'));
  });

  it('keeps each action wired to the handler and guard it had before the reorder', () => {
    expect(actions).toContain(`:disabled="isShipGroupActionDisabled(shipGroup, 'BROKER')" @click="brokerShipGroup(shipGroup.id)"`);
    expect(actions).toContain(`:disabled="isShipGroupActionDisabled(shipGroup, 'RELEASE')" @click="releaseSelectedItems(shipGroup)"`);
    expect(actions).toContain(`isVirtualFacility(shipGroup) ? 'PARK_ITEMS' : 'PULL_BACK'`);
    expect(actions).toContain(`isVirtualFacility(shipGroup) ? parkSelectedItems(shipGroup) : rejectSelectedItems(shipGroup)`);
  });

  it('still shows Pull back, not Park, on a physical facility', () => {
    expect(actions).toContain(`isVirtualFacility(shipGroup) ? translate('Park') : translate('Pull back')`);
  });

  it('drops the long labels everywhere, so the validator cannot drift from the buttons', () => {
    expect(source).not.toContain('Broker ship group');
    expect(source).not.toContain('Park Items');
    expect(validator).toContain("id: 'BROKER', label: 'Broker'");
    expect(validator).toContain("id: 'PARK_ITEMS', label: 'Park'");
  });

  it('names the ship group the status detail refers to', () => {
    // A bare "#00002" under a status badge says nothing about what the number is.
    expect(source).toContain("`${translate('Shipgroup')} ${translate('#')}${item.shipGroupSeqId}`");
  });

  it('lets the validator govern Add Task like every other ship group action', () => {
    expect(actions).toContain(`:disabled="isShipGroupActionDisabled(shipGroup, 'ADD_TASK')"`);
    expect(validator).toContain("reason: 'Every item in this ship group is already completed.'");
    expect(validator).toContain('groupItems.every((item: any) => this.isItemFulfilled(item))');
  });

  it('shows selectable features under the product identity in both ship group item lists', () => {
    const featureLines = source.match(/<p v-if="productFeatureLabel\(item\.productId\)" class="ship-group-item-features"/g) || [];
    expect(featureLines).toHaveLength(2);
    expect(source).toContain('.ship-group-item-features {');
  });

  it('routes ship group item identity through the shared composable, not a raw productId', () => {
    // The preference itself is real (verified against rails-oms: primaryId "internalName",
    // secondaryId "parentProductName") — these rows just never consulted it, and fell through
    // straight to item.productId, an internal id, whenever the product cache had not warmed yet.
    const template = source.slice(0, source.indexOf('</template>'));
    expect(template).not.toContain('item.productId }}');
    expect(template).not.toContain('|| item.productId');
    expect(source).toContain('function shipGroupItemPrimary(item: any): string {');
    expect(source).toContain('productMaster.primaryId(getProduct(item.productId), [item.name, item.sku, item.productId]);');
    // Both lists go through the shared chain rather than calling the raw resolver.
    const primaries = source.match(/shipGroupItemPrimary\(item\)/g) || [];
    expect(primaries.length).toBeGreaterThanOrEqual(2);
  });
});
