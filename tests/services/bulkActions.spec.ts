import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  BULK_ACTION_CONFIGS,
  BULK_ACTION_CONFIG_IDS,
  cancelBulkActionRun,
  fetchBulkActionRuns,
  hasActiveRun,
  toBulkActionRun,
  cancelOpenItemsRecords,
  createOrderTaskRecords,
  parkOrderRecords,
  permittedBulkActions,
  submitBulkActionMdmFile,
  toMoquiTimestamp,
  updateFacilityRecords,
  updateShipDatesRecords,
  updateShipMethodRecords,
  type BulkActionKey
} from '@/services/bulkActions';

vi.mock('@common/core/remoteApi', () => {
  const fn = vi.fn();
  return { default: fn, client: fn, axios: fn };
});

vi.mock('@common', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const remoteApi = await import('@common/core/remoteApi');
  return { ...actual, api: (remoteApi as any).default };
});

const apiMock = api as unknown as ReturnType<typeof vi.fn>;

describe('bulk action MDM producer', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ data: { logId: '1001' } });
  });

  it('uploads one JSON array to the DataManager endpoint using the declared field names', async () => {
    const records = parkOrderRecords(['10001', '10002'], 'PARKING_REJECTED');

    await submitBulkActionMdmFile(BULK_ACTION_CONFIGS.park, records, 'park');

    expect(apiMock).toHaveBeenCalledTimes(1);
    const request = apiMock.mock.calls[0][0];
    expect(request.url).toBe('admin/uploadDataManagerFile');
    expect(request.method).toBe('POST');

    const formData = request.data as FormData;
    // upload#DataManagerFile declares configId and contentFile; anything else is dropped.
    expect(formData.get('configId')).toBe('UPDATE_ORDER_PARKING');
    const file = formData.get('contentFile') as File;
    expect(file).toBeInstanceOf(Blob);
    expect(await file.text()).toBe(JSON.stringify(records, null, 2));
  });

  it('leaves Content-Type unset so axios can derive the multipart boundary', async () => {
    await submitBulkActionMdmFile(BULK_ACTION_CONFIGS.park, parkOrderRecords(['10001'], 'PARKING'), 'park');

    expect(apiMock.mock.calls[0][0].headers).toBeUndefined();
  });

  it('refuses to upload an empty selection', async () => {
    await expect(submitBulkActionMdmFile(BULK_ACTION_CONFIGS.park, [], 'park')).rejects.toThrow();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('sends one record per selected order', () => {
    expect(parkOrderRecords(['1', '2', '3'], 'PARKING')).toHaveLength(3);
  });
});

