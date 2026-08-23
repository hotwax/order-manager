import { DateTime } from 'luxon';
import {
  TASK_SORT_ORDER_BY,
  type OrderTaskFilters,
  type TaskQueueId,
  type TaskQueueRequestParams,
} from '@/types/orderTaskFilters';

export function buildTaskQueueRequest(
  queue: TaskQueueId,
  filters: OrderTaskFilters,
  pageSize: number | string,
  pageIndex: number | string,
): TaskQueueRequestParams {
  const params: TaskQueueRequestParams = {
    pageSize,
    pageIndex,
    orderByField: TASK_SORT_ORDER_BY[filters.sort],
  };

  const query = filters.query.trim();
  if (query) {
    params.orderName = query;
    params.orderName_op = 'contains';
  }
  if (filters.salesChannelEnumId !== 'All') params.salesChannelEnumId = filters.salesChannelEnumId;
  // `workEffortPurposeTypeId` is deliberately not set here: the store owns it,
  // because 'All' on the Hold queue is a NOT-IN query rather than an absent param.

  addDateRange(params, 'orderDate', filters.orderDateFrom, filters.orderDateThru);
  addDateRange(params, 'workEffortCreatedDate', filters.taskCreatedFrom, filters.taskCreatedThru);

  if (queue === 'fraud') {
    if (filters.orderStatusId !== 'All') params.orderStatusId = filters.orderStatusId;
    if (filters.riskRecommendationEnumId !== 'All') params.riskRecommendationEnumId = filters.riskRecommendationEnumId;
    if (filters.riskLevelEnumId !== 'All') params.riskLevelEnumId = filters.riskLevelEnumId;
  } else {
    if (filters.facilityId !== 'All') params.facilityId = filters.facilityId;
    if (filters.shipmentMethodTypeId !== 'All') params.shipmentMethodTypeId = filters.shipmentMethodTypeId;
  }

  return params;
}

export function hasTaskFilters(filters: OrderTaskFilters): boolean {
  return !!(
    filters.query.trim()
    || filters.workEffortPurposeTypeId !== 'All'
    || filters.salesChannelEnumId !== 'All'
    || filters.orderDateFrom
    || filters.orderDateThru
    || filters.taskCreatedFrom
    || filters.taskCreatedThru
    || filters.facilityId !== 'All'
    || filters.shipmentMethodTypeId !== 'All'
    || filters.orderStatusId !== 'All'
    || filters.riskRecommendationEnumId !== 'All'
    || filters.riskLevelEnumId !== 'All'
  );
}

function addDateRange(
  params: TaskQueueRequestParams,
  field: 'orderDate' | 'workEffortCreatedDate',
  from: string,
  thru: string,
) {
  if (from) params[`${field}_from`] = dateBoundary(from, false);
  if (thru) params[`${field}_thru`] = dateBoundary(thru, true);
}

function dateBoundary(value: string, through: boolean): number {
  const parsed = DateTime.fromISO(value);
  if (!parsed.isValid) return new Date(value).getTime();
  return (through ? parsed.endOf('day') : parsed.startOf('day')).toMillis();
}
