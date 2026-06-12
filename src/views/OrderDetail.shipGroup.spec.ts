import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail ship group card', () => {
  it('uses measured collapsible sections without grid-row height animation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('const vCollapsible = {');
    expect(source).toContain('v-collapsible class="ship-group-expanded-options"');
    expect(source).toContain('v-collapsible class="ship-group-summary-container"');
    expect(source).toContain('v-collapsible class="ship-group-card-details"');
    expect(source).toContain('--ship-group-collapsible-height');
    expect(source).toContain('box-sizing: content-box;');
    expect(source).toContain('transition: max-height 180ms ease, opacity 160ms ease, padding-block 180ms ease;');
    expect(source).toContain('padding-block: 0;');
    expect(source).toContain('padding-block: var(--spacer-base);');
    expect(source).not.toContain('transition: grid-template-rows');
    expect(source).not.toContain('grid-template-rows: 0fr');
    expect(source).not.toContain('grid-template-rows: 1fr');
    expect(source).not.toContain('class="ship-group-options ion-padding-horizontal ion-padding-vertical"');
    expect(source).not.toContain('class="ship-group-selected-options ion-padding-horizontal ion-padding-top"');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
