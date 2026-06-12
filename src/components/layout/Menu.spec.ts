import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order manager menu', () => {
  it('links the blocked unfillable queue to the unfillable route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(source).toContain('router-link="/unfillable"');
    expect(source).toContain('translate("Unfillable")');
    expect(source).not.toContain('router-link="/swap" router-direction="root"');
  });
});
