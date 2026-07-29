import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Funnel from '@/views/Funnel.vue';

const mocks = vi.hoisted(() => {
  const noop = vi.fn();
  const retryBacklog = vi.fn();
  const retryTrend = vi.fn();
  const trend = Array.from({ length: 24 }, (_, hour) => (hour === 11 ? 5 : 0));
  const hourlyCounts = trend.map((orderCount, hourOfDay) => ({ hourOfDay, orderCount }));
  const state = {
    trendError: false,
    backlogError: false
  };

  return {
    state,
    retryBacklog,
    retryTrend,
    customerServiceStore: {
      isDashboardGroupLoading: () => false,
      isDashboardGroupError: (key: string) =>
        (key === 'unfillableTrend' && state.trendError)
        || (key === 'unfillable' && state.backlogError),
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
      getUnfillable: { totalCount: 358, unfillableHourlyCounts: hourlyCounts },
      getVirtualLocationCounts: [],
      getFulfillmentSyncData: null,
      unfillableTrend: trend,
      fetchFulfillmentProgress: noop,
      fetchUnfillable: noop,
      fetchUnfillableBacklog: retryBacklog,
      fetchUnfillableTrend: retryTrend,
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
    template: '<component :is="button ? \'button\' : \'section\'" class="stat-card-stub"><span class="title">{{ title }}</span><span class="stat">{{ stat }}</span><slot /><slot name="stat" /></component>'
  },
  Sparkline: {
    name: 'Sparkline',
    props: {
      points: Array,
      color: String
    },
    template: '<div data-testid="sparkline" />'
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
  useUserStore: () => ({}),
}));

vi.mock('@/services/order', () => ({
  fetchWorkflowOrderTotals: vi.fn().mockResolvedValue({ open: 0, inflight: 0, packed: 0 }),
}));

describe('Funnel Unfillable sparkline', () => {
  beforeEach(() => {
    mocks.state.trendError = false;
    mocks.state.backlogError = false;
    mocks.retryBacklog.mockReset();
    mocks.retryTrend.mockReset();
  });

  it('renders today-entry hourly points independently from the current backlog total', () => {
    const wrapper = mount(Funnel);
    const cards = wrapper.findAllComponents({ name: 'StatCard' });
    const unfillableCard = cards.find((card) => card.props('title') === 'Unfillable backlog');
    const sparkline = wrapper.getComponent({ name: 'Sparkline' });

    expect(unfillableCard?.props('stat')).toBe(358);
    expect(unfillableCard?.text()).toContain('Entries into Unfillable today');
    expect(sparkline.props('points')).toHaveLength(24);
    expect((sparkline.props('points') as number[])[11]).toBe(5);
    expect((sparkline.props('points') as number[]).reduce((sum, count) => sum + count, 0)).toBe(5);
  });

  it('keeps the backlog visible and renders a sibling trend retry when the trend fails', async () => {
    mocks.state.trendError = true;
    const wrapper = mount(Funnel);
    const cards = wrapper.findAllComponents({ name: 'StatCard' });
    const unfillableCard = cards.find((card) => card.props('title') === 'Unfillable backlog')!;

    expect(unfillableCard.props('stat')).toBe(358);
    expect(unfillableCard.text()).toContain('Entries into Unfillable today');
    expect(unfillableCard.text()).toContain("Couldn't load this section");
    expect(unfillableCard.findComponent({ name: 'Sparkline' }).exists()).toBe(false);
    expect(unfillableCard.element.querySelector('button button')).toBeNull();

    const trendRetry = wrapper.get('.unfillable-trend-retry');
    expect(unfillableCard.element.contains(trendRetry.element)).toBe(false);
    await trendRetry.trigger('click');
    expect(mocks.retryTrend).toHaveBeenCalledWith('STORE_1');
    expect(mocks.retryBacklog).not.toHaveBeenCalled();
  });

  it('keeps a successful trend visible and retries only the backlog when the queue count fails', async () => {
    mocks.state.backlogError = true;
    const wrapper = mount(Funnel);
    const cards = wrapper.findAllComponents({ name: 'StatCard' });
    const unfillableCard = cards.find((card) => card.props('title') === 'Unfillable backlog')!;
    const sparkline = unfillableCard.getComponent({ name: 'Sparkline' });

    expect(unfillableCard.element.tagName).toBe('SECTION');
    expect(unfillableCard.text()).toContain("Couldn't load this section");
    expect(unfillableCard.text()).toContain('Entries into Unfillable today');
    expect(sparkline.props('points')).toHaveLength(24);
    expect((sparkline.props('points') as number[])[11]).toBe(5);
    expect(unfillableCard.element.querySelector('button button')).toBeNull();

    const backlogRetry = wrapper.get('.unfillable-backlog-retry');
    expect(unfillableCard.element.contains(backlogRetry.element)).toBe(false);
    await backlogRetry.trigger('click');
    expect(mocks.retryBacklog).toHaveBeenCalledWith('STORE_1');
    expect(mocks.retryTrend).not.toHaveBeenCalled();
  });
});
