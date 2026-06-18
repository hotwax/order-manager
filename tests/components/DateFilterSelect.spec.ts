import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('date filter select', () => {
  it('uses Ionic item and popover datetime primitives for the shared date filter', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/DateFilterSelect.vue'), 'utf8');

    expect(source).toContain('<div class="date-filter-select">');
    expect(source).toContain('<ion-item :id="triggerId" button detail="false" lines="none">');
    expect(source).toContain("{{ selectedDateLabel }}");
    expect(source).toContain('<ion-popover :trigger="triggerId" trigger-action="click" :show-backdrop="false">');
    expect(source).toContain('<ion-datetime');
    expect(source).toContain('presentation="date"');
    expect(source).toContain(':show-default-buttons="true"');
    expect(source).toContain("emit('update:modelValue', normalizeDate($event.detail.value))");
    expect(source).toContain("translate('Select date')");
    expect(source).toContain('flex: 0 0 11rem;');
    expect(source).not.toContain('<ion-modal');
    expect(source).not.toContain('type="date"');
    expect(source).not.toContain('<h3>');
    expect(source).not.toContain('ion-grid');
    expect(source).not.toContain('ion-row');
    expect(source).not.toContain('ion-col');
  });
});
