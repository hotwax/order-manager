import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order item attributes modal', () => {
  it('uses AccxUI modal action placement for adding attributes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/orders/OrderItemAttributesModal.vue'), 'utf8');

    expect(source).toContain('<ion-buttons slot="start">');
    expect(source).toContain('<ion-icon slot="icon-only" :icon="closeOutline" />');
    expect(source).toContain('<ion-fab vertical="bottom" horizontal="end" slot="fixed">');
    expect(source).toContain('<ion-fab-button :disabled="!form.attrName.trim() || saving"');
    expect(source).toContain(':aria-label="translate(\'Add Attribute\')"');
    expect(source).toContain(':icon="addOutline"');
    expect(source).toContain('slot="icon-only" :icon="trashOutline"');
    expect(source).not.toContain('{{ translate(\'Add\') }}');
    expect(source).not.toContain('expand="block" :disabled="!form.attrName.trim() || saving"');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
