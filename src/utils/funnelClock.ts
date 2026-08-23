import { DateTime } from 'luxon';
import { onScopeDispose, ref, watch, type Ref } from 'vue';

function zonedNow(timeZoneId: string, nowMillis: number, fallbackTimeZoneId: string) {
  const selected = DateTime.fromMillis(nowMillis, { zone: timeZoneId });
  if (selected.isValid) return selected;

  const fallback = DateTime.fromMillis(nowMillis, { zone: fallbackTimeZoneId });
  return fallback.isValid ? fallback : DateTime.fromMillis(nowMillis, { zone: 'UTC' });
}

export function currentHourInZone(
  timeZoneId: string,
  nowMillis = Date.now(),
  fallbackTimeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  return zonedNow(timeZoneId, nowMillis, fallbackTimeZoneId).hour;
}

export function millisecondsUntilNextZoneHour(
  timeZoneId: string,
  nowMillis = Date.now(),
  fallbackTimeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  const now = zonedNow(timeZoneId, nowMillis, fallbackTimeZoneId);
  return now.plus({ hours: 1 }).startOf('hour').toMillis() - now.toMillis();
}

export function useCurrentHourInZone(timeZoneId: Ref<string>, fallbackTimeZoneId?: string) {
  const hour = ref(currentHourInZone(timeZoneId.value, Date.now(), fallbackTimeZoneId));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const refresh = () => {
    clearTimer();
    const nowMillis = Date.now();
    hour.value = currentHourInZone(timeZoneId.value, nowMillis, fallbackTimeZoneId);
    timer = setTimeout(
      refresh,
      millisecondsUntilNextZoneHour(timeZoneId.value, nowMillis, fallbackTimeZoneId)
    );
  };

  watch(timeZoneId, refresh, { immediate: true });
  onScopeDispose(clearTimer);

  return hour;
}
