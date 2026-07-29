import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import Funnel from '@/views/Funnel.vue';

const mocks = vi.hoisted(() => {
  const noop = vi.fn();

  return {
    customerServiceStore: {
      isDashboardGroupLoading: () => false,
      isDashboardGroupError: () => false,
      getFulfillmentProgress: {
        totalOrdersCount: 8,
        totalShipGroupsCount: 10,
        brokeredShipGroupsCount: 8,
        pickedShipGroupsCount: 2,
        packedShipGroupsCount: 1,
        shippedShipGroupsCount: 1,
      },
      getHoldTasks: { holdTasksTotalCount: 0, holdTaskCounts: [] },
      getFacilityFulfillmentProgress: null,
      getFacilityOrderVolume: [{
        facilityId: 'FACILITY_1',
        facilityName: 'Outlet One',
        lastOrderCount: 7,
      }],
      getFacilityFulfillmentVelocity: [{
        facilityId: 'FACILITY_1',
        facilityName: 'Outlet One',
        fulfillmentVelocity: 0.5,
        shipGroupCount: 5,
        lastOrderCount: 10,
      }],
      getFacilityRejections: [{
        facilityId: 'FACILITY_1',
        facilityName: 'Outlet One',
        lastOrderCount: 7,
        rejectedShipGroupCount: 2,
      }],
      getUnfillable: { totalCount: 0 },
      getVirtualLocationCounts: [],
      getFulfillmentSyncData: null,
      unfillableTrend: [],
      fetchFulfillmentProgress: noop,
      fetchUnfillable: noop,
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
      setNavCount: noop,
    },
  };
});

vi.mock('@ionic/vue', () => {
  const component = { template: '<div><slot /></div>' };
  const progressBar = {
    name: 'IonProgressBar',
    inheritAttrs: false,
    props: {
      value: Number,
      color: String,
    },
    template: '<div role="progressbar" v-bind="$attrs" :aria-valuenow="value"></div>',
  };

  return {
    IonButton: component,
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
    IonProgressBar: progressBar,
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
  translate: (value: string) => `translated:${value}`,
  StatCard: { template: '<div><slot /><slot name="stat" /></div>' },
  Sparkline: { template: '<div />' },
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
      productStoreId: 'STORE',
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
  useUserStore: () => ({}),
}));

vi.mock('@/services/order', () => ({
  fetchWorkflowOrderTotals: vi.fn().mockResolvedValue({ open: 0, inflight: 0, packed: 0 }),
}));

describe('Funnel progress bar accessibility', () => {
  it('renders distinct translated global names without replacing native progress values', () => {
    const wrapper = mount(Funnel);
    const progressBars = wrapper.findAll('[role="progressbar"]');

    expect(progressBars.map((bar) => bar.attributes('aria-label'))).toEqual([
      'translated:Assigned to fulfillment',
      'translated:In flight',
      'translated:Packed and shipped',
      'Outlet One: translated:Order Volume',
    ]);
    expect(progressBars.map((bar) => Number(bar.attributes('aria-valuenow')))).toEqual([
      0.8,
      0.4,
      0.2,
      1,
    ]);
  });

  it('names the facility bar from its facility and translated active metric', async () => {
    const wrapper = mount(Funnel);
    const facilityProgressBar = () => wrapper.findAll('[role="progressbar"]').at(-1)!;

    expect(facilityProgressBar().attributes('aria-label')).toBe('Outlet One: translated:Order Volume');

    (wrapper.vm as any).selectedDimension = 'velocity';
    await nextTick();
    expect(facilityProgressBar().attributes('aria-label')).toBe('Outlet One: translated:Fulfillment Velocity');

    (wrapper.vm as any).selectedDimension = 'rejections';
    await nextTick();
    expect(facilityProgressBar().attributes('aria-label')).toBe('Outlet One: translated:Rejections');
    expect(Number(facilityProgressBar().attributes('aria-valuenow'))).toBe(1);
  });
});
