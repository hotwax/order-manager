import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  BULK_ACTION_CONFIGS,
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
