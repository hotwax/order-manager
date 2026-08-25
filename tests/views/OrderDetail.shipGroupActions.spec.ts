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

  it('shows selectable features under the product identity in the ship group item list', () => {
    expect(source).toContain('<p v-if="productFeatureLabel(item.productId)" class="ship-group-item-features"');
    expect(source).toContain('.ship-group-item-features {');
  });
});
