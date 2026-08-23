import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('OrderItemListRow', () => {
  const rowSource = readFileSync(resolve(process.cwd(), 'src/components/orders/OrderItemListRow.vue'), 'utf8');
  const detailSource = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('keeps a stable five-slot row structure even when details are empty', () => {
    expect(rowSource).toContain('class="order-item-list-key"');
    expect(rowSource).toContain('@click.stop');
    expect(rowSource).toContain('@keydown.stop');
    expect(rowSource).toContain('<div class="tablet order-item-details">');
    expect(rowSource).not.toContain('<div class="order-item-list-key">');
    expect(rowSource).not.toContain('<div v-if="facilityLabel || attributesLabel" class="tablet order-item-details">');
  });

  it('selects only from the checkbox, never from a tap on the row', () => {
    expect(rowSource).toContain(':detail="false"');
    expect(rowSource).toContain(`:aria-label="translate('Select item')"`);
    expect(rowSource).toContain(`@ionChange="emit('update:selected', $event.detail.checked)"`);
    // No row-level control, handler, or opt-out remains.
    expect(rowSource).not.toContain(':button=');
    expect(rowSource).not.toContain('@click="');
    expect(rowSource).not.toContain('rowSelects');
    expect(rowSource).not.toContain('selectOnRowClick');
    expect(detailSource).not.toContain(':select-on-row-click=');
  });

  it('offers a hover highlight only on a row a click actually expands', () => {
    expect(rowSource).toContain(".order-item-list-row:not(.order-item-expands):hover {");
    expect(rowSource).toContain('--list-item-bg-hover: transparent;');
    expect(rowSource).toContain('cursor: default;');
    expect(rowSource).toContain("{ 'order-item-expands': expands }");
    // Only the accordion header expands; sole-item and child rows do not.
    const headers = detailSource.match(/:expands="true"/g) || [];
    expect(headers).toHaveLength(1);
  });

  it('does not let the item ripple as if it were the checkbox', () => {
    // Ionic makes an item that wraps a control activatable, so it rippled on every row tap
    // even though the tap selects nothing.
    expect(rowSource).toContain('--ripple-color: transparent;');
    expect(rowSource).toContain('--background-activated: transparent;');
    expect(rowSource).toContain('.order-item-list-key::part(native) {');
  });

  it('stops the checkbox tap so an accordion header row does not toggle its group', () => {
    const checkbox = rowSource.slice(rowSource.indexOf('<ion-checkbox'), rowSource.indexOf('<ion-thumbnail'));
    expect(checkbox).toContain('@click.stop');
    expect(checkbox).toContain('@keydown.stop');
  });

  it('gives product identity two of the flexible tracks, above mobile', () => {
    // Mobile shows only the identity and action columns and has no track to spare.
    expect(rowSource).toContain('@media (min-width: 700px) {');
    expect(rowSource).toContain('grid-column: span 2;');
    expect(rowSource).toContain('--columns-desktop: 6;');
    expect(rowSource).toContain('--columns-tablet: 5;');
    // Detail rows carry the same five children, so they must not override the track count —
    // 4 tracks wrapped their action column and misaligned them under their own group header.
    expect(rowSource).not.toContain('order-item-detail-entry {');
  });

  it('renders the action column slot the item rows pass a Cancel button into', () => {
    // 447a92c rewrote the amount column and dropped the slot with it, leaving both
    // `<template #actions>` blocks in OrderDetail.vue rendering nothing.
    expect(rowSource).toContain('<slot name="actions" />');
    expect(rowSource).not.toContain('<div></div>');
    expect(detailSource).toContain('<template #actions>');
  });

  it('keeps per-item cancel behind the same flag as every other cancel entry point', () => {
    // 0f0806f hid every cancel entry point because cancel does not reach Shopify yet. The
    // per-item button was exempt only because the missing slot kept it off screen, so
    // restoring the slot has to bring the flag with it.
    const cancels = detailSource.match(/<ion-button[^>]*ITEM_CANCELLED[^>]*>/gs) || [];
    expect(cancels).toHaveLength(2);
    cancels.forEach((button) => {
      expect(button).toContain('!HIDE_SHOPIFY_UNSYNCED_ACTIONS');
    });
    expect(detailSource).toContain("import { HIDE_SHOPIFY_UNSYNCED_ACTIONS } from '@/config/featureFlags';");
  });

  it('shows a product variant its selectable features under the primary identity', () => {
    expect(rowSource).toContain('<p v-if="features" class="order-item-features" :title="features">{{ features }}</p>');
    // A gift-card variant can carry every denomination, so the line must not grow the row.
    expect(rowSource).toContain('text-overflow: ellipsis;');
    // Above the secondary line, so the features read as part of the identity block.
    expect(rowSource.indexOf('v-if="features"')).toBeLessThan(rowSource.indexOf('v-if="secondary"'));
    expect(detailSource).toContain(':features="productFeatureLabel(group.productId)"');
    expect(detailSource).toContain('return commonUtil.getFeatures(getProduct(productId)?.productFeatures);');
  });

  it('carries no quantity column, so the grid is one track narrower', () => {
    // Every row but the rolled up header read "1 qty"; the status badges now carry the units
    // per status on a rollup, so the column was spending a whole track on nothing.
    expect(rowSource).not.toContain('order-item-quantity');
    expect(rowSource).not.toContain('showQuantity');
    expect(detailSource).not.toContain(':quantity=');
    expect(detailSource).not.toContain('translate(\'qty\')');
    expect(detailSource).not.toContain('class="order-item-rollup-entry"');
  });
});
