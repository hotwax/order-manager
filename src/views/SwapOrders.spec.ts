import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('swap queue filters', () => {
  it('uses Ionic select controls for the Figma filter row', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    expect(source).toContain('<ion-select v-model="swappable"');
    expect(source).toContain(':label="translate(\'Swappable\')"');
    expect(source).toContain('<ion-select-option value="Y">{{ translate(\'Swappable\') }}</ion-select-option>');
    expect(source).toContain("const swappable = ref('');");
    expect(source).toContain("swappable.value = '';");
    expect(source).toContain("...(swappable.value && { swappable: swappable.value })");
    expect(source).not.toContain('<ion-toggle v-model="swappable"');
    expect(source).not.toContain('IonToggle');
  });
});
