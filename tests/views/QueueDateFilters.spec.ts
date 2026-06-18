import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('queue date filters', () => {
  it('maps Hold, Bad Address, and Swap date filters to the shared select-style date component', () => {
    const holdOrders = readFileSync(resolve(process.cwd(), 'src/views/HoldOrders.vue'), 'utf8');
    const badAddressOrders = readFileSync(resolve(process.cwd(), 'src/views/BadAddressOrders.vue'), 'utf8');
    const swapOrders = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    expect(holdOrders).toContain('<DateFilterSelect v-model="dateAfter" :label="translate(\'Order date after\')" />');
    expect(holdOrders).toContain('<DateFilterSelect v-model="dateBefore" :label="translate(\'Order date before\')" />');
    expect(badAddressOrders).toContain('<DateFilterSelect v-model="dateAfter" :label="translate(\'Date after\')" />');
    expect(badAddressOrders).toContain('<DateFilterSelect v-model="dateBefore" :label="translate(\'Date before\')" />');
    expect(swapOrders).toContain('<DateFilterSelect v-model="dateAfter" :label="translate(\'Date after\')" />');
    expect(swapOrders).toContain('<DateFilterSelect v-model="dateBefore" :label="translate(\'Date before\')" />');

    for (const source of [holdOrders, badAddressOrders, swapOrders]) {
      expect(source).toContain("...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() })");
      expect(source).toContain("...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() })");
      expect(source).not.toContain('label-placement="stacked" type="date"');
      expect(source).not.toContain('IonInput');
    }
  });
});
