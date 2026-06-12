import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('suggested product action popover', () => {
  it('uses the suggested product identifier as the popover header', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/SuggestedProductActionPopover.vue'), 'utf8');

    expect(source).toContain('<ion-list-header>');
    expect(source).toContain('{{ productIdentifier }}');
    expect(source).toContain('commonUtil.getProductIdentificationValue');
    expect(source).not.toContain('shipmentMethod');
  });

  it('renders the Figma action list without item detail affordances', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/SuggestedProductActionPopover.vue'), 'utf8');

    expect(source).toContain('ion-item button detail="false" @click="cancelItem()"');
    expect(source).toContain('ion-item button detail="false" @click="customerSwap()"');
    expect(source).toContain('ion-item button detail="false" @click="viewInventory()"');
  });
});