describe('bulk action record shapes', () => {
  it('matches park#Order in-parameters', () => {
    expect(parkOrderRecords(['10001'], 'PARKING_REJECTED')).toEqual([
      { orderId: '10001', facilityId: 'PARKING_REJECTED' }
    ]);
  });

  it('matches update#OrderFacility in-parameters and omits blank optionals', () => {
    expect(updateFacilityRecords(['10001'], 'WH_STORE_01')).toEqual([
      { orderId: '10001', facilityId: 'WH_STORE_01' }
    ]);
    expect(updateFacilityRecords(['10001'], 'WH_STORE_01', { comments: 'rebalance' })).toEqual([
      { orderId: '10001', facilityId: 'WH_STORE_01', comments: 'rebalance' }
    ]);
  });

  it('matches update#ShippingMethod in-parameters', () => {
    expect(updateShipMethodRecords(['10001'], 'UPS', 'NEXT_DAY')).toEqual([
      { orderId: '10001', carrierPartyId: 'UPS', shipmentMethodTypeId: 'NEXT_DAY' }
    ]);
  });

  it('matches cancel#OrderOpenItems in-parameters and drops an empty comment', () => {
    expect(cancelOpenItemsRecords(['10001'], 'NO_VARIANCE_LOG', '')).toEqual([
      { orderId: '10001', reason: 'NO_VARIANCE_LOG' }
    ]);
    expect(cancelOpenItemsRecords(['10001'], 'NO_VARIANCE_LOG', 'out of stock')).toEqual([
      { orderId: '10001', reason: 'NO_VARIANCE_LOG', comment: 'out of stock' }
    ]);
  });

  it('matches create#OrderTasks in-parameters', () => {
    expect(createOrderTaskRecords(['10001'], {
      workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
      workEffortPurposeTypeId: 'ORD_HOLD_CUST_REQ',
      workEffortName: 'Hold for customer',
      description: 'Customer asked to delay'
    })).toEqual([
      {
        orderId: '10001',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'ORD_HOLD_CUST_REQ',
        workEffortName: 'Hold for customer',
        description: 'Customer asked to delay'
      }
    ]);
  });

  it('converts a date input into the timestamp format Moqui parses', () => {
    expect(updateShipDatesRecords(['10001'], '2026-08-25')).toEqual([
      { orderId: '10001', shipByDate: '2026-08-25 00:00:00' }
    ]);
    // An ISO string with T/Z is not reliably converted server-side, so it is normalised here.
    expect(toMoquiTimestamp('2026-08-25T13:45:00Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('bulk action permissions', () => {
  const ALL: BulkActionKey[] = ['park', 'facility', 'shipMethod', 'shipDates', 'cancelItems', 'createTasks'];

  it('keeps only update-gated actions when the user may not cancel or create tasks', () => {
    expect(permittedBulkActions(ALL, { canUpdate: true, canCancel: false, canCreateTask: false }))
      .toEqual(['park', 'facility', 'shipMethod', 'shipDates']);
  });

  it('gates cancelling and task creation on their own permissions', () => {
    expect(permittedBulkActions(ALL, { canUpdate: false, canCancel: true, canCreateTask: true }))
      .toEqual(['cancelItems', 'createTasks']);
  });

  it('offers nothing when the user holds none of the permissions', () => {
    expect(permittedBulkActions(ALL, { canUpdate: false, canCancel: false, canCreateTask: false })).toEqual([]);
  });

  it('never widens a page beyond the actions it declares', () => {
    expect(permittedBulkActions(['shipMethod', 'shipDates', 'createTasks'],
      { canUpdate: true, canCancel: true, canCreateTask: true }))
      .toEqual(['shipMethod', 'shipDates', 'createTasks']);
  });
});

describe('bulk action run mapping', () => {
  const baseLog = {
    logId: '5001',
    configId: 'UPDATE_ORDER_SHIP_DATES',
    statusId: 'DmlsFinished',
    createdDate: '2026-08-17T09:00:00Z',
    totalRecordCount: 20,
    failedRecordCount: 0
  };

  it('names the run from the config rather than showing a raw config id', () => {
    expect(toBulkActionRun(baseLog).actionName).toBe('Update ship dates');
  });

  it('treats a finished run with no failures as completed', () => {
    const run = toBulkActionRun(baseLog);
    expect(run.state).toBe('completed');
    expect(run.stateLabel).toBe('Completed');
    expect(run.successRecordCount).toBe(20);
  });

  // DmlsFinished only means the run reached the end; failed records still land in the error file.
  it('splits a finished run with failures into completed-with-issues', () => {
    const run = toBulkActionRun({ ...baseLog, failedRecordCount: 2 });
    expect(run.state).toBe('completedWithIssues');
    expect(run.stateLabel).toBe('Completed with issues');
    expect(run.successRecordCount).toBe(18);
  });

  it('maps the queued, running, failed and cancelled statuses', () => {
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsPending' }).state).toBe('pending');
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsQueued' }).state).toBe('pending');
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsRunning' }).state).toBe('processing');
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsFailed' }).state).toBe('failed');
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsCrashed' }).state).toBe('failed');
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsCancelled' }).state).toBe('cancelled');
  });

  it('only offers cancel while the run is still pending', () => {
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsPending' }).canCancel).toBe(true);
    expect(toBulkActionRun({ ...baseLog, statusId: 'DmlsRunning' }).canCancel).toBe(false);
    expect(toBulkActionRun(baseLog).canCancel).toBe(false);
  });

  it('reports an active run only while something is queued or processing', () => {
    expect(hasActiveRun([toBulkActionRun(baseLog)])).toBe(false);
    expect(hasActiveRun([toBulkActionRun({ ...baseLog, statusId: 'DmlsRunning' })])).toBe(true);
    expect(hasActiveRun([toBulkActionRun({ ...baseLog, statusId: 'DmlsPending' })])).toBe(true);
  });

  it('survives a log that has no record counts yet', () => {
    const run = toBulkActionRun({ ...baseLog, statusId: 'DmlsPending', totalRecordCount: null, failedRecordCount: null });
    expect(run.totalRecordCount).toBeNull();
    expect(run.successRecordCount).toBeNull();
    expect(run.failedRecordCount).toBe(0);
  });
});

describe('bulk action run queries', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ data: { dataManagerLogs: [], dataManagerLogsCount: 0 } });
  });

  it('asks only for the six order bulk-action configs, newest first', async () => {
    await fetchBulkActionRuns();

    const params = apiMock.mock.calls[0][0].params;
    expect(apiMock.mock.calls[0][0].url).toBe('admin/dataManager/details');
    expect(params.configId.split(',').sort()).toEqual([...BULK_ACTION_CONFIG_IDS].sort());
    expect(params.configId_op).toBe('in');
    expect(params.orderByField).toBe('-createdDate');
  });

  it('cancels a run by moving its log to DmlsCancelled', async () => {
    await cancelBulkActionRun('CANCEL_ORDER_ITEMS', '5001');

    const request = apiMock.mock.calls[0][0];
    expect(request.url).toBe('admin/dataManager/log/5001');
    expect(request.method).toBe('PUT');
    expect(request.data).toEqual({ configId: 'CANCEL_ORDER_ITEMS', logId: '5001', statusId: 'DmlsCancelled' });
  });
});
