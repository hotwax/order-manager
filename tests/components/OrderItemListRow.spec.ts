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
    expect(rowSource).toContain('<ion-label class="tablet order-item-quantity">');
    expect(rowSource).toContain('<div class="tablet order-item-details">');
    expect(rowSource).not.toContain('<div class="order-item-list-key">');
    expect(rowSource).not.toContain('<div v-if="facilityLabel || attributesLabel" class="tablet order-item-details">');
  });

  it('selects from a tap anywhere on the row, not just the checkbox', () => {
    expect(rowSource).toContain(':button="rowSelects"');
    expect(rowSource).toContain(':detail="false"');
    expect(rowSource).toContain(`@click="rowSelects && emit('update:selected', !selected)"`);
    expect(rowSource).toContain('const rowSelects = computed(() => props.selectable && props.selectOnRowClick);');
    // The image preview and the checkbox own their own taps.
    expect(rowSource).toContain(`:aria-label="translate('Select item')"`);
    // An accordion header row already toggles its group, so it opts out.
    expect(detailSource).toContain(':select-on-row-click="false"');
  });

  it('hides visible quantity on single-unit item detail rows without removing the column', () => {
    expect(rowSource).toContain('<template v-if="showQuantity">');
    expect(detailSource).toContain(':show-quantity="false"');
    expect(detailSource).not.toContain('class="order-item-rollup-entry"');
  });
});
