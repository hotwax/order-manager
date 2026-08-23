import { describe, expect, it } from 'vitest';
import { reconcileSelectedFacilityId } from '@/utils/funnelFacilitySelection';

describe('Funnel facility selection reconciliation', () => {
  it('preserves the selected facility while refreshed rows are loading', () => {
    expect(reconcileSelectedFacilityId('FACILITY_B', [], 'loading')).toBe('FACILITY_B');
  });

  it('preserves the selected facility when it remains in a successful result', () => {
    expect(reconcileSelectedFacilityId(
      'FACILITY_B',
      [{ facilityId: 'FACILITY_A' }, { facilityId: 'FACILITY_B' }],
      'success'
    )).toBe('FACILITY_B');
  });

  it('selects the first facility when the prior selection is absent from a successful result', () => {
    expect(reconcileSelectedFacilityId(
      'REMOVED',
      [{ facilityId: 'FACILITY_A' }, { facilityId: 'FACILITY_B' }],
      'success'
    )).toBe('FACILITY_A');
  });

  it('clears the selection only after a successful empty result', () => {
    expect(reconcileSelectedFacilityId('FACILITY_B', [], 'success')).toBe('');
    expect(reconcileSelectedFacilityId('FACILITY_B', [], 'error')).toBe('FACILITY_B');
  });
});
