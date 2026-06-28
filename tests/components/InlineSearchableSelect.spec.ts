import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('inline searchable select', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/common/InlineSearchableSelect.vue'), 'utf8');

  it('uses an anchored Ionic popover with live option filtering', () => {
    expect(source).toContain('<ion-popover');
    expect(source).toContain('size="cover"');
    expect(source).toContain(':show-backdrop="false"');
    expect(source).toContain('<ion-searchbar');
    expect(source).toContain('option.label.toLowerCase().includes(term)');
    expect(source).toContain("option.description?.toLowerCase().includes(term)");
    expect(source).toContain("emit('update:modelValue', option.value)");
  });

  it('supports disabled and empty states without custom color styling', () => {
    expect(source).toContain(':disabled="disabled"');
    expect(source).toContain("props.disabled && props.disabledText");
    expect(source).toContain("emptyText || translate('No results found')");
    expect(source).not.toContain('inline-searchable-select-placeholder');
    expect(source).not.toContain('color:');
  });
});

describe('bad address country picker wiring', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/BadAddressTaskCard.vue'), 'utf8');

  it('uses searchable selects for countries while keeping the modal state picker', () => {
    expect(source.match(/<InlineSearchableSelect/g)?.length).toBe(2);
    expect(source).toContain('import InlineSearchableSelect');
    expect(source).toContain('import GeoSelectModal');
    expect(source).toContain('@update:model-value="onCountrySelect(addressState.original, $event)"');
    expect(source).toContain('@update:model-value="onCountrySelect(addressState.suggested, $event)"');
    expect(source).toContain('openStatePicker(addressState.original)');
    expect(source).toContain('openStatePicker(addressState.suggested)');
  });

  it('clears dependent state and loads regions after country changes', () => {
    expect(source).toContain('address.countryGeoId = countryGeoId;');
    expect(source).toContain("address.stateProvinceGeoId = '';");
    expect(source).toContain('seedStore.loadGeoAssocs(countryGeoId)');
  });
});
