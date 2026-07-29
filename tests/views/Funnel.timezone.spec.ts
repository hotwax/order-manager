import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Funnel timezone clock', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/Funnel.vue'), 'utf8');

  it('renders the selected-timezone hour instead of the browser Date hour', () => {
    expect(source).toContain('{{ hoursSinceDayStart }}');
    expect(source).not.toContain('new Date().getHours()');
    expect(source).toContain('getHoursSinceDayStart(userTimeZone.value, dashboardNow.value)');
  });

  it('refreshes at hour boundaries and after the selected timezone changes', () => {
    expect(source).toContain('onMounted(refreshDashboardClock)');
    expect(source).toContain('watch(userTimeZone, refreshDashboardClock)');
    expect(source).toContain('getMillisecondsUntilNextDashboardHour(userTimeZone.value, dashboardNow.value)');
    expect(source).toContain('onUnmounted(clearDashboardClockTimer)');
  });
});
