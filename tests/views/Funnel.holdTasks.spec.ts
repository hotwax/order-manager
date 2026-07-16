import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Funnel canonical hold totals', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/Funnel.vue'), 'utf8');

  it('makes the total-only manual and customer hold population visible', () => {
    expect(source).toContain('router-link="/hold"');
    expect(source).toContain('translate("Manual and customer holds")');
    expect(source).toContain('const generalHoldTaskCount = computed');
    expect(source).toContain('holdTasks.value.holdTasksTotalCount');
    expect(source).toContain('holdTasks.value.holdSubstituteCount');
    expect(source).toContain('holdTasks.value.holdBadAddressCount');
    expect(source).toContain('holdTasks.value.holdFraudRiskCount');
  });
});
