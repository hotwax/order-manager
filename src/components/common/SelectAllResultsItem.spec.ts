import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('SelectAllResultsItem', () => {
  it('maps the Figma select-all results item to Ionic components', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/SelectAllResultsItem.vue'), 'utf8');

    expect(source).toContain('<ion-item lines="none" class="select-all-item">');
    expect(source).toContain('<ion-checkbox');
    expect(source).toContain(':checked="modelValue"');
    expect(source).toContain("emit('update:modelValue', $event.detail.checked)");
    expect(source).toContain("{{ label || translate('Select all results') }}");
    expect(source).toContain('<ion-note slot="end">{{ count }}</ion-note>');
  });
});
