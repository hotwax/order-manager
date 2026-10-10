import { DateTime } from "luxon";
import { onScopeDispose, ref } from "vue";

/**
 * The start of today in the user's time zone, refreshed at each local midnight, so anything that
 * counts calendar days stays right on a page left open overnight.
 */
export function useToday() {
  const today = ref(DateTime.now().startOf("day").toMillis());
  let timer: ReturnType<typeof setTimeout> | undefined;

  const refresh = () => {
    const now = DateTime.now();
    today.value = now.startOf("day").toMillis();
    // A second past midnight, so the next run is safely on the new day.
    timer = setTimeout(refresh, now.plus({ days: 1 }).startOf("day").diff(now).toMillis() + 1000);
  };

  refresh();
  onScopeDispose(() => clearTimeout(timer));

  return today;
}
