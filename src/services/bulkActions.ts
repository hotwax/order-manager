import { DateTime } from 'luxon';
import { api, logger } from '@common';

/**
 * Bulk actions are executed through the Maarg Data Manager (MDM) rather than by looping REST
 * calls in the browser.
 *
 * The app serialises one JSON record per selected order, uploads the array as a single file, and
 * the backend runner imports it record by record, each in its own transaction. That gives three
 * things a client-side loop cannot: the operator may close the app the moment the upload returns,
 * one bad order never aborts the others, and every run leaves a DataManagerLog with an error file
 * of exactly the records that failed, ready to be fixed and re-uploaded to the same config.
 */

/** DataManagerConfig ids. These are data rows in the OMS component; keep them in sync with
 *  `upgrade/UpcomingRelease/UpgradeData.xml` and `data/DA_ExtSeed_AA_SeedData.xml` in hotwax/oms. */
export const BULK_ACTION_CONFIGS = {
  park: 'UPDATE_ORDER_PARKING',
  facility: 'UPDATE_ORDER_FACILITY',
  shipMethod: 'UPDATE_ORDER_SHIP_METHOD',
  shipDates: 'UPDATE_ORDER_SHIP_DATES',
  cancelItems: 'CANCEL_ORDER_ITEMS',
  createTasks: 'CREATE_ORDER_TASKS'
} as const;

export type BulkActionKey = keyof typeof BULK_ACTION_CONFIGS;

export type BulkActionRecord = Record<string, unknown>;

/** Which permission each action is gated on, so every page grants them the same way. */
const ACTION_PERMISSION: Record<BulkActionKey, 'update' | 'cancel' | 'createTask'> = {
  park: 'update',
  facility: 'update',
  shipMethod: 'update',
  shipDates: 'update',
  cancelItems: 'cancel',
  createTasks: 'createTask'
};

export type BulkActionPermissions = {
  canUpdate: boolean;
  canCancel: boolean;
  canCreateTask: boolean;
};

/** Narrows a page's candidate actions to the ones the signed-in user may actually run. */
export function permittedBulkActions(
  candidates: BulkActionKey[],
  permissions: BulkActionPermissions
): BulkActionKey[] {
  return candidates.filter((action) => {
    if (ACTION_PERMISSION[action] === 'cancel') return permissions.canCancel;
    if (ACTION_PERMISSION[action] === 'createTask') return permissions.canCreateTask;
    return permissions.canUpdate;
  });
}

/**
 * Uploads `records` as one JSON file against `configId`.
 *
 * The field names are the ones `upload#DataManagerFile` actually declares: `configId` and
 * `contentFile`. Content-Type is deliberately not set — axios derives the multipart boundary from
 * the FormData, and naming the type without a boundary produces a request the backend cannot
 * parse.
 */
export async function submitBulkActionMdmFile(
  configId: string,
  records: BulkActionRecord[],
  semanticName: string
) {
  if (!records.length) throw new Error('No records to submit');

  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const fileName = `${semanticName}_${configId}_${DateTime.now().toFormat('yyyyMMddHHmmss')}.json`;

  const formData = new FormData();
  formData.append('configId', configId);
  formData.append('contentFile', blob, fileName);

  return api({
    url: 'admin/uploadDataManagerFile',
    method: 'POST',
    data: formData
  });
}

/** Moqui parses timestamps in this format; an ISO string with `T`/`Z` is not reliably converted. */
export function toMoquiTimestamp(value: string): string {
  const parsed = value.length <= 10
    ? DateTime.fromFormat(value, 'yyyy-MM-dd')
    : DateTime.fromISO(value);

  return parsed.isValid ? parsed.toFormat('yyyy-MM-dd HH:mm:ss') : value;
}

/* ---------------------------------------------------------------------------------------------
 * Record builders — one object per selected order, matching each consumer service's in-parameters.
 * Ship group is intentionally left out: the bulk selection is order-level, and the consumer
 * services resolve the order's own ship groups and open items.
 * ------------------------------------------------------------------------------------------- */

