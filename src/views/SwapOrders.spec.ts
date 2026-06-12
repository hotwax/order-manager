import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('swap workflow filters', () => {
  it('maps the swappable filter to the Figma select control', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    expect(source).toContain('<ion-select v-model="swappable"');
    expect(source).toContain("translate('All items')");
    expect(source).toContain("translate('Swappable')");
    expect(source).toContain(':value="false"');
    expect(source).toContain(':value="true"');
    expect(source).toContain("...(swappable.value && { swappable: 'Y' })");
    expect(source).not.toContain('<ion-toggle');
    expect(source).not.toContain('IonToggle');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
