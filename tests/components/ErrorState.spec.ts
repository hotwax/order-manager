import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('ErrorState', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/common/ErrorState.vue'), 'utf8');

  it('uses a high-contrast retry action on the danger card', () => {
    expect(source).toContain('<ion-card color="danger">');
    expect(source).toMatch(/<ion-button[\s\S]*color="light"[\s\S]*fill="clear"/);
  });
});
