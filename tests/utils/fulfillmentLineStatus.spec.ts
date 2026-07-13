import { describe, expect, it } from 'vitest';
import {
  fulfillmentLineStatus,
  fulfillmentLineStatusColor
} from '@/utils/fulfillmentLineStatus';

describe('fulfillmentLineStatus', () => {
  it('shows Open when a ship group is brokered but fulfillment has not started', () => {
    expect(fulfillmentLineStatus({ firstBrokeredDate: 100 })).toBe('Open');
    expect(fulfillmentLineStatus({ firstReleasedDate: 100 })).toBe('Open');
  });

  it('shows Inflight after picklist activity', () => {
    expect(fulfillmentLineStatus({ firstBrokeredDate: 100, picklistDate: 200 })).toBe('Inflight');
  });

  it('shows Packed for packed and shipped lines', () => {
    expect(fulfillmentLineStatus({ picklistDate: 200, packedDate: 300 })).toBe('Packed');
    expect(fulfillmentLineStatus({ shippedDate: 400 })).toBe('Packed');
  });

  it('leaves the order-item status authoritative without fulfillment evidence', () => {
    expect(fulfillmentLineStatus()).toBeUndefined();
    expect(fulfillmentLineStatus({})).toBeUndefined();
  });

  it('uses consistent Ionic status colors', () => {
    expect(fulfillmentLineStatusColor('Open')).toBe('primary');
    expect(fulfillmentLineStatusColor('Inflight')).toBe('warning');
    expect(fulfillmentLineStatusColor('Packed')).toBe('success');
  });
});
