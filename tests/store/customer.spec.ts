import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  getCustomerOrdersFromSolr,
  getCustomerProfile,
  getCustomerRelationships,
  getCustomerTasks
} from '@/services/customer';
import { useCustomerStore } from '@/store/customer';
import type { CustomerProfile } from '@/types/customer';

vi.mock('@/services/customer', () => ({
  getCustomerProfile: vi.fn(),
  getCustomerOrdersFromSolr: vi.fn(),
  getCustomerTasks: vi.fn(),
  getCustomerRelationships: vi.fn(),
  createPartyRelationship: vi.fn(),
  expirePartyRelationship: vi.fn()
}));

describe('customer detail store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getCustomerProfile).mockReset();
    vi.mocked(getCustomerOrdersFromSolr).mockReset();
    vi.mocked(getCustomerTasks).mockReset();
    vi.mocked(getCustomerRelationships).mockReset();
    // Section sources default to empty so dashboard fan-out never rejects.
    vi.mocked(getCustomerOrdersFromSolr).mockResolvedValue({ orders: [], lifetimeOrders: 0, lifetimeValue: 0, currencyUom: 'USD', firstOrderDate: '' });
    vi.mocked(getCustomerTasks).mockResolvedValue([]);
    vi.mocked(getCustomerRelationships).mockResolvedValue([]);
  });

  it('loads the profile source and exposes it via getCustomer', async () => {
    vi.mocked(getCustomerProfile).mockResolvedValue(stubProfile('CUST_1'));

    const store = useCustomerStore() as any;
    await store.setCurrentCustomer('CUST_1');

    expect(store.getCustomer('CUST_1')?.id).toBe('CUST_1');
    expect(store.sectionStatus('CUST_1', 'profile')).toBe('loaded');
  });

  it('isolates a profile failure to the profile source', async () => {
    vi.mocked(getCustomerProfile).mockRejectedValue(new Error('boom'));

    const store = useCustomerStore() as any;
    await store.loadCustomerProfile('CUST_2');

    expect(store.sectionStatus('CUST_2', 'profile')).toBe('error');
    expect(store.sectionError('CUST_2', 'profile')).toBe('boom');
    expect(store.getCustomer('CUST_2')).toBeNull();
  });

  it('folds Solr order aggregates into the lifetime getters', async () => {
    vi.mocked(getCustomerProfile).mockResolvedValue(stubProfile('CUST_3'));
    vi.mocked(getCustomerOrdersFromSolr).mockResolvedValue({ orders: [], lifetimeOrders: 4, lifetimeValue: 250.5, currencyUom: 'USD', firstOrderDate: '' });

    const store = useCustomerStore() as any;
    await store.setCurrentCustomer('CUST_3');

    expect(store.lifetimeOrders('CUST_3')).toBe(4);
    expect(store.lifetimeValue('CUST_3')).toBe(250.5);
  });

  it('derives personal relationships from the relationships source', async () => {
    vi.mocked(getCustomerProfile).mockResolvedValue(stubProfile('CUST_4'));
    vi.mocked(getCustomerRelationships).mockResolvedValue([
      {
        partyIdFrom: 'CUST_4', partyIdTo: 'CUST_9',
        roleTypeIdFrom: 'CUSTOMER', roleTypeIdTo: 'CUSTOMER',
        fromDate: '2026-01-01 00:00:00.000',
        partyRelationshipTypeId: 'SIBLING', relationshipName: 'Sibling',
        fromPartyName: 'A', toPartyName: 'Sibling Person'
      }
    ]);

    const store = useCustomerStore() as any;
    await store.setCurrentCustomer('CUST_4');

    const personal = store.personalRelationships('CUST_4');
    expect(personal).toHaveLength(1);
    expect(personal[0].relatedPartyName).toBe('Sibling Person');
    expect(personal[0].relationshipName).toBe('Sibling');
  });
});

function stubProfile(id: string): CustomerProfile {
  return {
    id,
    name: 'Test Customer',
    partyTypeId: 'PERSON',
    statusId: 'PARTY_ENABLED',
    createdStamp: '',
    lastUpdatedStamp: '',
    lifetimeOrders: 0,
    lifetimeValue: 0,
    roles: [],
    identifications: [],
    contactMechs: [],
    createdByUserLogin: '',
    relationshipsFrom: [],
    relationshipsTo: []
  };
}
