import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order manager menu labels', () => {
  it('uses the Figma Unfillable label for the swap route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(source).toContain('router-link="/swap"');
    expect(source).toContain('translate("Unfillable")');
    expect(source).not.toContain('translate("Swap")');
  });
});
