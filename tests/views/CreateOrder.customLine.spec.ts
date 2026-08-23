import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

// The Create Order prototype is intentionally retained for future work from PR #464,
// even though it is not currently routed into the shipped application.
describe('dormant Create Order custom line validation', () => {
  it('marks custom lines and does not require SKU for them', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/CreateOrder.vue'), 'utf8');
    const customLineStart = source.indexOf('async function openCustomLineModal');
    const customLineSource = source.slice(customLineStart, source.indexOf('// Line Items management', customLineStart));
    const submitStart = source.indexOf('async function submitOrder');
    const submitSource = source.slice(submitStart, source.indexOf('// 5. Build API Payload', submitStart));

    expect(customLineSource).toContain('isCustomLine: true');
    expect(submitSource).toContain('!item.title || (!item.isCustomLine && !item.sku)');
  });
});
