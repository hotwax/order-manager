import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('swap queue filters', () => {
  it('uses an Ionic toggle for the Figma swappable filter', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    expect(source).toContain('<FilterToggle v-model="swappable" :label="translate(\'Swappable\')" />');
    expect(source).toContain("import FilterToggle from '@/components/common/FilterToggle.vue';");
    expect(source).toContain('const swappable = ref(false);');
    expect(source).toContain('swappable.value = false;');
    expect(source).toContain("...(swappable.value && { swappable: 'Y' })");
    expect(source).not.toContain('<FilterSelect v-model="swappable"');
    expect(source).not.toContain('<ion-select v-model="swappable"');
  });
});
