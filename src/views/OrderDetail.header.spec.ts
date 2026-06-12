import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail header', () => {
  it('matches the Figma identity item status badge pattern', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('<ion-icon slot="start" :icon="ticketOutline" />');
    expect(source).toContain('<ion-badge v-if="order.status" slot="end" :color="commonUtil.getStatusColor(order.statusId)">');
    expect(source).toContain('{{ order.status }}');
    expect(source).not.toContain('<p class="overline">{{ order.status }}</p>');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('matches the Figma order identifications and source card labels', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source.indexOf("translate('Order Number')")).toBeLessThan(source.indexOf("translate('Order ID')"));
    expect(source.indexOf("translate('Order ID')")).toBeLessThan(source.indexOf("translate('Order Name')"));
    expect(source).toContain("{{ order.externalId || translate('Order Number') }}");
    expect(source).toContain("{{ order.orderName || translate('Order Name') }}");
    expect(source).toContain("translate('Brand')");
    expect(source).toContain("translate('Channel')");
    expect(source).not.toContain("translate('Order external ID')");
    expect(source).not.toContain("translate('Product store name')");
    expect(source).not.toContain("translate('Sales channel')");
  });
});
