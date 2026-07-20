import { watch, type Ref } from 'vue';
import router from '@/router';

export interface ReturnFilters {
  query: string;
  statusId: string;
  dateFrom: string;
  dateThru: string;
  sort: 'entryDate desc' | 'entryDate asc';
}

const OWNED_QUERY_KEYS = ['q', 'status', 'dateFrom', 'dateThru', 'sort'] as const;

export function useReturnSearchRouteState(filters: Ref<ReturnFilters>) {
  let applyingRoute = false;

  function applyRouteState() {
    const query = router.currentRoute.value.query;
    const nextFilters: ReturnFilters = {
      ...filters.value,
      query: queryValue(query.q),
      statusId: queryValue(query.status) || 'All',
      dateFrom: queryValue(query.dateFrom),
      dateThru: queryValue(query.dateThru),
      sort: sortValue(query.sort),
    };
    if (JSON.stringify(nextFilters) === JSON.stringify(filters.value)) return;
    applyingRoute = true;
    filters.value = nextFilters;
    applyingRoute = false;
  }

  watch(() => router.currentRoute.value.query, applyRouteState, { immediate: true });
  watch(
    filters,
    async (value) => {
      if (applyingRoute) return;

      const currentQuery = router.currentRoute.value.query;
      const nextQuery: Record<string, string | string[]> = {};
      Object.entries(currentQuery).forEach(([key, currentValue]) => {
        if (OWNED_QUERY_KEYS.includes(key as (typeof OWNED_QUERY_KEYS)[number])) return;
        if (Array.isArray(currentValue)) nextQuery[key] = currentValue.filter((item): item is string => typeof item === 'string');
        else if (typeof currentValue === 'string') nextQuery[key] = currentValue;
      });

      if (value.query) nextQuery.q = value.query;
      if (value.statusId && value.statusId !== 'All') nextQuery.status = value.statusId;
      if (value.dateFrom) nextQuery.dateFrom = value.dateFrom;
      if (value.dateThru) nextQuery.dateThru = value.dateThru;
      if (value.sort !== 'entryDate desc') nextQuery.sort = value.sort;

      if (sameQuery(currentQuery, nextQuery)) return;
      if (Object.keys(nextQuery).length === 0) {
        await router.replace(router.currentRoute.value.path);
      } else {
        await router.replace({ path: router.currentRoute.value.path, query: nextQuery });
      }
    },
    { deep: true }
  );
}

function queryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function sortValue(value: unknown): ReturnFilters['sort'] {
  return queryValue(value) === 'entryDate asc' ? 'entryDate asc' : 'entryDate desc';
}

function sameQuery(current: Record<string, unknown>, next: Record<string, string | string[]>) {
  return JSON.stringify(normalizeQuery(current)) === JSON.stringify(normalizeQuery(next));
}

function normalizeQuery(query: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)])
  );
}