export function parkOrderRecords(orderIds: string[], facilityId: string): BulkActionRecord[] {
  return orderIds.map((orderId) => ({ orderId, facilityId }));
}

export function updateFacilityRecords(
  orderIds: string[],
  facilityId: string,
  options: { changeReasonEnumId?: string; comments?: string } = {}
): BulkActionRecord[] {
  return orderIds.map((orderId) => ({
    orderId,
    facilityId,
    ...(options.changeReasonEnumId ? { changeReasonEnumId: options.changeReasonEnumId } : {}),
    ...(options.comments ? { comments: options.comments } : {})
  }));
}

export function updateShipMethodRecords(
  orderIds: string[],
  carrierPartyId: string,
  shipmentMethodTypeId: string
): BulkActionRecord[] {
  return orderIds.map((orderId) => ({ orderId, carrierPartyId, shipmentMethodTypeId }));
}

export function updateShipDatesRecords(orderIds: string[], shipByDate: string): BulkActionRecord[] {
  const timestamp = toMoquiTimestamp(shipByDate);
  return orderIds.map((orderId) => ({ orderId, shipByDate: timestamp }));
}

export function cancelOpenItemsRecords(
  orderIds: string[],
  reason: string,
  comment?: string
): BulkActionRecord[] {
  return orderIds.map((orderId) => ({
    orderId,
    reason,
    ...(comment ? { comment } : {})
  }));
}

export function createOrderTaskRecords(
  orderIds: string[],
  task: {
    workEffortTypeId: string;
    workEffortPurposeTypeId: string;
    workEffortName: string;
    description: string;
  }
): BulkActionRecord[] {
  return orderIds.map((orderId) => ({ orderId, ...task }));
}

/* ---------------------------------------------------------------------------------------------
 * Run history — the read side backing the Bulk actions activity page.
 *
 * MDM already records every upload as a DataManagerLog, so the page reads those logs rather than
 * keeping its own state. Only the six order bulk-action configs are shown; the same endpoint also
 * carries unrelated data-setup and connector imports, which belong in Job Manager.
 * ------------------------------------------------------------------------------------------- */

/** Operator-facing name for each config, so the page never shows a raw config id. */
export const BULK_ACTION_DISPLAY_NAMES: Record<string, string> = {
  UPDATE_ORDER_PARKING: 'Park orders',
  UPDATE_ORDER_FACILITY: 'Re-route fulfillment facility',
  UPDATE_ORDER_SHIP_METHOD: 'Update carrier & shipping method',
  UPDATE_ORDER_SHIP_DATES: 'Update ship dates',
  CANCEL_ORDER_ITEMS: 'Cancel open items',
  CREATE_ORDER_TASKS: 'Create order tasks'
};

export const BULK_ACTION_CONFIG_IDS = Object.values(BULK_ACTION_CONFIGS);

export type BulkActionRunState = 'pending' | 'processing' | 'completed' | 'completedWithIssues' | 'failed' | 'cancelled';

export type BulkActionRun = {
  logId: string;
  configId: string;
  actionName: string;
  statusId: string;
  state: BulkActionRunState;
  stateLabel: string;
  stateColor: string;
  submittedAt: string;
  totalRecordCount: number | null;
  failedRecordCount: number;
  successRecordCount: number | null;
  errorLogContentId: string | null;
  canCancel: boolean;
};

