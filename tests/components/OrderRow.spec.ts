import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('OrderRow', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/orders/OrderRow.vue'), 'utf8');

  it('owns the five immediate list-item children in the standardized order', () => {
    const itemIndex = source.indexOf('<ion-item lines="none">');
    const allocationIndex = source.indexOf('<OrderAllocationSummary');
    const fulfillmentIndex = source.indexOf('{{ model.fulfillmentContext }}');
    const orderedIndex = source.indexOf('{{ model.orderedDateTime }}');
    const deadlineIndex = source.indexOf('{{ model.estimatedDeliveryDateTime }}');

    expect(source).toContain('class="list-item"');
    expect(itemIndex).toBeGreaterThan(0);
    expect(allocationIndex).toBeGreaterThan(itemIndex);
    expect(fulfillmentIndex).toBeGreaterThan(allocationIndex);
    expect(orderedIndex).toBeGreaterThan(fulfillmentIndex);
    expect(deadlineIndex).toBeGreaterThan(orderedIndex);
  });

  it('keeps the deadline column visible and preserves whole-row keyboard and selection behavior', () => {
    expect(source).toContain('props.model.orderName');
    expect(source).not.toContain('props.model.orderReference');
    expect(source).toContain('Ordered {{ model.orderedRelativeAge }}');
    expect(source).toContain('<ion-note>No estimated delivery date</ion-note>');
    expect(source).not.toContain('v-show="model.estimatedDeliveryDateTime"');
    expect(source).not.toContain(String.fromCharCode(183));
    expect(source).toContain("@keydown.enter.prevent=\"emit('activate')\"");
    expect(source).toContain("@keydown.space.prevent=\"emit('activate')\"");
    expect(source).toContain('@click.stop');
    expect(source).toContain("emit('selectionChange', $event.detail.checked)");
  });
});
