import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Funnel from '@/views/Funnel.vue';

const mocks = vi.hoisted(() => {
  const noop = vi.fn();

  return {
    fetchWorkflowOrderTotals: vi.fn(),
    setNavCount: vi.fn(),
    router: {
      resolve: vi.fn((route: string | { path: string }) => ({
        href: typeof route === 'string' ? route : route.path
      })),
      push: vi.fn()
    },
    customerServiceStore: {
      isDashboardGroupLoading: () => false,
      isDashboardGroupError: () => false,
      getFulfillmentProgress: {
        totalOrdersCount: 0,
        totalShipGroupsCount: 0,
        brokeredShipGroupsCount: 0,
        pickedShipGroupsCount: 0,
        packedShipGroupsCount: 0,
        shippedShipGroupsCount: 0,
      },
      getHoldTasks: { holdTasksTotalCount: 0, holdTaskCounts: [] },
      getFacilityFulfillmentProgress: null,
      getFacilityOrderVolume: [],
      getFacilityFulfillmentVelocity: [],
      getFacilityRejections: [],
      getUnfillable: { totalCount: 0, unfillableHourlyCounts: [] },
      getVirtualLocationCounts: [],
      getFulfillmentSyncData: null,
      unfillableTrend: [],
      fetchFulfillmentProgress: noop,
      fetchUnfillable: noop,
      fetchUnfillableBacklog: noop,
      fetchUnfillableTrend: noop,
      fetchVirtualLocationCounts: noop,
      fetchFacilityOrderVolume: noop,
      fetchFacilityFulfillmentVelocity: noop,
      fetchFacilityRejections: noop,
      fetchHoldTasks: noop,
      fetchFacilityFulfillmentProgress: noop,
      fetchFulfillmentSyncData: noop,
      updateSortRulesOrder: noop,
      addSortRule: noop,
      removeSortRule: noop,
      updateServiceJob: noop,
      updateBatchSize: noop,
    },
    orderStore: {
      navCounts: {},
      primeNavCounts: noop,
      setNavCount: vi.fn(),
      clearNavCounts: vi.fn(),
    },
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  const button = { template: '<button type="button"><slot /></button>' };

  return {
    IonButton: button,
    IonCard: component,
    IonCardContent: component,
    IonCardHeader: component,
    IonCardSubtitle: component,
    IonCardTitle: component,
    IonContent: component,
    IonHeader: component,
    IonIcon: component,
    IonItem: component,
    IonLabel: component,
    IonList: component,
    IonListHeader: component,
    IonPage: component,
    IonTitle: component,
    IonToolbar: component,
    IonButtons: component,
    IonMenuButton: component,
    IonProgressBar: component,
    IonSearchbar: component,
    IonSegment: component,
    IonSegmentButton: component,
    IonRadioGroup: component,
    IonRadio: component,
    IonNote: component,
    IonReorderGroup: component,
    IonReorder: component,
    IonInput: component,
    IonItemDivider: component,
    IonPopover: component,
    IonModal: component,
    IonFab: component,
    IonFabButton: component,
    IonToggle: component,
    IonSpinner: component,
    onIonViewWillEnter: vi.fn(),
  };
});

vi.mock('@common', () => ({
  translate: (value: string) => value,
  StatCard: {
    name: 'StatCard',
    props: {
      button: Boolean,
      title: String,
      stat: [String, Number]
    },
    template: '<section><span class="title">{{ title }}</span><span class="stat">{{ stat }}</span><slot /><slot name="stat" /></section>'
  },
  Sparkline: {
    name: 'Sparkline',
    props: {
      points: Array,
      color: String,
      ariaLabel: String,
    },
    template: '<div />'
  },
  commonUtil: {
    getRelativeTime: () => '',
    getCronString: () => '',
    getNextExecutionTime: () => '',
    showToast: vi.fn(),
  },
}));

vi.mock('@/store/customerService', () => ({
  useCustomerServiceStore: () => mocks.customerServiceStore,
}));

vi.mock('@/store/order', () => ({
  useOrderStore: () => mocks.orderStore,
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: () => ({
    getCurrentProductStore: {
      productStoreId: 'STORE_1',
      storeName: 'Demo Store',
    },
  }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    shipmentMethodTypes: { byId: {} },
    facilityName: (facilityId: string) => facilityId,
    getEnumsByType: () => [],
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    getUserTimeZone: 'UTC',
    getUserProfile: { userTimeZone: 'UTC' },
  }),
}));

