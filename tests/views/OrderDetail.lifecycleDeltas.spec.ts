import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail ship-group lifecycle step deltas (#350)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('renders every lifecycle step through the shared delta helper, not per-step relative ages', () => {
    for (const step of ['brokered', 'pick', 'pack', 'ship']) {
      expect(source).toContain(`lifecycleStepLabel(lifecycleByShipGroup[shipGroup.id], '${step}')`);
    }
    // The old behaviour computed each step's own "months ago" independently.
    expect(source).not.toContain('commonUtil.getRelativeTime(lifecycleByShipGroup[shipGroup.id]?.picklistDate)');
    expect(source).not.toContain('commonUtil.getRelativeTime(lifecycleByShipGroup[shipGroup.id]?.packedDate)');
    expect(source).not.toContain('commonUtil.getRelativeTime(lifecycleByShipGroup[shipGroup.id]?.shippedDate)');
  });

  it('shows the first completed step as age-from-now and later steps as a delta from the previous completed step', () => {
    // First completed step (no earlier completed step) → relative age from now.
    expect(source).toContain('return commonUtil.getRelativeTime(value);');
    // Later steps → elapsed delta from the previous completed timestamp.
    expect(source).toContain('return findTimeDiff(previousValue, value);');
  });

  it('walks the lifecycle order backwards so a missing intermediate step falls back to the nearest prior completed step', () => {
    expect(source).toContain("const LIFECYCLE_STEP_ORDER: LifecycleStep[] = ['brokered', 'pick', 'pack', 'ship']");
    expect(source).toContain('for (let index = stepIndex - 1; index >= 0; index--)');
  });

  it('keeps the absolute clock time in the end note and Pending for incomplete steps', () => {
    // The step notes now go through lifecycleStepNote, which still formats the date when there
    // is one — it only changes what it says when there is not, and only for a settled group.
    expect(source).toContain("lifecycleStepNote(shipGroup, lifecycleByShipGroup[shipGroup.id]?.shippedDate)");
    expect(source).toContain("return formatTime(date)");
    expect(source).toContain("translate('Pending')");
  });
});
