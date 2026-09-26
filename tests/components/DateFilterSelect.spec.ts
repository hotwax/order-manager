import { readFileSync } from 'fs';
import { resolve } from 'path';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';

vi.mock('@common', () => ({ translate: (value: string) => value }));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  return {
    IonIcon: component,
    IonInput: component,
    IonItem: component,
    IonLabel: component,
    IonPopover: { name: 'IonPopover', emits: ['willPresent'], template: '<div><slot /></div>' },
    // Renders the bounds the calendar would receive, so the test reads what the operator can pick.
    IonDatetime: { props: ['min', 'max'], template: '<div class="datetime" :data-min="min" :data-max="max" />' },
  };
});

describe('date filter select', () => {
  it('uses Ionic item and popover datetime primitives for the shared date filter', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/DateFilterSelect.vue'), 'utf8');

    expect(source).toContain('class="date-filter-select"');
    expect(source).toContain('<ion-input');
    expect(source).toContain('v-if="outlined"');
    expect(source).toContain('fill="outline"');
    expect(source).toContain('<ion-item v-else :id="triggerId" button detail="false" lines="none">');
    expect(source).toContain("{{ selectedDateLabel }}");
    expect(source).toContain('<ion-popover :trigger="triggerId" trigger-action="click" :show-backdrop="false"');
    expect(source).toContain('<ion-datetime');
    expect(source).toContain('presentation="date"');
    expect(source).toContain(':show-default-buttons="true"');
    expect(source).toContain("emit('update:modelValue', normalizeDate($event.detail.value))");
    expect(source).toContain("translate('Select date')");
    expect(source).toContain('flex: 0 0 11rem;');
    expect(source).not.toContain('<ion-modal');
    expect(source).not.toContain('type="date"');
    expect(source).not.toContain('<h3>');
    expect(source).not.toContain('ion-grid');
    expect(source).not.toContain('ion-row');
    expect(source).not.toContain('ion-col');
  });
});

describe('date filter select bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 12));
  });
  afterEach(() => vi.useRealTimers());

  const bounds = (props: Record<string, string> = {}) => {
    const datetime = mount(DateFilterSelect, { props: { modelValue: '', label: 'Order date', ...props } }).find('.datetime');
    return { min: datetime.attributes('data-min'), max: datetime.attributes('data-max') };
  };

  it('never offers a date after today', () => {
    expect(bounds().max).toBe('2026-09-25');
    expect(bounds({ max: '2026-10-02' }).max).toBe('2026-09-25');
  });

  it('keeps an earlier upper bound, such as the paired through date', () => {
    expect(bounds({ max: '2026-09-20' }).max).toBe('2026-09-20');
  });

  it('moves the limit on when the calendar is opened on a later day', async () => {
    const wrapper = mount(DateFilterSelect, { props: { modelValue: '', label: 'Order date' } });
    vi.setSystemTime(new Date(2026, 8, 26, 9));

    await wrapper.findComponent({ name: 'IonPopover' }).vm.$emit('willPresent');

    expect(wrapper.find('.datetime').attributes('data-max')).toBe('2026-09-26');
  });

  it('passes a lower bound through and leaves it open when there is none', () => {
    expect(bounds({ min: '2026-09-09' }).min).toBe('2026-09-09');
    expect(bounds().min).toBeUndefined();
  });
});
