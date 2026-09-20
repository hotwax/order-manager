import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useOrderDetailStore } from '@/store/orderDetail';

const orderDetailApi = vi.hoisted(() => ({
  getOrder: vi.fn()
}));

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: () => false
  },
  cookieHelper: () => ({
    get: () => ''
  }),
  translate: (key: string) => key,
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('@/composables/useOrderDetail', () => ({
  useOrderDetail: () => orderDetailApi
}));

vi.mock('@/services/productDb', () => ({
  getProductDb: () => ({
    products: {
      bulkPut: vi.fn(),
      toArray: vi.fn()
    }
  })
}));

describe('order detail store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    orderDetailApi.getOrder.mockReset();
    vi.mocked(api).mockReset();
  });

  it('groups item-scoped tax adjustments by comment in order totals', () => {
    const store = useOrderDetailStore();
    store.currentOrderId = 'M100821';
    store.byOrderId.M100821 = {
      payload: {
        orderId: 'M100821',
        grandTotal: 63.98,
        adjustments: [
          taxAdjustment('M100510', '01', 'Salt Lake County Tax', 1.53),
          taxAdjustment('M100511', '01', 'Salt Lake City City Tax', 0.59),
          taxAdjustment('M100512', '01', 'Utah State Tax', 2.86)
        ],
        shipGroups: [{
          items: [{
            orderItemSeqId: '01',
            externalId: '15617773142165',
            unitPrice: 59,
            quantity: 1,
            adjustments: [
              taxAdjustment('M100510', '', 'Salt Lake County Tax', 1.53),
              taxAdjustment('M100511', '', 'Salt Lake City City Tax', 0.59),
              taxAdjustment('M100512', '', 'Utah State Tax', 2.86)
            ]
          }]
        }]
      },
      status: 'loaded',
      loadedAt: '',
      error: ''
    };

    expect(store.totals).toEqual({
      subtotal: 59,
      adjustments: {
        'Salt Lake County Tax': 1.53,
        'Salt Lake City City Tax': 0.59,
        'Utah State Tax': 2.86
      },
      total: 63.98,
      includedAdjustments: {}
    });
    expect(store.adjustmentsByExternalId['15617773142165']).toEqual([
      { label: 'Salt Lake County Tax', amount: 1.53, isIncluded: false },
      { label: 'Salt Lake City City Tax', amount: 0.59, isIncluded: false },
      { label: 'Utah State Tax', amount: 2.86, isIncluded: false }
    ]);
  });

  it('falls back to adjustment type labels and sums repeated comments', () => {
    const store = useOrderDetailStore();
    store.currentOrderId = 'M100822';
    store.byOrderId.M100822 = {
      payload: {
        orderId: 'M100822',
        adjustments: [
          taxAdjustment('A1', '01', 'Utah State Tax', 2.86),
          taxAdjustment('A2', '02', 'Utah State Tax', 0.14),
          { orderAdjustmentId: 'A3', orderAdjustmentTypeId: 'SHIPPING_CHARGES', amount: 5 }
        ],
        shipGroups: [{
          items: [
            { orderItemSeqId: '01', externalId: 'ITEM_1', unitPrice: 59, quantity: 1 },
            { orderItemSeqId: '02', externalId: 'ITEM_2', unitPrice: 10, quantity: 1 }
          ]
        }]
      },
      status: 'loaded',
      loadedAt: '',
      error: ''
    };

    expect(store.totals).toEqual({
      subtotal: 69,
      adjustments: {
        'Utah State Tax': 3,
        SHIPPING_CHARGES: 5
      },
      total: 77,
      includedAdjustments: {}
    });
  });

  it('tracks included tax adjustments without adding them to order total', () => {
    const store = useOrderDetailStore();
    store.currentOrderId = 'M100823';
    store.byOrderId.M100823 = {
      payload: {
        orderId: 'M100823',
        grandTotal: 59,
        adjustments: [
          {
            orderAdjustmentId: 'M100510',
            orderAdjustmentTypeId: 'SALES_TAX',
            orderItemSeqId: '01',
            comments: 'State Tax',
            amount: 0,
            amountAlreadyIncluded: 4.5
          }
        ],
        shipGroups: [{
          items: [{
            orderItemSeqId: '01',
            externalId: '15617773142165',
            unitPrice: 59,
            quantity: 1,
            adjustments: [
              {
                orderAdjustmentId: 'M100510',
                orderAdjustmentTypeId: 'SALES_TAX',
                comments: 'State Tax',
                amount: 0,
                amountAlreadyIncluded: 4.5
              }
            ]
          }]
        }]
      },
      status: 'loaded',
      loadedAt: '',
      error: ''
    };

    expect(store.totals).toEqual({
      subtotal: 59,
      adjustments: {},
      total: 59,
      includedAdjustments: {
        'State Tax': 4.5
      }
    });
    expect(store.adjustmentsByExternalId['15617773142165']).toEqual([
      { label: 'State Tax', amount: 4.5, isIncluded: true }
    ]);
  });

  it('keeps an included and an ordinary adjustment sharing a label in separate rows', () => {
    const store = useOrderDetailStore();
    store.currentOrderId = 'M100824';
    store.byOrderId.M100824 = {
      payload: {
        orderId: 'M100824',
        grandTotal: 121,
        adjustments: [],
        shipGroups: [{
          items: [
            {
              orderItemSeqId: '01',
              externalId: 'EXT_INCLUDED',
              unitPrice: 59,
              quantity: 1,
              adjustments: [{
                orderAdjustmentId: 'M100510',
                orderAdjustmentTypeId: 'SALES_TAX',
                comments: 'State Tax',
                amount: 0,
                amountAlreadyIncluded: 4.5
              }]
            },
            {
              orderItemSeqId: '02',
              externalId: 'EXT_ORDINARY',
              unitPrice: 59,
              quantity: 1,
              adjustments: [{
                orderAdjustmentId: 'M100511',
                orderAdjustmentTypeId: 'SALES_TAX',
                comments: 'State Tax',
                amount: 3,
                amountAlreadyIncluded: 0
              }]
            }
          ]
        }]
      },
      status: 'loaded',
      loadedAt: '',
      error: ''
    };

    // The ordinary $3 must stay out of the included bucket: it genuinely adds to the
    // grand total, so labelling it "included" would misstate what the customer paid.
    expect(store.totals).toEqual({
      subtotal: 118,
      adjustments: { 'State Tax': 3 },
      total: 121,
      includedAdjustments: { 'State Tax': 4.5 }
    });

    expect(store.adjustmentsByExternalId.EXT_INCLUDED).toEqual([
      { label: 'State Tax', amount: 4.5, isIncluded: true }
    ]);
    expect(store.adjustmentsByExternalId.EXT_ORDINARY).toEqual([
      { label: 'State Tax', amount: 3, isIncluded: false }
    ]);
  });

  it('bulk cancels open items through each order item-cancel endpoint', async () => {
    const store = useOrderDetailStore();
    orderDetailApi.getOrder.mockResolvedValueOnce({
      data: {
        orderId: 'M104191',
        shipGroups: [{
          shipGroupSeqId: '00001',
          items: [
            { orderItemSeqId: '00001', statusId: 'ITEM_APPROVED' },
            { orderItemSeqId: '00002', statusId: 'ITEM_CANCELLED' },
            { orderItemSeqId: '00003', statusId: 'ITEM_COMPLETED' }
          ]
        }]
      }
    });
    vi.mocked(api).mockResolvedValue({ data: {} });

    await store.bulkCancelOrders(['M104191']);

    expect(orderDetailApi.getOrder).toHaveBeenCalledWith('M104191');
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/M104191/items/cancel',
      method: 'POST',
      data: {
        items: [{
          orderItemSeqId: '00001',
          shipGroupSeqId: '00001',
          reason: 'NO_VARIANCE_LOG',
          comment: ''
        }]
      }
    });
  });

  it('creates a bulk hold for every ship group on each selected order', async () => {
    const store = useOrderDetailStore();
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [
          { shipGroupSeqId: '00001' },
          { shipGroupSeqId: '00002' }
        ]
      })
      .mockResolvedValueOnce({ data: [{ shipGroupSeqId: '00003' }] })
      .mockResolvedValueOnce({ data: {} });

    await store.bulkCreateOrderTasks(['ORDER_1', 'ORDER_2'], {
      workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
      workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
      workEffortName: 'Manual review',
      description: 'Review before fulfillment'
    });

    expect(api).toHaveBeenNthCalledWith(3, {
      url: 'oms/orders/tasks',
      method: 'POST',
      data: [
        {
          orderId: 'ORDER_1',
          shipGroupSeqId: '00001',
          workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
          workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
          workEffortName: 'Manual review',
          description: 'Review before fulfillment',
          statusId: 'TASK_CREATED'
        },
        {
          orderId: 'ORDER_1',
          shipGroupSeqId: '00002',
          workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
          workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
          workEffortName: 'Manual review',
          description: 'Review before fulfillment',
          statusId: 'TASK_CREATED'
        },
        {
          orderId: 'ORDER_2',
          shipGroupSeqId: '00003',
          workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
          workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
          workEffortName: 'Manual review',
          description: 'Review before fulfillment',
          statusId: 'TASK_CREATED'
        }
      ]
    });
  });

  it('builds an enriched order domain model with precomputed ship groups, items, and action capabilities', () => {
    const store = useOrderDetailStore();
    store.byOrderId.M100821 = {
      payload: {
        orderId: 'M100821',
        orderName: 'Order #100821',
        statusId: 'ORDER_APPROVED',
        currencyUom: 'USD',
        grandTotal: 63.98,
        shipGroups: [{
          shipGroupSeqId: '00001',
          facilityId: 'BROADWAY',
          items: [{
            orderItemSeqId: '01',
            productId: 'P1001',
            externalId: '15617773142165',
            unitPrice: 59,
            quantity: 1,
            statusId: 'ITEM_APPROVED',
          }]
        }]
      },
      status: 'loaded',
      loadedAt: '',
      error: ''
    };

    const enriched = store.enrichedOrderByOrderId('M100821');
    expect(enriched).toBeTruthy();
    expect(enriched?.id).toBe('M100821');
    expect(enriched?.orderName).toBe('Order #100821');
    expect(enriched?.shipGroups).toHaveLength(1);
    expect(enriched?.shipGroups[0].id).toBe('00001');
    expect(enriched?.shipGroups[0].headerTitle).toContain('00001');
    expect(enriched?.shipGroups[0].items).toHaveLength(1);
    expect(enriched?.shipGroups[0].items[0].id).toBe('01');
    expect(enriched?.shipGroups[0].items[0].actions).toHaveProperty('canCancel');
    expect(enriched?.shipGroups[0].items[0].actions).toHaveProperty('canTransfer');
    expect(enriched?.totals.total).toBe(59);
  });
});

function taxAdjustment(orderAdjustmentId: string, orderItemSeqId: string, comments: string, amount: number) {
  return {
    orderAdjustmentId,
    orderItemSeqId,
    shipGroupSeqId: '_NA_',
    orderAdjustmentTypeId: 'SALES_TAX',
    comments,
    amount
  };
}
