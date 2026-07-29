import { defineComponent, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Funnel from '@/views/Funnel.vue';

const noop = vi.fn();

const dashboardStore = {
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
  getFacilityFulfillmentProgress: {
    fillRate: 0.5,
    ordersAllocated: 4,
    capacityLimit: 10,
    ordersPacked: 1,
    ordersRejected: 0,
    totalPending: 3,
    oldestAssignedTime: null,
    openCount: 2,
    inProgressCount: 1,
    assignedBeforeTodayCount: 0,
  },
  getFacilityOrderVolume: [{
    facilityId: 'FACILITY=A&B',
    facilityName: 'Main & West',
    lastOrderCount: 7,
  }],
  getFacilityFulfillmentVelocity: [],
  getFacilityRejections: [],
  getUnfillable: { totalCount: 1 },
  getVirtualLocationCounts: [{
    id: 'awaiting-brokering',
    label: 'Awaiting brokering',
    count: 2,
    facilityIds: ['_NA_', 'FACILITY & WEST'],
  }, {
    id: 'unfillable',
    label: 'Unfillable',
    count: 1,
    facilityIds: ['UNFILLABLE_PARKING'],
  }],
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
};

vi.mock('@ionic/vue', () => {
  const component = defineComponent({
    template: '<div><slot /><slot name="stat" /></div>',
  });
  const item = defineComponent({
    inheritAttrs: false,
    props: {
      href: String,
      routerLink: [String, Object],
    },
    emits: ['click'],
    template: `
      <a v-if="href" v-bind="$attrs" :href="href" @click="$emit('click', $event)"><slot /></a>
      <div v-else v-bind="$attrs"><slot /></div>
    `,
  });

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
    IonItem: item,
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
  StatCard: defineComponent({
    inheritAttrs: false,
    props: {
      button: Boolean,
      href: String,
    },
    emits: ['click'],
    template: `
      <a
        v-if="href"
        v-bind="$attrs"
        class="stat-card-stub"
        :href="href"
        @click="$emit('click', $event)"
      >
        <slot /><slot name="stat" />
      </a>
      <section v-else v-bind="$attrs"><slot /><slot name="stat" /></section>
    `,
  }),
  Sparkline: defineComponent({ template: '<div />' }),
  commonUtil: {
    getRelativeTime: () => '',
    getCronString: () => '',
    getNextExecutionTime: () => '',
    showToast: vi.fn(),
  },
}));

vi.mock('@/store/customerService', () => ({
  useCustomerServiceStore: () => dashboardStore,
}));

vi.mock('@/store/order', () => ({
  useOrderStore: () => ({
    navCounts: { brokering: 2 },
    primeNavCounts: noop,
    setNavCount: noop,
  }),
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
  fetchWorkflowOrderTotals: vi.fn().mockResolvedValue({
    open: 0,
    inflight: 0,
    packed: 0,
  }),
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory('/order-manager/'),
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
}

describe('Funnel native drilldown links', () => {
  it('renders base-aware virtual and facility hrefs while keeping plain clicks in Vue Router', async () => {
    const router = makeRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Funnel, {
      global: {
        plugins: [router],
      },
    });

    (wrapper.vm as any).selectedFacilityId = 'FACILITY=A&B';
    await nextTick();

    const hrefs = wrapper.findAll('a[href]').map((link) => link.attributes('href'));
    expect(hrefs).toEqual(expect.arrayContaining([
      '/order-manager/brokering?facilityId=_NA_&facilityId=FACILITY+%26+WEST',
      '/order-manager/unfillable',
      '/order-manager/open',
      '/order-manager/inflight',
      '/order-manager/packed',
      '/order-manager/open?facilityId=FACILITY=A%26B',
      '/order-manager/inflight?facilityId=FACILITY=A%26B',
    ]));
    expect(wrapper.html()).not.toContain('[object Object]');

    const brokeringLink = wrapper.findAll('a[href]').find((link) =>
      link.attributes('href')
        === '/order-manager/brokering?facilityId=_NA_&facilityId=FACILITY+%26+WEST'
    );
    expect(brokeringLink).toBeDefined();
    await brokeringLink!.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/brokering');
    expect(router.currentRoute.value.query.facilityId).toEqual([
      '_NA_',
      'FACILITY & WEST',
    ]);
  });

  it('routes all brokered rows and the Unfillable card only for plain primary clicks', async () => {
    const router = makeRouter();
    await router.push('/');
    await router.isReady();
    const push = vi.spyOn(router, 'push').mockResolvedValue(undefined);

    const wrapper = mount(Funnel, {
      global: {
        plugins: [router],
      },
    });

    const links = [
      { href: '/order-manager/open', to: '/open' },
      { href: '/order-manager/inflight', to: '/inflight' },
      { href: '/order-manager/packed', to: '/packed' },
      { href: '/order-manager/unfillable', to: '/unfillable', statCard: true },
    ];

    const findLink = (href: string, statCard = false) => {
      const matches = wrapper.findAll('a[href]').filter((link) =>
        link.attributes('href') === href
        && (!statCard || link.classes().includes('stat-card-stub'))
      );
      expect(matches).toHaveLength(1);
      return matches[0];
    };

    const dispatchObservedClick = (
      link: ReturnType<typeof findLink>,
      init: MouseEventInit
    ) => {
      let preventedByDashboardHandler: boolean | undefined;
      link.element.addEventListener('click', (event) => {
        preventedByDashboardHandler = event.defaultPrevented;
        event.preventDefault();
      }, { once: true });
      link.element.dispatchEvent(new MouseEvent('click', {
        button: 0,
        cancelable: true,
        ...init,
      }));
      return preventedByDashboardHandler;
    };

    for (const link of links) {
      push.mockClear();
      const prevented = dispatchObservedClick(
        findLink(link.href, link.statCard),
        { button: 0 }
      );

      expect(prevented).toBe(true);
      expect(push).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledWith(link.to);
    }

    for (const link of links) {
      const renderedLink = findLink(link.href, link.statCard);
      for (const click of [
        { metaKey: true },
        { ctrlKey: true },
        { button: 1 },
      ]) {
        push.mockClear();
        const prevented = dispatchObservedClick(renderedLink, click);

        expect(prevented).toBe(false);
        expect(push).not.toHaveBeenCalled();
      }
    }
  });
});