vi.mock('@/services/order', () => ({
  fetchWorkflowOrderTotals: mocks.fetchWorkflowOrderTotals,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Funnel Brokered workload request scope', () => {
  beforeEach(() => {
    mocks.fetchWorkflowOrderTotals.mockReset();
    mocks.orderStore.setNavCount.mockReset();
    mocks.orderStore.clearNavCounts.mockReset();
  });

  it('keeps the newer store workload and publishes only its navigation totals', async () => {
    const storeA = deferred<{ open: number; inflight: number; packed: number }>();
    const storeB = deferred<{ open: number; inflight: number; packed: number }>();
    mocks.fetchWorkflowOrderTotals
      .mockImplementationOnce(() => storeA.promise)
      .mockImplementationOnce(() => storeB.promise);

    const wrapper = mount(Funnel);
    const storeARequest = (wrapper.vm as any).fetchBrokeredWorkload('STORE_A');
    const storeBRequest = (wrapper.vm as any).fetchBrokeredWorkload('STORE_B');

    storeB.resolve({ open: 4, inflight: 3, packed: 2 });
    await storeBRequest;
    storeA.resolve({ open: 40, inflight: 30, packed: 20 });
    await storeARequest;

    const brokeredCard = wrapper.findAllComponents({ name: 'StatCard' })
      .find((card) => card.props('title') === 'Brokered');
    expect(brokeredCard?.props('stat')).toBe(9);
    expect(mocks.orderStore.setNavCount.mock.calls).toEqual([
      ['open', 4],
      ['inflight', 3],
      ['packed', 2],
    ]);
    expect(mocks.orderStore.clearNavCounts).toHaveBeenCalledTimes(2);
    expect(mocks.orderStore.clearNavCounts).toHaveBeenLastCalledWith(['open', 'inflight', 'packed']);
    expect((wrapper.vm as any).brokeredWorkloadLoading).toBe(false);
    expect((wrapper.vm as any).brokeredWorkloadError).toBe(false);
    wrapper.unmount();
  });

  it('invalidates an in-flight workload when the selected store scope is cleared', async () => {
    const staleRequest = deferred<{ open: number; inflight: number; packed: number }>();
    mocks.fetchWorkflowOrderTotals.mockImplementationOnce(() => staleRequest.promise);

    const wrapper = mount(Funnel);
    const storeARequest = (wrapper.vm as any).fetchBrokeredWorkload('STORE_A');
    (wrapper.vm as any).clearBrokeredWorkload();
    staleRequest.resolve({ open: 40, inflight: 30, packed: 20 });
    await storeARequest;

    const brokeredCard = wrapper.findAllComponents({ name: 'StatCard' })
      .find((card) => card.props('title') === 'Brokered');
    expect(brokeredCard?.props('stat')).toBe(0);
    expect((wrapper.vm as any).brokeredWorkloadLoading).toBe(false);
    expect((wrapper.vm as any).brokeredWorkloadError).toBe(false);
    expect(mocks.orderStore.setNavCount).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not let a stale failure clear loading or mask the current failure', async () => {
    const staleRequest = deferred<{ open: number; inflight: number; packed: number }>();
    const currentRequest = deferred<{ open: number; inflight: number; packed: number }>();
    mocks.fetchWorkflowOrderTotals
      .mockImplementationOnce(() => staleRequest.promise)
      .mockImplementationOnce(() => currentRequest.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const wrapper = mount(Funnel);
    const storeARequest = (wrapper.vm as any).fetchBrokeredWorkload('STORE_A');
    const storeBRequest = (wrapper.vm as any).fetchBrokeredWorkload('STORE_B');

    staleRequest.reject(new Error('stale STORE_A failure'));
    await storeARequest;
    expect((wrapper.vm as any).brokeredWorkloadLoading).toBe(true);
    expect((wrapper.vm as any).brokeredWorkloadError).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();

    const currentError = new Error('current STORE_B failure');
    currentRequest.reject(currentError);
    await storeBRequest;
    expect((wrapper.vm as any).brokeredWorkloadLoading).toBe(false);
    expect((wrapper.vm as any).brokeredWorkloadError).toBe(true);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch brokered workload totals', currentError);
    expect(mocks.orderStore.setNavCount).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    wrapper.unmount();
  });
});
