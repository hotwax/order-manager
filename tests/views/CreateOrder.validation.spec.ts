import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Create Order line item quantity validation', () => {
  it('includes inline validation and error-text on lineItem quantity input', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/CreateOrder.vue'), 'utf8');

    expect(source).toContain(":class=\"{ 'ion-invalid ion-touched': !lineItem.quantity || lineItem.quantity <= 0 }\"");
    expect(source).toContain(":error-text=\"translate('Quantity must be greater than 0')\"");
  });

  it('provides translations for the quantity validation message in en-US and es-ES', () => {
    const enLocale = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/en-US.json'), 'utf8'));
    const esLocale = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/es-ES.json'), 'utf8'));

    expect(enLocale['Quantity must be greater than 0']).toBe('Quantity must be greater than 0');
    expect(esLocale['Quantity must be greater than 0']).toBe('La cantidad debe ser mayor que 0');
  });
});
