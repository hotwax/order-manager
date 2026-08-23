import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import {
  getCustomer,
  getCustomerOrders,
  getCustomerTasks,
  searchCustomers
} from '@/services/customer';

const { runSolrQuery } = vi.hoisted(() => ({
  runSolrQuery: vi.fn(),
}));

vi.mock('@common/composables/useSolrSearch', () => ({
  useSolrSearch: () => ({ runSolrQuery }),
}));

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

import { useAuth } from '@common/composables/useAuth';

describe('customer service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    runSolrQuery.mockReset();
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

  it('searches customers through Solr and normalizes totals', async () => {
    runSolrQuery.mockResolvedValue({
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

    expect(runSolrQuery).toHaveBeenCalledWith(expect.objectContaining({
      json: expect.objectContaining({ query: '*Swati Pandey* OR "Swati Pandey"^100' }),
    }));
    expect(result).toMatchObject({
      total: 1,
      customers: [expect.objectContaining({ partyId: 'CUST_1' })],
    });
  });

  it('resolves email searches through Solr search', async () => {
    runSolrQuery.mockResolvedValue({
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

    expect(runSolrQuery).toHaveBeenCalledWith(expect.objectContaining({
      json: expect.objectContaining({ query: '*swati@example.com* OR "swati@example.com"^100' }),
    }));
    expect(result.customers[0]).toMatchObject({ partyId: 'CUST_1' });
  });

  it('passes an explicit customer sort to Solr', async () => {
    runSolrQuery.mockResolvedValue({ data: { response: { numFound: 0, docs: [] } } });

    await searchCustomers({ queryString: 'Swati', sort: 'fullName asc' });

    expect(runSolrQuery).toHaveBeenCalledWith(expect.objectContaining({
      json: expect.objectContaining({
        params: expect.objectContaining({ sort: 'fullName asc' }),
      }),
    }));
  });

  // Without a sort clause Solr ranks by edismax relevance, which is what a keyword search
  // should return; sending an empty sort would instead be a Solr error.
  it('omits the sort clause entirely when no customer sort is selected', async () => {
    runSolrQuery.mockResolvedValue({ data: { response: { numFound: 0, docs: [] } } });

    await searchCustomers({ queryString: 'Swati', sort: '' });

    const payload = runSolrQuery.mock.calls.at(-1)?.[0] as any;
    expect(payload.json.params).not.toHaveProperty('sort');
  });

  it('fetches customer tasks via workEffortPartyAssignments with roleTypeId CUSTOMER', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [{
        workEffortId: 'TASK_101',
        workEffortName: 'Review risk',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'REVIEW_RISK_ORDER',
        taskStatusId: 'TASK_CREATED',
        orderId: 'ORDER_555',
        orderName: 'PO #555',
        orderDate: '2026-08-01',
        grandTotal: 150.00,
        partyId: 'CUST_111483',
        assigneePartyId: 'USER_2',
        assigneeFullName: 'Jane Doe',
        assigneeSince: '2026-08-01T12:00:00Z',
        reporterPartyId: 'USER_1',
        reporterFullName: 'John Smith',
        reporterSince: '2026-08-01T10:00:00Z',
        dueDate: '2026-08-05'
      }]
    });

    const tasks = await getCustomerTasks('CUST_111483', { taskStatusId: 'TASK_CREATED', pageSize: 10, pageIndex: 0 });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/workEffortPartyAssignments',
      method: 'get',
      params: {
        partyId: 'CUST_111483',
        roleTypeId: 'CUSTOMER',
        taskStatusId: 'TASK_CREATED',
        pageSize: 10,
        pageIndex: 0,
        orderByField: undefined
      }
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      workEffortId: 'TASK_101',
      workEffortName: 'Review risk',
      orderId: 'ORDER_555',
      customerPartyId: 'CUST_111483',
      assigneeName: 'Jane Doe',
      reporterName: 'John Smith',
      grandTotal: 150
    });
  });
});
