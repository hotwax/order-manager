export type TaskQueueId = 'swap' | 'badAddress' | 'fraud' | 'hold';

export type TaskSort =
  | 'oldestTask'
  | 'newestTask'
  | 'oldestOrder'
  | 'newestOrder'
  | 'highestTotal'
  | 'lowestTotal'
  | 'highestRisk'
  | 'lowestRisk'
  | 'recommendationAsc'
  | 'recommendationDesc';

export interface TaskSortOption {
  label: string;
  value: TaskSort;
}

export interface TaskFilterOption {
  id: string;
  label: string;
}

export interface OrderTaskFilters {
  query: string;
  /** Hold queue only: 'All' means every purpose without a dedicated queue page. */
  workEffortPurposeTypeId: string;
  salesChannelEnumId: string;
  orderDateFrom: string;
  orderDateThru: string;
  taskCreatedFrom: string;
  taskCreatedThru: string;
  facilityId: string;
  shipmentMethodTypeId: string;
  orderStatusId: string;
  riskRecommendationEnumId: string;
  riskLevelEnumId: string;
  sort: TaskSort;
}

export interface TaskQueueRequestParams {
  pageSize?: number | string;
  pageIndex?: number | string;
  orderByField?: string;
  orderName?: string;
  orderName_op?: 'contains';
  salesChannelEnumId?: string;
  orderDate_from?: number;
  orderDate_thru?: number;
  workEffortCreatedDate_from?: number;
  workEffortCreatedDate_thru?: number;
  facilityId?: string;
  shipmentMethodTypeId?: string;
  orderStatusId?: string;
  riskRecommendationEnumId?: string;
  riskLevelEnumId?: string;
}

export const DEFAULT_TASK_SORT: TaskSort = 'oldestTask';

export const COMMON_TASK_SORT_OPTIONS: TaskSortOption[] = [
  { label: 'Oldest task first', value: 'oldestTask' },
  { label: 'Newest task first', value: 'newestTask' },
  { label: 'Oldest order first', value: 'oldestOrder' },
  { label: 'Newest order first', value: 'newestOrder' },
  { label: 'Highest order total', value: 'highestTotal' },
  { label: 'Lowest order total', value: 'lowestTotal' },
];

export const FRAUD_TASK_SORT_OPTIONS: TaskSortOption[] = [
  ...COMMON_TASK_SORT_OPTIONS,
  { label: 'Highest risk severity first', value: 'highestRisk' },
  { label: 'Lowest risk severity first', value: 'lowestRisk' },
  { label: 'Risk recommendation A-Z', value: 'recommendationAsc' },
  { label: 'Risk recommendation Z-A', value: 'recommendationDesc' },
];

export const TASK_SORT_ORDER_BY: Record<TaskSort, string> = {
  oldestTask: 'workEffortCreatedDate,workEffortId',
  newestTask: '-workEffortCreatedDate,-workEffortId',
  oldestOrder: 'orderDate,workEffortId',
  newestOrder: '-orderDate,-workEffortId',
  highestTotal: '-grandTotal,-workEffortId',
  lowestTotal: 'grandTotal,workEffortId',
  highestRisk: 'riskLevelSortRank,workEffortId',
  lowestRisk: '-riskLevelSortRank,-workEffortId',
  recommendationAsc: 'riskRecommendationSortValue,workEffortId',
  recommendationDesc: '-riskRecommendationSortValue,-workEffortId',
};

export function defaultOrderTaskFilters(): OrderTaskFilters {
  return {
    query: '',
    workEffortPurposeTypeId: 'All',
    salesChannelEnumId: 'All',
    orderDateFrom: '',
    orderDateThru: '',
    taskCreatedFrom: '',
    taskCreatedThru: '',
    facilityId: 'All',
    shipmentMethodTypeId: 'All',
    orderStatusId: 'All',
    riskRecommendationEnumId: 'All',
    riskLevelEnumId: 'All',
    sort: DEFAULT_TASK_SORT,
  };
}

export function taskSortOptions(queue: TaskQueueId): TaskSortOption[] {
  return queue === 'fraud' ? FRAUD_TASK_SORT_OPTIONS : COMMON_TASK_SORT_OPTIONS;
}

export function isTaskSort(value: unknown, queue: TaskQueueId): value is TaskSort {
  return taskSortOptions(queue).some((option) => option.value === value);
}
