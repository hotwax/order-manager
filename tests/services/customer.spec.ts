import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  buildCustomerSearchRequests,
  getCustomer,
  getCustomerContactMechs,
  getCustomerOrders,
  searchCustomers
} from '@/services/customer';

vi.mock('@common/core/remoteApi', () => {
  const fn = vi.fn();
  return {
    default: fn,
    client: fn,
    axios: fn,
  };
});

vi.mock('@common', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const remoteApi = await import('@common/core/remoteApi');
  return {
    ...actual,
    api: (remoteApi as any).default,
  };
});

import { cookieHelper } from '@common';
import { useAuth } from '@common/composables/useAuth';

describe('customer service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    useAuth().updateToken("test-token");
  });

  it('fetches a customer profile from the party endpoint', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        partyId: 'CUST_1',
        partyTypeId: 'PERSON',
        statusId: 'PARTY_ENABLED',
        personalTitle: 'Ms.',
        firstName: 'Swati',
        lastName: 'Pandey',
        createdStamp: '2026-05-20T10:00:00',
        lastUpdatedStamp: '2026-05-22T10:00:00',
      },
    });

    const customer = await getCustomer('CUST_1');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/parties/CUST_1',
      method: 'get',
    });
    expect(customer).toMatchObject({
      id: 'CUST_1',
      name: 'Swati Pandey',
      personalTitle: 'Ms.',
      partyTypeId: 'PERSON',
      statusId: 'PARTY_ENABLED',
      createdStamp: '2026-05-20T10:00:00',
      lastUpdatedStamp: '2026-05-22T10:00:00',
    });
  });

  it('fetches a customer profile and merges createdStamp from the lookup DataDocument', async () => {
    vi.mocked(api).mockImplementation(async (config: any) => {
      if (config.url === 'oms/parties/CUST_1') {
        return {
          data: {
            partyId: 'CUST_1',
            partyTypeId: 'PERSON',
            statusId: 'PARTY_ENABLED',
            firstName: 'Swati',
            lastName: 'Pandey',
          }
        };
      }
      if (config.url === 'oms/dataDocumentView' && config.data?.dataDocumentId === 'OrderManagerCustomerLookup') {
        return {
          data: {
            entityValueList: [{
              partyId: 'CUST_1',
              createdStamp: 1779343184614,
              lastUpdatedStamp: 1779443184614
            }]
          }
        };
      }
      return { data: {} };
    });

    const customer = await getCustomer('CUST_1');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/parties/CUST_1',
      method: 'get',
    });
    expect(api).toHaveBeenCalledWith({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: expect.objectContaining({
        dataDocumentId: 'OrderManagerCustomerLookup',
        customParametersMap: {
          partyId: 'CUST_1',
          partyid: 'CUST_1'
        }
      })
    });
    expect(customer.createdStamp).toBe('1779343184614');
    expect(customer.lastUpdatedStamp).toBe('1779443184614');
  });


  it('fetches and groups customer contact mechs from the contact DataDocument', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        entityValueList: [
          {
            contactMechId: 'EMAIL1',
            contactMechTypeId: 'EMAIL_ADDRESS',
            contactMechPurposeTypeId: 'PRIMARY_EMAIL',
            infoString: 'swati@example.com',
          },
          {
            contactMechId: 'PHONE1',
            contactMechTypeId: 'TELECOM_NUMBER',
            contactMechPurposeTypeId: 'PHONE_MOBILE',
            countryCode: '1',
            areaCode: '415',
            contactNumber: '5550100',
          },
          {
            contactMechId: 'ADDR1',
            contactMechTypeId: 'POSTAL_ADDRESS',
            contactMechPurposeTypeId: 'SHIPPING_LOCATION',
            address1: '100 Market St',
            city: 'San Francisco',
            stateProvinceGeoId: 'CA',
            postalCode: '94105',
            countryGeoId: 'USA',
          },
        ],
      },
    });

    const result = await getCustomerContactMechs('CUST_1');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/dataDocumentView',
      method: 'post',
        data: expect.objectContaining({
          dataDocumentId: 'OrderManagerCustomerContactLookup',
        customParametersMap: { partyid: 'CUST_1' },
      }),
    });
    expect(vi.mocked(api).mock.calls[0][0].data.fieldsToSelect).toBeUndefined();
    expect(result.emails[0]).toMatchObject({ infoString: 'swati@example.com' });
    expect(result.phones[0]).toMatchObject({ infoString: '+1 415 5550100' });
    expect(result.postalAddresses[0].postalAddress).toMatchObject({
      address1: '100 Market St',
      city: 'San Francisco',
    });
  });

  it('normalizes lowercase customer contact aliases returned by Moqui DataDocuments', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        entityValueList: [
          {
            contactmechid: 'PHONE1',
            contactmechtypeid: 'TELECOM_NUMBER',
            contactmechpurposetypeid: 'PRIMARY_PHONE',
            countrycode: '1',
            areacode: '415',
            contactnumber: '5550100',
          },
          {
            contactmechid: 'ADDR1',
            contactmechtypeid: 'POSTAL_ADDRESS',
            contactmechpurposetypeid: 'SHIPPING_LOCATION',
            address1: '100 Market St',
            city: 'San Francisco',
            stateprovincegeoid: 'CA',
            postalcode: '94105',
            countrygeoid: 'USA',
          },
        ],
      },
    });

    const result = await getCustomerContactMechs('CUST_1');

    expect(result.phones[0]).toMatchObject({
      contactMechId: 'PHONE1',
      contactMechPurposeTypeId: 'PRIMARY_PHONE',
      infoString: '+1 415 5550100',
    });
    expect(result.postalAddresses[0].postalAddress).toMatchObject({
      address1: '100 Market St',
      stateProvinceGeoId: 'CA',
      postalCode: '94105',
      countryGeoId: 'USA',
    });
  });

  it('fetches recent customer orders using OrderManagerOrderRoleLookup and OrderManagerOrderLookup', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: {
          count: 1,
          entityValueList: [{
            orderId: 'M100051',
            partyId: 'CUST_1',
            roleTypeId: 'PLACING_CUSTOMER',
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          entityValueList: [{
            hcOrderId: 'M100051',
            orderName: '#1004',
            statusId: 'ORDER_APPROVED',
            orderDate: '2026-05-22T10:00:00',
          }],
        },
      });

    const result = await getCustomerOrders('CUST_1', { pageSize: 10, pageIndex: 0 });

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/dataDocumentView',
      method: 'post',
      data: {
        dataDocumentId: 'OrderManagerOrderRoleLookup',
        format: 'json',
        customParametersMap: {
          partyId: 'CUST_1',
          partyid: 'CUST_1',
          roleTypeId: 'PLACING_CUSTOMER',
          roletypeid: 'PLACING_CUSTOMER'
        },
        pageSize: 10,
        pageIndex: 0,
      },
    });

    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/dataDocumentView',
      method: 'post',
      data: {
        dataDocumentId: 'OrderManagerOrderLookup',
        format: 'json',
        fieldsToSelect: expect.any(Array),
        customParametersMap: {
          hcOrderId: 'M100051',
        },
        pageSize: 1,
        pageIndex: 0,
      },
    });

    expect(result.orders[0]).toMatchObject({
      id: 'M100051',
      externalId: '#1004',
    });
  });

  it('routes party id customer searches to an exact oms parties lookup', () => {
    expect(buildCustomerSearchRequests({ queryString: '10001', status: 'PARTY_ENABLED' })).toEqual([{
      partyId: '10001',
      statusId: 'PARTY_ENABLED',
      dependentLevels: 1,
      pageSize: 50,
      pageIndex: 0,
    }]);
  });

  it('routes single-token customer searches across person and group names', () => {
    expect(buildCustomerSearchRequests({ queryString: 'Smith', partyTypeId: 'All', pageSize: 25, pageIndex: 2 })).toEqual([
      {
        partyTypeId: 'PERSON',
        lastName_op: 'contains',
        lastName: 'Smith',
        dependentLevels: 1,
        pageSize: 25,
        pageIndex: 2,
      },
      {
        partyTypeId: 'PARTY_GROUP',
        groupName_op: 'contains',
        groupName: 'Smith',
        dependentLevels: 1,
        pageSize: 25,
        pageIndex: 2,
      },
    ]);
  });

  it('routes two-token customer searches to first and last name contains filters', () => {
    expect(buildCustomerSearchRequests({ queryString: 'Swati Pandey', status: 'PARTY_ENABLED' })).toEqual([{
      partyTypeId: 'PERSON',
      firstName_op: 'contains',
      firstName: 'Swati',
      lastName_op: 'contains',
      lastName: 'Pandey',
      statusId: 'PARTY_ENABLED',
      dependentLevels: 1,
      pageSize: 50,
      pageIndex: 0,
    }]);
  });

  it('searches customers through Solr and normalizes totals', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        response: {
          numFound: 1,
          docs: [{
            partyId: 'CUST_1',
            firstName: 'Swati',
            lastName: 'Pandey',
            statusId: 'PARTY_ENABLED',
          }],
        },
      },
    });

    const result = await searchCustomers({ queryString: 'Swati Pandey' });

    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      url: 'admin/search/query',
      method: 'post',
    }));
    expect(result).toMatchObject({
      total: 1,
      customers: [expect.objectContaining({ partyId: 'CUST_1' })],
    });
  });

  it('resolves email searches through Solr search', async () => {
    vi.mocked(api).mockResolvedValue({
      data: {
        response: {
          numFound: 1,
          docs: [{
            partyId: 'CUST_1',
            firstName: 'Swati',
            lastName: 'Pandey',
            emailAddress: 'swati@example.com',
          }],
        },
      },
    });

    const result = await searchCustomers({ queryString: 'swati@example.com' });

    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      url: 'admin/search/query',
      method: 'post',
    }));
    expect(result.customers[0]).toMatchObject({ partyId: 'CUST_1' });
  });

  it('passes an explicit customer sort to Solr', async () => {
    vi.mocked(api).mockResolvedValue({ data: { response: { numFound: 0, docs: [] } } });

    await searchCustomers({ queryString: 'Swati', sort: 'fullName asc' });

    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        params: expect.objectContaining({ sort: 'fullName asc' }),
      }),
    }));
  });

  // Without a sort clause Solr ranks by edismax relevance, which is what a keyword search
  // should return; sending an empty sort would instead be a Solr error.
  it('omits the sort clause entirely when no customer sort is selected', async () => {
    vi.mocked(api).mockResolvedValue({ data: { response: { numFound: 0, docs: [] } } });

    await searchCustomers({ queryString: 'Swati', sort: '' });

    const payload = vi.mocked(api).mock.calls.at(-1)?.[0] as any;
    expect(payload.data.params).not.toHaveProperty('sort');
  });
});
