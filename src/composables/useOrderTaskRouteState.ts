import { watch, type Ref } from 'vue';
import router from '@/router';
import {
  DEFAULT_TASK_SORT,
  defaultOrderTaskFilters,
  isTaskSort,
  type OrderTaskFilters,
  type TaskQueueId,
} from '@/types/orderTaskFilters';

const OWNED_QUERY_KEYS = [
  'q',
  'channel',
  'orderDateFrom',
  'orderDateThru',
  'taskCreatedFrom',
  'taskCreatedThru',
  'facilityId',
  'shippingMethod',
  'orderStatus',
  'riskRecommendation',
  'riskLevel',
  'sort',
] as const;

export function useOrderTaskRouteState(filters: Ref<OrderTaskFilters>, queue: TaskQueueId) {
  let applyingRoute = false;

  function applyRouteState() {
    const query = router.currentRoute.value.query;
    const defaults = defaultOrderTaskFilters();
    const routeSort = queryValue(query.sort);
    const next: OrderTaskFilters = {
      ...defaults,
      query: queryValue(query.q),
      salesChannelEnumId: queryValue(query.channel) || 'All',
      orderDateFrom: queryValue(query.orderDateFrom),
      orderDateThru: queryValue(query.orderDateThru),
      taskCreatedFrom: queryValue(query.taskCreatedFrom),
      taskCreatedThru: queryValue(query.taskCreatedThru),
      facilityId: queue === 'fraud' ? 'All' : queryValue(query.facilityId) || 'All',
      shipmentMethodTypeId: queue === 'fraud' ? 'All' : queryValue(query.shippingMethod) || 'All',
      orderStatusId: queue === 'fraud' ? queryValue(query.orderStatus) || 'All' : 'All',
      riskRecommendationEnumId: queue === 'fraud' ? queryValue(query.riskRecommendation) || 'All' : 'All',
      riskLevelEnumId: queue === 'fraud' ? queryValue(query.riskLevel) || 'All' : 'All',
      sort: isTaskSort(routeSort, queue) ? routeSort : DEFAULT_TASK_SORT,
    };

    if (JSON.stringify(next) === JSON.stringify(filters.value)) return;
    applyingRoute = true;
    filters.value = next;
    applyingRoute = false;
  }

  watch(() => router.currentRoute.value.query, applyRouteState, { immediate: true });
  watch(filters, async (value) => {
    if (applyingRoute) return;

    const current = router.currentRoute.value.query;
    const next: Record<string, string | string[]> = {};
    Object.entries(current).forEach(([key, currentValue]) => {
      if (OWNED_QUERY_KEYS.includes(key as typeof OWNED_QUERY_KEYS[number])) return;
      if (Array.isArray(currentValue)) next[key] = currentValue.filter((item): item is string => typeof item === 'string');
      else if (typeof currentValue === 'string') next[key] = currentValue;
    });

    if (value.query) next.q = value.query;
    if (value.salesChannelEnumId !== 'All') next.channel = value.salesChannelEnumId;
    if (value.orderDateFrom) next.orderDateFrom = value.orderDateFrom;
    if (value.orderDateThru) next.orderDateThru = value.orderDateThru;
    if (value.taskCreatedFrom) next.taskCreatedFrom = value.taskCreatedFrom;
    if (value.taskCreatedThru) next.taskCreatedThru = value.taskCreatedThru;
    if (queue !== 'fraud' && value.facilityId !== 'All') next.facilityId = value.facilityId;
    if (queue !== 'fraud' && value.shipmentMethodTypeId !== 'All') next.shippingMethod = value.shipmentMethodTypeId;
    if (queue === 'fraud' && value.orderStatusId !== 'All') next.orderStatus = value.orderStatusId;
    if (queue === 'fraud' && value.riskRecommendationEnumId !== 'All') next.riskRecommendation = value.riskRecommendationEnumId;
    if (queue === 'fraud' && value.riskLevelEnumId !== 'All') next.riskLevel = value.riskLevelEnumId;
    if (value.sort !== DEFAULT_TASK_SORT) next.sort = value.sort;

    if (!sameQuery(current, next)) await router.replace({ query: next });
  }, { deep: true });
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
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
