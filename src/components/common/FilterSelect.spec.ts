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

  it('is used for non-date queue filters that match Figma Select / Resting controls', () => {
    const fraudOrders = readFileSync(resolve(process.cwd(), 'src/views/FraudOrders.vue'), 'utf8');
    const holdOrders = readFileSync(resolve(process.cwd(), 'src/views/HoldOrders.vue'), 'utf8');
    const badAddressOrders = readFileSync(resolve(process.cwd(), 'src/views/BadAddressOrders.vue'), 'utf8');
    const swapOrders = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    expect(fraudOrders.match(/<FilterSelect/g)?.length).toBe(4);
    expect(holdOrders.match(/<FilterSelect/g)?.length).toBe(2);
    expect(badAddressOrders.match(/<FilterSelect/g)?.length).toBe(2);
    expect(swapOrders.match(/<FilterSelect/g)?.length).toBe(1);
    expect(swapOrders).toContain('<FilterToggle v-model="swappable"');
    expect(`${fraudOrders}\n${holdOrders}\n${badAddressOrders}\n${swapOrders}`).not.toContain('IonSelect,');
  });
});
