import { watch, type Ref } from 'vue';
import router from '@/router';
import type { OrderSearchFilters } from '@/store/order';

const OWNED_QUERY_KEYS = [
  'q',
  'status',
  'allocation',
  'channel',
  'shippingMethod',
  'dateFrom',
  'dateThru',
  'sort',
] as const;

export function useOrderSearchRouteState(
  searchQuery: Ref<string>,
  searchFilters: Ref<OrderSearchFilters>,
  searchSort: Ref<string>
) {
  let applyingRoute = false;

  function applyRouteState() {
    const query = router.currentRoute.value.query;
    const nextQuery = queryValue(query.q);
    const nextFilters: OrderSearchFilters = {
      ...searchFilters.value,
      status: queryValues(query.status),
      allocationState: allocationValue(query.allocation),
      channel: queryValue(query.channel) || 'All',
      shipmentMethodTypeId: queryValue(query.shippingMethod) || 'All',
      dateFrom: queryValue(query.dateFrom),
      dateThru: queryValue(query.dateThru),
    };
    const nextSort = queryValue(query.sort) === 'orderDate asc' ? 'orderDate asc' : 'orderDate desc';
    if (
      nextQuery === searchQuery.value
      && nextSort === searchSort.value
      && JSON.stringify(nextFilters) === JSON.stringify(searchFilters.value)
    ) return;
    applyingRoute = true;
    searchQuery.value = nextQuery;
    searchFilters.value = nextFilters;
    searchSort.value = nextSort;
    applyingRoute = false;
  }

  watch(() => router.currentRoute.value.query, applyRouteState, { immediate: true });
  watch([searchQuery, searchFilters, searchSort], async () => {
    if (applyingRoute) return;

    const currentQuery = router.currentRoute.value.query;
    const nextQuery = queryWithoutOwnedKeys(currentQuery, OWNED_QUERY_KEYS);
    if (searchQuery.value) nextQuery.q = searchQuery.value;
    if (searchFilters.value.status.length) nextQuery.status = searchFilters.value.status;
    if (searchFilters.value.allocationState !== 'All') nextQuery.allocation = searchFilters.value.allocationState;
    if (searchFilters.value.channel !== 'All') nextQuery.channel = searchFilters.value.channel;
    if (searchFilters.value.shipmentMethodTypeId !== 'All') nextQuery.shippingMethod = searchFilters.value.shipmentMethodTypeId;
    if (searchFilters.value.dateFrom) nextQuery.dateFrom = searchFilters.value.dateFrom;
    if (searchFilters.value.dateThru) nextQuery.dateThru = searchFilters.value.dateThru;
    if (searchSort.value !== 'orderDate desc') nextQuery.sort = searchSort.value;

    if (sameQuery(currentQuery, nextQuery)) return;
    await router.replace({ query: nextQuery });
  }, { deep: true });
}

interface QueueSearchFilters {
  channel: string;
  shipmentMethodTypeId: string;
  dateFrom: string;
  dateThru: string;
}

const QUEUE_QUERY_KEYS = ['q', 'channel', 'shippingMethod', 'dateFrom', 'dateThru', 'sort'] as const;

export function useOrderQueueRouteState(
  searchQuery: Ref<string>,
  searchFilters: Ref<QueueSearchFilters>,
  searchSort: Ref<string>
) {
  let applyingRoute = false;

  function applyRouteState() {
    const query = router.currentRoute.value.query;
    const nextQuery = queryValue(query.q);
    const nextFilters = {
      channel: queryValue(query.channel) || 'All',
      shipmentMethodTypeId: queryValue(query.shippingMethod) || 'All',
      dateFrom: queryValue(query.dateFrom),
      dateThru: queryValue(query.dateThru),
    };
    const nextSort = queryValue(query.sort) === 'orderDate desc' ? 'orderDate desc' : 'orderDate asc';
    if (
      nextQuery === searchQuery.value
      && nextSort === searchSort.value
      && JSON.stringify(nextFilters) === JSON.stringify(searchFilters.value)
    ) return;
    applyingRoute = true;
    searchQuery.value = nextQuery;
    searchFilters.value = nextFilters;
    searchSort.value = nextSort;
    applyingRoute = false;
  }

  watch(() => router.currentRoute.value.query, applyRouteState, { immediate: true });
  watch([searchQuery, searchFilters, searchSort], async () => {
    if (applyingRoute) return;
    const currentQuery = router.currentRoute.value.query;
    const nextQuery = queryWithoutOwnedKeys(currentQuery, QUEUE_QUERY_KEYS);
    if (searchQuery.value) nextQuery.q = searchQuery.value;
    if (searchFilters.value.channel !== 'All') nextQuery.channel = searchFilters.value.channel;
    if (searchFilters.value.shipmentMethodTypeId !== 'All') nextQuery.shippingMethod = searchFilters.value.shipmentMethodTypeId;
    if (searchFilters.value.dateFrom) nextQuery.dateFrom = searchFilters.value.dateFrom;
    if (searchFilters.value.dateThru) nextQuery.dateThru = searchFilters.value.dateThru;
    if (searchSort.value !== 'orderDate asc') nextQuery.sort = searchSort.value;

    if (sameQuery(currentQuery, nextQuery)) return;
    await router.replace({ query: nextQuery });
  }, { deep: true });
}

function allocationValue(value: unknown): OrderSearchFilters['allocationState'] {
  const normalized = queryValue(value);
  return ['Allocated', 'AwaitingBrokering', 'Unfillable', 'Archived'].includes(normalized)
    ? normalized as OrderSearchFilters['allocationState']
    : 'All';
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

function queryValues(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value ? [value] : [];
}

function queryWithoutOwnedKeys(current: Record<string, unknown>, ownedKeys: readonly string[]) {
  const next: Record<string, string | string[]> = {};
  Object.entries(current).forEach(([key, value]) => {
    if (ownedKeys.includes(key)) return;
    if (Array.isArray(value)) next[key] = value.filter((item): item is string => typeof item === 'string');
    else if (typeof value === 'string') next[key] = value;
  });
  return next;
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
