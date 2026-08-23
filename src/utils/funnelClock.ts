import { DateTime } from 'luxon';
import { onScopeDispose, ref, watch, type Ref } from 'vue';

function zonedNow(timeZoneId: string, nowMillis: number, fallbackTimeZoneId: string) {
  const selected = DateTime.fromMillis(nowMillis, { zone: timeZoneId });
  if (selected.isValid) return selected;

  const fallback = DateTime.fromMillis(nowMillis, { zone: fallbackTimeZoneId });
  return fallback.isValid ? fallback : DateTime.fromMillis(nowMillis, { zone: 'UTC' });
}

export function elapsedHoursSinceDayStartInZone(
  timeZoneId: string,
  nowMillis = Date.now(),
  fallbackTimeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  const now = zonedNow(timeZoneId, nowMillis, fallbackTimeZoneId);
  return Math.floor(now.diff(now.startOf('day'), 'hours').hours);
}

export function millisecondsUntilNextElapsedHour(
  timeZoneId: string,
  nowMillis = Date.now(),
  fallbackTimeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  const now = zonedNow(timeZoneId, nowMillis, fallbackTimeZoneId);
  const elapsedMilliseconds = now.toMillis() - now.startOf('day').toMillis();
  const nextElapsedHour = (Math.floor(elapsedMilliseconds / 3_600_000) + 1) * 3_600_000;
  return nextElapsedHour - elapsedMilliseconds;
}

export function useElapsedHoursSinceDayStart(timeZoneId: Ref<string>, fallbackTimeZoneId?: string) {
  const elapsedHours = ref(elapsedHoursSinceDayStartInZone(timeZoneId.value, Date.now(), fallbackTimeZoneId));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const refresh = () => {
    clearTimer();
    const nowMillis = Date.now();
    elapsedHours.value = elapsedHoursSinceDayStartInZone(timeZoneId.value, nowMillis, fallbackTimeZoneId);
    timer = setTimeout(
      refresh,
      millisecondsUntilNextElapsedHour(timeZoneId.value, nowMillis, fallbackTimeZoneId)
    );
  };

  watch(timeZoneId, refresh, { immediate: true });
  onScopeDispose(clearTimer);

  return elapsedHours;
}
