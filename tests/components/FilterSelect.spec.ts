import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('filter select resting state', () => {
  it('keeps Ionic select behavior while showing Select for empty values', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/FilterSelect.vue'), 'utf8');

    expect(source).toContain('<ion-select');
    expect(source).toContain('label-placement="stacked"');
    expect(source).toContain('interface="popover"');
    expect(source).toContain(':selected-text="restingSelectedText"');
    expect(source).toContain("const restingSelectedText = computed(() => props.modelValue ? undefined : placeholderText.value);");
    expect(source).toContain("props.placeholder || translate('Select')");
  });

  it('uses shared outlined Ionic selects on every task queue', () => {
    const taskFilters = readFileSync(resolve(process.cwd(), 'src/components/tasks/OrderTaskFilterCard.vue'), 'utf8');
    const fraudOrders = readFileSync(resolve(process.cwd(), 'src/views/FraudOrders.vue'), 'utf8');
    const holdOrders = readFileSync(resolve(process.cwd(), 'src/views/HoldOrders.vue'), 'utf8');
    const badAddressOrders = readFileSync(resolve(process.cwd(), 'src/views/BadAddressOrders.vue'), 'utf8');
    const swapOrders = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    expect(taskFilters.match(/<ion-select(?:\s|>)/g)?.length).toBe(6);
    expect(taskFilters.match(/fill="outline"/g)?.length).toBe(6);
    expect(taskFilters.match(/<DateFilterSelect/g)?.length).toBe(4);
    expect(taskFilters.match(/ outlined/g)?.length).toBe(4);
    expect(fraudOrders).toContain('show-fraud-filters');
    expect(holdOrders).toContain('show-ship-group-filters');
    expect(badAddressOrders).toContain('show-ship-group-filters');
    expect(swapOrders).toContain('show-ship-group-filters');
    expect(`${taskFilters}\n${fraudOrders}\n${holdOrders}\n${badAddressOrders}\n${swapOrders}`).not.toContain('ion-grid');
  });
});
