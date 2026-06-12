import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('bad address task card Figma address comparison', () => {
  it('maps original and suggested addresses to Ionic list item rows', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/BadAddressTaskCard.vue'), 'utf8');

    expect(source).toContain('addressOptions');
    expect(source).toContain('addressRows(addressOption.type)');
    expect(source).toContain("translate('Original address')");
    expect(source).toContain("translate('Suggested address')");
    expect(source).toContain("translate('keep original')");
    expect(source).toContain("translate('use suggested')");
    expect(source).toContain('<p class="overline">{{ row.label }}</p>');
    expect(source).toContain('detail="false"');
    expect(source).toContain('editAddressField(addressOption.type, row.field)');
    expect(source).toContain('isEditingAddressField(addressOption.type, row.field)');
    expect(source).toContain('setAddressField(addressOption.type, row.field');
    expect(source).not.toContain('v-model="editableAddresses.original.address1"');
    expect(source).not.toContain('v-model="editableAddresses.suggested.address1"');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
