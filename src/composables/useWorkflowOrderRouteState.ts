import { watch, type Ref } from 'vue';
import router from '@/router';
import type { WorkflowFilters } from '@/types/customerService';

const OWNED_QUERY_KEYS = [
  'q',
  'priority',
  'channel',
  'facilityId',
  'shippingMethod',
  'dateFrom',
  'dateThru',
  'sort',
] as const;

export function useWorkflowOrderRouteState(filters: Ref<WorkflowFilters>) {
  let applyingRoute = false;

  function applyRouteState() {
    const query = router.currentRoute.value.query;
    const nextFilters: WorkflowFilters = {
      ...filters.value,
      query: queryValue(query.q),
      priority: priorityValue(query.priority),
      salesChannelEnumId: queryValue(query.channel) || 'All',
      facilityId: queryValue(query.facilityId) || 'All',
      shipmentMethodTypeId: queryValue(query.shippingMethod) || 'All',
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
  watch(filters, async (value) => {
    if (applyingRoute) return;

    const currentQuery = router.currentRoute.value.query;
    const nextQuery: Record<string, string | string[]> = {};
    Object.entries(currentQuery).forEach(([key, currentValue]) => {
      if (OWNED_QUERY_KEYS.includes(key as typeof OWNED_QUERY_KEYS[number])) return;
      if (Array.isArray(currentValue)) nextQuery[key] = currentValue.filter((item): item is string => typeof item === 'string');
      else if (typeof currentValue === 'string') nextQuery[key] = currentValue;
    });

    if (value.query) nextQuery.q = value.query;
    if (value.priority !== null) nextQuery.priority = String(value.priority);
    if (value.salesChannelEnumId !== 'All') nextQuery.channel = value.salesChannelEnumId;
    if (value.facilityId !== 'All') nextQuery.facilityId = value.facilityId;
    if (value.shipmentMethodTypeId !== 'All') nextQuery.shippingMethod = value.shipmentMethodTypeId;
    if (value.dateFrom) nextQuery.dateFrom = value.dateFrom;
    if (value.dateThru) nextQuery.dateThru = value.dateThru;
    if (value.sort !== 'orderDate asc') nextQuery.sort = value.sort;

    if (sameQuery(currentQuery, nextQuery)) return;
    await router.replace({ path: router.currentRoute.value.path, query: nextQuery });
  }, { deep: true });
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function priorityValue(value: unknown) {
  const normalized = queryValue(value);
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function sortValue(value: unknown): WorkflowFilters['sort'] {
  return queryValue(value) === 'orderDate desc' ? 'orderDate desc' : 'orderDate asc';
}

function sameQuery(current: Record<string, unknown>, next: Record<string, string | string[]>) {
  return JSON.stringify(normalizeQuery(current)) === JSON.stringify(normalizeQuery(next));
}

function normalizeQuery(query: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)])
  );
}
