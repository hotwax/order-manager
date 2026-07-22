import { api } from '@common';
import { searchOrders } from '@/services/order';
import { fetchBrokeringFacilityIds } from '@/utils/brokeringFacilities';
import {
  ADDRESS_VALIDATION_PURPOSE_TYPE_ID,
  FRAUD_RISK_PURPOSE_TYPE_ID,
  HOLD_TASK_TYPE_ID,
  OPEN_TASK_STATUS_IDS,
  SWAP_PURPOSE_TYPE_ID,
  USER_HOLD_PURPOSE_TYPE_IDS,
} from '@/utils/taskQueues';

// Lightweight, count-only queries for the "Blocked" and brokering nav badges.
// Each mirrors the exact filters its queue page uses (same status / facility /
// task-purpose vocabulary) so the badge count always equals what the page lists —
// never a separate dashboard aggregate that can diverge.

const BROKERING_STATUSES = ['ORDER_CREATED', 'ORDER_APPROVED'];
const UNFILLABLE_STATUSES = ['ORDER_CREATED', 'ORDER_APPROVED', 'ORDER_HOLD'];
const UNFILLABLE_FACILITY_IDS = ['UNFILLABLE_PARKING'];
// The tasks endpoint does not return an x-total-count header on this backend, so
// the queue pages count the rows they receive. We fetch a generous single page
// (no per-task enrichment) and count rows the same way, preferring the header
// when a deployment does provide it. Bounds the count for very large queues.
const TASK_COUNT_PAGE_SIZE = 200;

function taskTotalFromHeaders(response: any): number | null {
  const raw = response?.headers?.get?.('x-total-count')
    ?? response?.headers?.['x-total-count']
    ?? response?.headers?.['X-Total-Count'];
  if (raw == null || raw === '') return null;
  const total = Number(raw);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

/** Solr `total` reflects only the query filters (status/facility/store), not the
 * allocation enrichment, so a single-row page yields the queue page's exact count. */
async function orderQueueCount(status: string[], facilityIds: string[], productStoreId?: string): Promise<number> {
  const result = await searchOrders({ status, facilityIds, productStoreId, pageSize: 1, pageIndex: 0 });
  return result.total ?? 0;
}

async function taskQueueCount(taskParams: Record<string, any>, productStoreId?: string): Promise<number> {
  const response = await api({
    url: 'oms/orders/tasks',
    method: 'GET',
    params: {
      taskStatusId: OPEN_TASK_STATUS_IDS,
      taskStatusId_op: 'in',
      ...(productStoreId ? { productStoreId } : {}),
      ...taskParams,
      pageSize: TASK_COUNT_PAGE_SIZE,
      pageIndex: 0,
    },
  });
  const headerTotal = taskTotalFromHeaders(response);
  if (headerTotal !== null) return headerTotal;
  const rows = Array.isArray(response.data) ? response.data : (response.data?.tasks ?? []);
  return rows.length;
}

export function fetchUnfillableCount(productStoreId?: string) {
  return orderQueueCount(UNFILLABLE_STATUSES, UNFILLABLE_FACILITY_IDS, productStoreId);
}

export async function fetchBrokeringCount(productStoreId?: string) {
  return orderQueueCount(BROKERING_STATUSES, await fetchBrokeringFacilityIds(), productStoreId);
}

export function fetchHoldCount(productStoreId?: string) {
  return taskQueueCount({
    workEffortTypeId: HOLD_TASK_TYPE_ID,
    workEffortPurposeTypeId: USER_HOLD_PURPOSE_TYPE_IDS,
    workEffortPurposeTypeId_op: 'in',
  }, productStoreId);
}

export function fetchBadAddressCount(productStoreId?: string) {
  return taskQueueCount({
    workEffortTypeId: HOLD_TASK_TYPE_ID,
    workEffortPurposeTypeId: ADDRESS_VALIDATION_PURPOSE_TYPE_ID,
  }, productStoreId);
}

export function fetchSwapCount(productStoreId?: string) {
  return taskQueueCount({
    workEffortTypeId: HOLD_TASK_TYPE_ID,
    workEffortPurposeTypeId: SWAP_PURPOSE_TYPE_ID,
  }, productStoreId);
}

export function fetchFraudCount(productStoreId?: string) {
  return taskQueueCount({
    workEffortTypeId: HOLD_TASK_TYPE_ID,
    workEffortPurposeTypeId: FRAUD_RISK_PURPOSE_TYPE_ID,
  }, productStoreId);
}

/** Nav-badge key → count fetcher. `open`/`inflight`/`packed` are primed
 * separately by the Funnel's brokered-workload fetch. */
export const queueCountFetchers: Record<string, (productStoreId?: string) => Promise<number>> = {
  unfillable: fetchUnfillableCount,
  brokering: fetchBrokeringCount,
  hold: fetchHoldCount,
  badAddress: fetchBadAddressCount,
  swap: fetchSwapCount,
  fraud: fetchFraudCount,
};
