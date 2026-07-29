import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DateTime } from 'luxon';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDashboardDateRefreshKey,
  getMillisecondsUntilNextDashboardHour
} from '@/utils/dashboardDate';

afterEach(() => {
  vi.useRealTimers();
});

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

  it('refreshes the dashboard once when the selected-timezone date scope changes', () => {
    expect(source).toContain('const dashboardDateRefreshKey = computed(');
    expect(source).toContain('watch(dashboardDateRefreshKey, refreshDashboardData)');
  });

  it('emits one refresh when the selected-timezone clock reaches midnight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T06:59:59.900Z'));

    const userTimeZone = ref('America/Los_Angeles');
    const dashboardNow = shallowRef(DateTime.now());
    const refreshKey = computed(
      () => getDashboardDateRefreshKey(userTimeZone.value, dashboardNow.value)
    );
    const refreshDashboardData = vi.fn();
    const stopRefreshWatch = watch(refreshKey, refreshDashboardData);
    const delay = getMillisecondsUntilNextDashboardHour(userTimeZone.value, dashboardNow.value);

    setTimeout(() => {
      dashboardNow.value = DateTime.now();
    }, delay);
    vi.advanceTimersByTime(delay);
    await nextTick();

    expect(refreshDashboardData).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 60 * 1000);
    dashboardNow.value = DateTime.now();
    await nextTick();
    expect(refreshDashboardData).toHaveBeenCalledTimes(1);

    stopRefreshWatch();
  });

  it('emits one refresh when a timezone change also refreshes the clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T18:00:00Z'));

    const userTimeZone = ref('America/Los_Angeles');
    const dashboardNow = shallowRef(DateTime.now());
    const refreshKey = computed(
      () => getDashboardDateRefreshKey(userTimeZone.value, dashboardNow.value)
    );
    const refreshDashboardData = vi.fn();
    const stopClockWatch = watch(userTimeZone, () => {
      dashboardNow.value = DateTime.now();
    });
    const stopRefreshWatch = watch(refreshKey, refreshDashboardData);

    userTimeZone.value = 'America/New_York';
    await nextTick();

    expect(refreshDashboardData).toHaveBeenCalledTimes(1);

    stopClockWatch();
    stopRefreshWatch();
  });
});
