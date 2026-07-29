import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
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
  const searchbar = {
    name: 'IonSearchbar',
    props: {
      modelValue: String,
      placeholder: String,
    },
    emits: ['update:modelValue'],
    template: `
      <input
        data-testid="facility-search"
        :value="modelValue"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `,
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
    IonSearchbar: searchbar,
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

function mountFunnel() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/unfillable', component: {} },
      { path: '/brokering', component: {} },
      { path: '/open', component: {} },
      { path: '/inflight', component: {} },
      { path: '/packed', component: {} },
      { path: '/swap', component: {} },
      { path: '/bad-address', component: {} },
      { path: '/fraud', component: {} },
      { path: '/hold', component: {} },
    ],
  });

  return mount(Funnel, {
    global: {
      plugins: [router],
    },
  });
}

describe('Funnel progress bar accessibility', () => {
  it('renders and searches an enriched facility name while keeping the today count', async () => {
    const volumeRow = mocks.customerServiceStore.getFacilityOrderVolume[0] as any;
    const originalRow = { ...volumeRow };
    Object.assign(volumeRow, {
      facilityId: 'M100051',
      facilityName: '2301 E. 51st St.',
      lastOrderCount: 151,
    });

    try {
      const wrapper = mountFunnel();
      (wrapper.vm as any).selectedFacilityId = 'M100051';
      await nextTick();

      expect(wrapper.get('.facility-metric-label').text()).toContain('2301 E. 51st St.');
      expect(wrapper.get('.facility-metric-label').text()).toContain('151 translated:orders');
      expect(wrapper.get('.section-title').text()).toBe(
        'translated:Fill rate at 2301 E. 51st St.'
      );

      await wrapper.get('[data-testid="facility-search"]').setValue('51st');

      expect(wrapper.get('.facility-metric-label').text()).toContain('2301 E. 51st St.');
      expect(wrapper.findAll('.facility-metric-label')).toHaveLength(1);
    } finally {
      Object.keys(volumeRow).forEach((key) => delete volumeRow[key]);
      Object.assign(volumeRow, originalRow);
    }
  });

  it('renders the facility ID when neither the metric row nor seed data has a name', async () => {
    const volumeRow = mocks.customerServiceStore.getFacilityOrderVolume[0] as any;
    const originalRow = { ...volumeRow };
    Object.keys(volumeRow).forEach((key) => delete volumeRow[key]);
    Object.assign(volumeRow, {
      facilityId: 'M100051',
      lastOrderCount: 151,
    });

    try {
      const wrapper = mountFunnel();
      (wrapper.vm as any).selectedFacilityId = 'M100051';
      await nextTick();

      expect(wrapper.get('.facility-metric-label').text()).toContain('M100051');
      expect(wrapper.get('.section-title').text()).toBe(
        'translated:Fill rate at M100051'
      );
    } finally {
      Object.keys(volumeRow).forEach((key) => delete volumeRow[key]);
      Object.assign(volumeRow, originalRow);
    }
  });

  it('renders distinct translated global names without replacing native progress values', () => {
    const wrapper = mountFunnel();
    const progressBars = wrapper.findAll('[role="progressbar"]');

    expect(progressBars.map((bar) => bar.attributes('aria-label'))).toEqual([
      'translated:Assigned to fulfillment',
      'translated:In flight',
      'translated:Packed and shipped',
      'Outlet One: 7 translated:orders',
    ]);
    expect(progressBars.map((bar) => Number(bar.attributes('aria-valuenow')))).toEqual([
      0.8,
      0.4,
      0.2,
      1,
    ]);
  });

  it('names the facility bar from its facility and the metric represented by the bar', async () => {
    const wrapper = mountFunnel();
    const facilityProgressBar = () => wrapper.findAll('[role="progressbar"]').at(-1)!;

    expect(facilityProgressBar().attributes('aria-label')).toBe('Outlet One: 7 translated:orders');

    (wrapper.vm as any).selectedDimension = 'velocity';
    await nextTick();
    expect(facilityProgressBar().attributes('aria-label')).toBe(
      'Outlet One: 50% translated:velocity (5/10 translated:orders)'
    );

    (wrapper.vm as any).selectedDimension = 'rejections';
    await nextTick();
    expect(facilityProgressBar().attributes('aria-label')).toBe(
      'Outlet One: 7 translated:active orders, 2 translated:rejected orders'
    );
    expect(Number(facilityProgressBar().attributes('aria-valuenow'))).toBe(1);
  });

  it('announces active orders when the velocity view falls back to active work', async () => {
    const velocityRow = mocks.customerServiceStore.getFacilityFulfillmentVelocity[0] as any;
    velocityRow.activeFacilityFallback = true;

    try {
      const wrapper = mountFunnel();
      (wrapper.vm as any).selectedDimension = 'velocity';
      await nextTick();

      const facilityProgressBar = wrapper.findAll('[role="progressbar"]').at(-1)!;
      expect(facilityProgressBar.attributes('aria-label')).toBe(
        'Outlet One: 10 translated:active orders'
      );
      expect(Number(facilityProgressBar.attributes('aria-valuenow'))).toBe(1);
    } finally {
      delete velocityRow.activeFacilityFallback;
    }
  });

  it('uses localized singular facility metric names', async () => {
    const volumeRow = mocks.customerServiceStore.getFacilityOrderVolume[0] as any;
    const velocityRow = mocks.customerServiceStore.getFacilityFulfillmentVelocity[0] as any;
    const rejectionRow = mocks.customerServiceStore.getFacilityRejections[0] as any;
    const originalValues = {
      volumeCount: volumeRow.lastOrderCount,
      velocityCount: velocityRow.lastOrderCount,
      shipGroupCount: velocityRow.shipGroupCount,
      rejectionCount: rejectionRow.lastOrderCount,
      rejectedShipGroupCount: rejectionRow.rejectedShipGroupCount,
    };

    volumeRow.lastOrderCount = 1;
    velocityRow.lastOrderCount = 1;
    velocityRow.shipGroupCount = 1;
    rejectionRow.lastOrderCount = 1;
    rejectionRow.rejectedShipGroupCount = 1;

    try {
      const wrapper = mountFunnel();
      const facilityProgressBar = () => wrapper.findAll('[role="progressbar"]').at(-1)!;

      expect(facilityProgressBar().attributes('aria-label')).toBe('Outlet One: 1 translated:order');

      (wrapper.vm as any).selectedDimension = 'velocity';
      await nextTick();
      expect(facilityProgressBar().attributes('aria-label')).toBe(
        'Outlet One: 50% translated:velocity (1/1 translated:order)'
      );

      velocityRow.activeFacilityFallback = true;
      (wrapper.vm as any).selectedDimension = 'volume';
      await nextTick();
      (wrapper.vm as any).selectedDimension = 'velocity';
      await nextTick();
      expect(facilityProgressBar().attributes('aria-label')).toBe(
        'Outlet One: 1 translated:active order'
      );

      (wrapper.vm as any).selectedDimension = 'rejections';
      await nextTick();
      expect(facilityProgressBar().attributes('aria-label')).toBe(
        'Outlet One: 1 translated:active order, 1 translated:rejected order'
      );
    } finally {
      volumeRow.lastOrderCount = originalValues.volumeCount;
      velocityRow.lastOrderCount = originalValues.velocityCount;
      velocityRow.shipGroupCount = originalValues.shipGroupCount;
      rejectionRow.lastOrderCount = originalValues.rejectionCount;
      rejectionRow.rejectedShipGroupCount = originalValues.rejectedShipGroupCount;
      delete velocityRow.activeFacilityFallback;
    }
  });
});
