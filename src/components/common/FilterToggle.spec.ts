import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('filter toggle', () => {
  it('maps the Figma Switch filter control to Ionic item and toggle components', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/FilterToggle.vue'), 'utf8');

    expect(source).toContain('<ion-item lines="full">');
    expect(source).toContain('<ion-toggle');
    expect(source).toContain(':checked="modelValue"');
    expect(source).toContain('justify="space-between"');
    expect(source).toContain("emit('update:modelValue', $event.detail.checked)");
    expect(source).not.toContain('ion-grid');
    expect(source).not.toContain('ion-row');
    expect(source).not.toContain('ion-col');
  });
});