const STATE_PRESENTATION: Record<BulkActionRunState, { label: string; color: string }> = {
  pending: { label: 'Queued', color: 'medium' },
  processing: { label: 'Processing', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
  completedWithIssues: { label: 'Completed with issues', color: 'warning' },
  failed: { label: 'Failed', color: 'danger' },
  cancelled: { label: 'Cancelled', color: 'medium' }
};

/** Statuses that are still moving, so the page keeps polling while any run is in one of them. */
const ACTIVE_STATUS_IDS = ['DmlsPending', 'DmlsQueued', 'DmlsRunning'];

/**
 * `DmlsFinished` only means the run reached the end — records may still have failed. The verdict is
 * the failed-record count, which is why "Completed" and "Completed with issues" share a status id.
 */
function runState(statusId: string, failedRecordCount: number): BulkActionRunState {
  if (statusId === 'DmlsPending' || statusId === 'DmlsQueued') return 'pending';
  if (statusId === 'DmlsRunning') return 'processing';
  if (statusId === 'DmlsCancelled') return 'cancelled';
  if (statusId === 'DmlsFailed' || statusId === 'DmlsCrashed') return 'failed';
  return failedRecordCount > 0 ? 'completedWithIssues' : 'completed';
}

export function toBulkActionRun(log: any): BulkActionRun {
  const statusId = String(log.statusId || '');
  const failedRecordCount = Number(log.failedRecordCount) || 0;
  const totalRecordCount = log.totalRecordCount == null ? null : Number(log.totalRecordCount);
  const state = runState(statusId, failedRecordCount);

  return {
    logId: String(log.logId || ''),
    configId: String(log.configId || ''),
    actionName: BULK_ACTION_DISPLAY_NAMES[log.configId] || log.description || log.configId || '',
    statusId,
    state,
    stateLabel: STATE_PRESENTATION[state].label,
    stateColor: STATE_PRESENTATION[state].color,
    submittedAt: log.createdDate || '',
    totalRecordCount,
    failedRecordCount,
    successRecordCount: totalRecordCount == null ? null : totalRecordCount - failedRecordCount,
    // Only a finished run has an error file worth offering.
    errorLogContentId: log.errorLogContentId ? String(log.errorLogContentId) : null,
    // MDM can only cancel a run the scheduled loader has not picked up yet.
    canCancel: statusId === 'DmlsPending'
  };
}

export function hasActiveRun(runs: BulkActionRun[]): boolean {
  return runs.some((run) => ACTIVE_STATUS_IDS.includes(run.statusId));
}

export async function fetchBulkActionRuns(options: { statusIds?: string[]; pageSize?: number } = {}) {
  const params: Record<string, any> = {
    configId: BULK_ACTION_CONFIG_IDS.join(','),
    configId_op: 'in',
    pageSize: options.pageSize ?? 50,
    pageIndex: 0,
    orderByField: '-createdDate'
  };

  if (options.statusIds?.length) {
    params.statusId = options.statusIds.join(',');
    params.statusId_op = 'in';
  }

  const resp = await api({ url: 'admin/dataManager/details', method: 'GET', params });
  const logs = resp?.data?.dataManagerLogs ?? [];
  return {
    runs: logs.map(toBulkActionRun),
    total: Number(resp?.data?.dataManagerLogsCount) || 0
  };
}

/** Count of runs still queued or processing — drives the menu badge. */
export async function fetchActiveBulkActionRunCount(): Promise<number> {
  try {
    const resp = await api({
      url: 'admin/dataManager/details',
      method: 'GET',
      params: {
        configId: BULK_ACTION_CONFIG_IDS.join(','),
        configId_op: 'in',
        statusId: ACTIVE_STATUS_IDS.join(','),
        statusId_op: 'in',
        pageSize: 1,
        pageIndex: 0
      }
    });
    return Number(resp?.data?.dataManagerLogsCount) || 0;
  } catch (error) {
    logger.error('Failed to fetch active bulk action run count', error);
    return 0;
  }
}

/** Returns the error file text, or null when the run stored no downloadable content. */
export async function fetchBulkActionErrorFile(configId: string, errorLogContentId: string): Promise<string | null> {
  const resp = await api({
    url: 'admin/dataManager/downloadDataManagerFile',
    method: 'GET',
    params: { configId, logContentId: errorLogContentId }
  });

  const content = resp?.data?.csvData ?? resp?.data;
  if (content && typeof content === 'object' && !Object.keys(content).length) return null;
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  return text && text.replace(/\s/g, '') !== '{}' ? text : null;
}

export async function cancelBulkActionRun(configId: string, logId: string) {
  return api({
    url: `admin/dataManager/log/${logId}`,
    method: 'PUT',
    data: { configId, logId, statusId: 'DmlsCancelled' }
  });
}
