import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('UnfillableOrders', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/UnfillableOrders.vue'), 'utf8');

  it('enables the selected-order brokering action for the unfillable queue', () => {
    expect(source).toContain(':facility-ids="[\'UNFILLABLE_PARKING\']"');
    expect(source).toContain(':global-actions="[\'brokerSelected\']"');
  });
});
