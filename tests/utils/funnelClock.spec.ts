import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { currentHourInZone, millisecondsUntilNextZoneHour, useCurrentHourInZone } from '@/utils/funnelClock';

afterEach(() => {
  vi.useRealTimers();
});

describe('Funnel clock', () => {
  it('derives the current hour from the selected IANA timezone', () => {
    const now = Date.parse('2026-08-23T13:30:00.000Z');

    expect(currentHourInZone('America/Los_Angeles', now, 'UTC')).toBe(6);
    expect(currentHourInZone('Asia/Kolkata', now, 'UTC')).toBe(19);
  });

  it('uses the deterministic fallback when the selected timezone is invalid', () => {
    const now = Date.parse('2026-08-23T13:30:00.000Z');

    expect(currentHourInZone('Not/A_Zone', now, 'UTC')).toBe(13);
  });

  it('schedules the next refresh at the selected timezone hour boundary', () => {
    const now = Date.parse('2026-08-23T13:59:30.000Z');

    expect(millisecondsUntilNextZoneHour('America/Los_Angeles', now, 'UTC')).toBe(30_000);
  });

  it('keeps hour-boundary scheduling correct across both DST transitions', () => {
    const springForward = Date.parse('2026-03-08T09:30:00.000Z');
    const fallBack = Date.parse('2026-11-01T08:30:00.000Z');

    expect(millisecondsUntilNextZoneHour('America/Los_Angeles', springForward, 'UTC')).toBe(30 * 60_000);
    expect(millisecondsUntilNextZoneHour('America/Los_Angeles', fallBack, 'UTC')).toBe(30 * 60_000);
  });

  it('updates reactively at the next selected-timezone hour boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-23T13:59:30.000Z');
    const timeZoneId = ref('America/Los_Angeles');
    const scope = effectScope();
    const hour = scope.run(() => useCurrentHourInZone(timeZoneId, 'UTC'))!;

    expect(hour.value).toBe(6);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(hour.value).toBe(7);
    scope.stop();
  });

  it('updates immediately when the selected timezone changes and clears its timer on disposal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-23T13:30:00.000Z');
    const timeZoneId = ref('America/Los_Angeles');
    const scope = effectScope();
    const hour = scope.run(() => useCurrentHourInZone(timeZoneId, 'UTC'))!;

    timeZoneId.value = 'Asia/Kolkata';
    await nextTick();

    expect(hour.value).toBe(19);
    expect(vi.getTimerCount()).toBe(1);

    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
