import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('AttributeListItem', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/orders/AttributeListItem.vue'), 'utf8');

  it('maps the name and value into a horizontal key/value pair', () => {
    // Name at the start, value trailing on the same row, both inside one
    // native definition list so they stack on narrow widths.
    expect(source).toContain('<dl class="attribute-kv__terms">');
    expect(source).toContain('<dt>{{ name }}</dt>');
    expect(source).toContain('class="attribute-kv__value"');
    expect(source).toContain('hasValue ? value : translate(\'Value not available\')');
  });

  it('uses native HTML and flexbox rather than an ion-item layout', () => {
    expect(source).toContain('display: flex;');
    expect(source).toContain('flex-wrap: wrap;');
    expect(source).toContain('justify-content: space-between;');
    expect(source).not.toContain('<ion-item');
    expect(source).not.toContain('<ion-label');
    expect(source).not.toContain('IonItem');
    expect(source).not.toContain('IonLabel');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('renders a clear empty state instead of dropping blank values', () => {
    expect(source).toContain('translate(\'Value not available\')');
    // hasValue treats whitespace-only / null / undefined as empty.
    expect(source).toContain("String(value).trim() !== ''");
  });

  it('exposes a trailing slot for row actions (e.g. delete)', () => {
    expect(source).toContain('<slot name="end" />');
  });

  it('keeps the description as secondary supporting text', () => {
    expect(source).toContain('v-if="description"');
    expect(source).toContain('class="attribute-kv__description"');
  });

  it('keeps new CSS limited to layout properties', () => {
    expect(source).not.toContain('font-weight');
    expect(source).not.toContain('font-style');
    expect(source).not.toContain('color:');
  });
});
