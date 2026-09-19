import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useSeedStore } from '@/store/seed';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    getMaargURL: () => 'http://localhost:8080/rest/s1',
    getStatusColor: () => 'medium',
  },
}));

describe('seed store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
  });

  it('loads bounded seed datasets without generic entity endpoints', async () => {
    vi.mocked(api).mockImplementation(async (request: any) => {
      if (request.url === 'admin/productStores') {
        return { data: [{ productStoreId: 'STORE', storeName: 'Demo store' }] };
      }
      if (request.url === 'admin/status' && request.params.statusTypeId === 'ORDER_STATUS') {
        return { data: [{ statusId: 'ORDER_APPROVED', description: 'Approved' }] };
      }
      if (request.url === 'admin/status' && request.params.statusTypeId === 'COM_EVENT_STATUS') {
        return { data: [{ statusId: 'COM_COMPLETE', description: 'Closed' }] };
      }
      if (request.url === 'admin/enums') {
        return { data: [{ enumId: 'WEB_CHANNEL', description: 'Web' }] };
      }
      if (request.url === 'admin/statusFlows/transitions') {
        return { data: [{ statusFlowId: 'Default', statusId: 'ORDER_CREATED', toStatusId: 'ORDER_APPROVED', transitionSequence: 1 }] };
      }
      if (request.url === 'oms/productStores/STORE/shipmentMethods') {
        return { data: [{ productStoreId: 'STORE', shipmentMethodTypeId: 'GROUND', partyId: 'UPS' }] };
      }
      if (request.url === 'oms/shippingGateways/carrierParties') {
        return { data: [{ partyId: 'UPS', groupName: 'UPS' }] };
      }
      if (request.url === 'oms/shippingGateways/shipmentMethodTypes') {
        return { data: [{ shipmentMethodTypeId: 'GROUND', description: 'Ground' }] };
      }
      if (request.url === 'oms/facilityTypes') {
        return { data: [{ facilityTypeId: 'RETAIL_STORE', description: 'Retail store' }] };
      }
      return { data: [] };
    });

    const seedStore = useSeedStore();
    await seedStore.loadInitialSeedData(['STORE']);

    const urls = vi.mocked(api).mock.calls.map(([request]: any[]) => request.url);

    expect(urls).toContain('oms/facilityTypes');
    expect(urls).not.toContain('oms/entityData');
    expect(urls).not.toContain('oms/dataDocumentView');
    expect(seedStore.productStoreName('STORE')).toBe('Demo store');
    expect(seedStore.statusDescription('ORDER_APPROVED')).toBe('Approved');
    expect(seedStore.statusDescription('MISSING_STATUS')).toBe('MISSING_STATUS');
    expect(seedStore.enumDescription('WEB_CHANNEL')).toBe('Web');
    expect(seedStore.getProductStoreShipmentMethodOptions('STORE')).toEqual([{
      id: 'GROUND',
      label: 'Ground',
      carrierPartyId: 'UPS'
    }]);
    expect(seedStore.allowedTransitions('ORDER_CREATED')).toEqual([expect.objectContaining({
      toStatusId: 'ORDER_APPROVED',
      toStatusDescription: 'Approved',
      toStatusColor: 'medium'
    })]);
  });
});
