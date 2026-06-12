import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('date filter select', () => {
  it('uses Ionic item and modal primitives for the Figma select-style date filter', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/DateFilterSelect.vue'), 'utf8');

    expect(source).toContain('<ion-item button detail="false" lines="full"');
    expect(source).toContain("{{ selectedDateLabel }}");
    expect(source).toContain('caretDownOutline');
    expect(source).toContain('<ion-modal :is-open="isOpen"');
    expect(source).toContain('<ion-datetime');
    expect(source).toContain('presentation="date"');
    expect(source).toContain('<ion-buttons slot="start">');
    expect(source).toContain('slot="icon-only" :icon="closeOutline"');
    expect(source).toContain('<ion-fab vertical="bottom" horizontal="end" slot="fixed">');
    expect(source).toContain(':icon="saveOutline"');
    expect(source).toContain("emit('update:modelValue', normalizeDate(draftDate.value))");
    expect(source).toContain("emit('update:modelValue', '')");
    expect(source).not.toContain('type="date"');
    expect(source).not.toContain('ion-grid');
    expect(source).not.toContain('ion-row');
    expect(source).not.toContain('ion-col');
  });
});
