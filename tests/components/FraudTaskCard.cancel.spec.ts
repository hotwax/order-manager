import { flushPromises, shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';

const mocks = vi.hoisted(() => ({
  cancelOrder: vi.fn(),
  changeTaskStatus: vi.fn(),
  createAlert: vi.fn(),
  presentAlert: vi.fn(),
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };

  return {
    IonIcon: component,
    IonItem: component,
    IonLabel: component,
    IonList: component,
    IonListHeader: component,
    IonNote: component,
    IonText: component,
    IonThumbnail: component,
    alertController: { create: mocks.createAlert },
  };
});

vi.mock('@common', () => ({
  commonUtil: {
    formatPhoneNumber: () => '',
    getProductIdentificationValue: () => '',
  },
  DxpShopifyImg: { template: '<img />' },
  translate: (value: string) => value,
}));

vi.mock('@/utils', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/store/orderTask', () => ({
  useOrderTaskStore: () => ({
    cancelOrder: mocks.cancelOrder,
    changeTaskStatus: mocks.changeTaskStatus,
  }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    enumDescription: (value: string) => value,
    paymentMethodDescription: (value: string) => value,
    statusDescription: (value: string) => value,
  }),
}));

vi.mock('@/store/productCache', () => ({
  useProductCacheStore: () => ({ getProduct: () => ({}) }),
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: () => ({
    getProductIdentificationPref: { primaryId: 'SKU', secondaryId: 'PRODUCT_ID' },
  }),
}));

const task = {
  workEffortId: 'RISK_TASK_1',
  orderId: 'ORDER_1',
  shipGroupSeqId: null,
  items: [
    { orderItemSeqId: '01', shipGroupSeqId: '00001', productId: 'PRODUCT_1' },
    { orderItemSeqId: '02', shipGroupSeqId: '00002', productId: 'PRODUCT_2' },
  ],
  payments: [],
  risks: [],
  customer: {},
};

const expectedItems = [
  { orderItemSeqId: '01', shipGroupSeqId: '00001' },
  { orderItemSeqId: '02', shipGroupSeqId: '00002' },
];

describe('FraudTaskCard multi-ship cancellation', () => {
  beforeEach(() => {
    mocks.cancelOrder.mockReset().mockResolvedValue(undefined);
    mocks.changeTaskStatus.mockReset().mockResolvedValue(undefined);
    mocks.presentAlert.mockReset().mockResolvedValue(undefined);
    mocks.createAlert.mockReset().mockResolvedValue({ present: mocks.presentAlert });
  });

  function mountCard() {
    return shallowMount(FraudTaskCard, {
      props: { task },
      global: {
        directives: { imagePreview: {} },
      },
    });
  }

  it('uses each item ship group in the confirmed cancel payload', async () => {
    const wrapper = mountCard();

    wrapper.findComponent({ name: 'TaskCardShell' }).vm.$emit('action', 'cancel');
    await flushPromises();

    const alertOptions = mocks.createAlert.mock.calls[0][0];
    const confirmButton = alertOptions.buttons.find((button: any) => button.role === 'confirm');
    await confirmButton.handler();

    expect(mocks.cancelOrder).toHaveBeenCalledWith('ORDER_1', expectedItems);
    expect(mocks.changeTaskStatus).toHaveBeenCalledWith('RISK_TASK_1', 'TASK_CANCELLED');
  });

  it('uses each item ship group in the bulk cancel payload', async () => {
    const wrapper = mountCard();

    await (wrapper.vm as any).submitCancel();

    expect(mocks.cancelOrder).toHaveBeenCalledWith('ORDER_1', expectedItems);
    expect(mocks.changeTaskStatus).toHaveBeenCalledWith('RISK_TASK_1', 'TASK_CANCELLED');
  });
});
