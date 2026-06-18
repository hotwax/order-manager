import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useOrderDetailStore } from '@/store/orderDetail';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: () => false
  },
  cookieHelper: () => ({
    get: () => ''
  }),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn()
  }
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
      total: 63.98
    });
    expect(store.adjustmentsByExternalId['15617773142165']).toEqual({
      'Salt Lake County Tax': 1.53,
      'Salt Lake City City Tax': 0.59,
      'Utah State Tax': 2.86
    });
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
      total: 77
    });
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
