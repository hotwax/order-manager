import { flushPromises, shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HoldOrders from '@/views/HoldOrders.vue';

const mocks = vi.hoisted(() => ({
  currentQuery: {} as Record<string, string>,
  enterCallbacks: [] as Array<() => void>,
  fetchHoldTasks: vi.fn(),
  loadPhysicalFacilities: vi.fn(),
}));

vi.mock('@common', () => ({
  translate: (value: string) => value,
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };

  return {
    IonButtons: component,
    IonContent: component,
    IonFooter: component,
    IonHeader: component,
    IonMenuButton: component,
    IonPage: component,
    IonTitle: component,
    IonToolbar: component,
    IonButton: component,
    IonProgressBar: component,
    IonSpinner: component,
    IonInfiniteScroll: component,
    IonInfiniteScrollContent: component,
    alertController: { create: vi.fn() },
    onIonViewWillEnter: (callback: () => void) => mocks.enterCallbacks.push(callback),
  };
});

vi.mock('@/router', () => ({
  default: {
    currentRoute: {
      get value() {
        return { query: mocks.currentQuery };
      },
    },
    push: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock('@/store/orderTask', () => ({
  useOrderTaskStore: () => ({
    getHoldTasks: [],
    getHoldTotal: 0,
    isHoldTasksScrollable: false,
    getHoldStatus: 'success',
    getHoldError: '',
    fetchHoldTasks: mocks.fetchHoldTasks,
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => ({ hasPermission: () => true }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    getEnumsByType: () => [],
    getShipmentMethodOptions: [],
  }),
}));

vi.mock('@/composables/useOrderTaskRouteState', () => ({
  useOrderTaskRouteState: vi.fn(),
}));

vi.mock('@/composables/usePhysicalFacilityOptions', () => ({
  usePhysicalFacilityOptions: () => ({
    facilityOptions: [],
    loadPhysicalFacilities: mocks.loadPhysicalFacilities,
  }),
}));

vi.mock('@/utils', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/authorization/permissions', () => ({
  ORDER_TASK_CREATE_PERMISSION: 'ORDER_TASK_CREATE',
}));

describe('HoldOrders purpose route', () => {
  beforeEach(() => {
    mocks.currentQuery = {};
    mocks.enterCallbacks.length = 0;
    mocks.fetchHoldTasks.mockReset().mockResolvedValue(undefined);
    mocks.loadPhysicalFacilities.mockReset();
  });

  async function enterPage() {
    const wrapper = shallowMount(HoldOrders);
    expect(mocks.enterCallbacks).toHaveLength(1);
    mocks.enterCallbacks[0]();
    await flushPromises();
    return wrapper;
  }

  it('passes an exact purpose from the Hold route to the task store', async () => {
    mocks.currentQuery = { purpose: 'FUTURE_HOLD' };

    const wrapper = await enterPage();

    expect(mocks.fetchHoldTasks).toHaveBeenCalledOnce();
    expect(mocks.fetchHoldTasks).toHaveBeenCalledWith(expect.any(Object), 'FUTURE_HOLD');
    wrapper.unmount();
  });

  it('keeps the store default when the Hold route has no purpose', async () => {
    const wrapper = await enterPage();

    expect(mocks.fetchHoldTasks).toHaveBeenCalledOnce();
    expect(mocks.fetchHoldTasks).toHaveBeenCalledWith(expect.any(Object), undefined);
    wrapper.unmount();
  });
});
