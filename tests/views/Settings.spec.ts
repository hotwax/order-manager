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
    expect(source).toContain('<DxpAppVersionInfo');
  });

  it('names every refresh control for its exact data target', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Settings.vue'), 'utf8');
    const en = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/en-US.json'), 'utf8'));
    const es = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/es-ES.json'), 'utf8'));

    expect(source).toContain(":aria-label=\"translate('Refresh all data')\"");
    expect(source).toContain(":aria-label=\"translate('Refresh {label}', { label: item.label })\"");
    expect(source).toContain(":aria-label=\"translate('Refresh {label}', { label: translate(domain.label) })\"");
    expect(en['Refresh {label}']).toBe('Refresh {label}');
    expect(es['Refresh {label}']).toBe('Actualizar {label}');
    expect(es['Refresh all data']).toBe('Actualizar todos los datos');
  });
});
