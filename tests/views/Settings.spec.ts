import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('settings layout', () => {
  it('uses the shared Job Manager-style settings sections and cards', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Settings.vue'), 'utf8');

    expect(source).toContain('class="user-profile"');
    expect(source).toContain('class="section-header"');
    expect(source).toContain('<section>');
    expect(source).toContain('<ion-card>');
    expect(source).toContain("{{ translate('OMS') }}");
    expect(source).toContain("{{ translate('App') }}");
  });
});
