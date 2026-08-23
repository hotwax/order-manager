import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

const itemsList = source.slice(
  source.indexOf('<ion-accordion-group>'),
  source.indexOf('</ion-accordion-group>')
);
const rolledUpStart = itemsList.indexOf('<ion-accordion v-else');
const soloRow = itemsList.slice(itemsList.indexOf('<OrderItemListRow'), rolledUpStart);
const rolledUp = itemsList.slice(rolledUpStart);

describe('order detail single item rows', () => {
  it('treats a group as rolled up only when more than one order item backs it', () => {
    expect(rolledUpStart).toBeGreaterThan(0);
    expect(source).toContain('soleItem: group.items.length === 1 ? group.items[0] : null');
    expect(itemsList).toContain('<template v-for="{ group, soleItem } in itemGroups" :key="group.externalId">');
  });

  it('renders a single item group as a plain row instead of an accordion', () => {
    expect(soloRow).toContain('v-if="soleItem"');
    expect(soloRow).not.toContain('<ion-accordion');
    expect(soloRow).not.toContain('slot="header"');
    expect(soloRow).not.toContain('slot="content"');
  });

  it('keeps the product identity the rolled up header would have carried', () => {
    expect(soloRow).toContain(':primary="groupPrimaryIdentifier(group)"');
    expect(soloRow).toContain(':secondary="groupSecondaryIdentifier(group)"');
    expect(soloRow).toContain(':image-url="getProduct(group.productId)?.mainImageUrl"');
    expect(soloRow).toContain(':preview-product="getProduct(group.productId)"');
    expect(soloRow).toContain(`:badge-label="isKit(group) ? translate('Kit') : ''"`);
    expect(soloRow).toContain(':quantity="soleItem.quantity"');
  });

  it('keeps the item information and actions that needed an expand to reach', () => {
    expect(soloRow).toContain(':facility-label="soleItem.facilityName"');
    expect(soloRow).toContain(':facility-disabled="isItemFacilityActionDisabled(soleItem)"');
    expect(soloRow).toContain(':attributes-label="attributeChipLabel(soleItem.attributeCount)"');
    expect(soloRow).toContain(':status-detail="itemStatusDetail(soleItem)"');
    expect(soloRow).toContain(':amount="money(itemLineTotal(soleItem), order.currency)"');
    expect(soloRow).toContain(':adjustments="getItemAdjustmentRows(soleItem)"');
    expect(soloRow).toContain('@facility-click="rejectAndReleaseItem(soleItem)"');
    expect(soloRow).toContain('@attributes-click="openItemAttributesModal(soleItem)"');
    expect(soloRow).toContain('@click.stop="cancelSingleItem(soleItem)"');
  });

  it('keeps the row selectable so bulk actions still reach the item', () => {
    expect(soloRow).toContain(':selected="soleItem.selected"');
    expect(soloRow).toContain('@update:selected="soleItem.selected = $event"');
  });

  it('leaves the rolled up accordion in place for multi item groups', () => {
    expect(rolledUp).toContain('slot="header"');
    expect(rolledUp).toContain('<div slot="content">');
    expect(rolledUp).toContain('v-for="item in group.items"');
    expect(rolledUp).toContain(':quantity="group.totalQty"');
  });
});
