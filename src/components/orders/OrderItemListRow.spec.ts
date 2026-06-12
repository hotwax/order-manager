import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order item list row Figma variants', () => {
  it('renders facility and attributes chips as independent row cells', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/orders/OrderItemListRow.vue'), 'utf8');

    expect(source).toContain('v-if="showQuantityColumn"');
    expect(source).toContain('class="tablet order-item-facility"');
    expect(source).toContain('class="tablet order-item-attributes"');
    expect(source).toContain('const showQuantityColumn = computed(() => props.showQuantity && !props.facilityLabel && !props.attributesLabel)');
    expect(source).toContain("'--columns-desktop': String(columnCount)");
    expect(source).not.toContain('class="tablet order-item-details"');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('suppresses the quantity column on chip detail rows from the order detail page', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain(':show-quantity="!item.facilityName && !item.attributeCount"');
    expect(source).toContain("const facilityName = sg.facilityId ? (sg.facilityName || sg.facilityId) : '';");
    expect(source).toContain("if (!attributeCount) return '';");
  });

  it('matches the Figma order items toolbar actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain("{{ translate('Select all') }}");
    expect(source).toContain('<ion-button slot="end" fill="outline" color="medium" @click="openAddItemFromItemsSegment">');
    expect(source).toContain("{{ translate('Add items') }}");
  });
});
