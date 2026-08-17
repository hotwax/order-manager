<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Open orders') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <WorkflowOrderFilterCard
        v-model="filters"
        :channel-options="channelFilterOptions"
        :facility-options="facilityFilterOptions"
        :shipment-method-options="shipmentMethodOptions"
        @clear="clearFilters"
      />

      <ion-list>
        <ion-list-header>
          <ion-checkbox
            class="ion-margin-end"
            v-if="selectMode"
            :checked="allCurrentPageSelected"
            :indeterminate="someCurrentPageSelected && !allCurrentPageSelected"
            @ion-change="toggleCurrentPageSelection($event.detail.checked)"
          />
          <ion-label>{{ resultsSummary }}</ion-label>
          <OrderSortPopover
            v-model="filters.sort"
            :options="sortOptions"
            trigger-id="open-order-sort-trigger"
          />
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>

        <OrderRow
          v-for="order in orders"
          :key="order.orderId"
          :model="orderRow(order)"
          row-class="open-order-row"
          deadline-class="open-order-total ion-text-end"
          :select-mode="selectMode"
          :selected="selectedIds.has(order.orderId)"
          @activate="handleOrderRowClick(order)"
          @selection-change="setOrderSelection(order.orderId, $event)"
        />
      </ion-list>

      <div v-if="isLoading && !orders.length" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>
      <EmptyState
        v-else-if="!isLoading && !orders.length"
        :title="translate('No open orders')"
        :message="translate('Approved or newly created orders awaiting routing will appear here.')"
      />

      <ion-infinite-scroll
        threshold="100px"
        v-show="hasMore"
        @ionInfinite="loadMore($event)"
      >
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>
    </ion-content>

    <BulkOrderActionFooter
      v-if="selectMode"
      :order-ids="selectedOrderIds"
      :actions="bulkActions"
      @submitted="exitSelectMode"
    />

    <ion-toast
      :is-open="!!toastMessage"
      :message="toastMessage"
      :duration="2000"
      position="top"
      @did-dismiss="toastMessage = ''"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonRouter
} from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useCustomerServiceStore } from '@/store/customerService';
import { useOrderStore } from '@/store/order';
import { useProductStore } from '@/store/productStore';
import { useSeedStore } from '@/store/seed';
import { useUserStore } from '@/store/user';
import type { WorkflowOrder } from '@/types/customerService';
import { WORKFLOW_ORDER_SORT_OPTIONS } from '@/types/customerService';
import EmptyState from '@/components/common/EmptyState.vue';
import WorkflowOrderFilterCard from '@/components/orders/WorkflowOrderFilterCard.vue';
import OrderRow from '@/components/orders/OrderRow.vue';
import OrderSortPopover from '@/components/orders/OrderSortPopover.vue';
import BulkOrderActionFooter from '@/components/orders/BulkOrderActionFooter.vue';
import { permittedBulkActions } from '@/services/bulkActions';
import { toWorkflowOrderRowViewModel } from '@/utils/orderRows';
import { api, translate } from '@common';
import router from '@/router';
import Actions from '@/authorization/actions';

const bucket = 'open';
const VIRTUAL_FACILITY_TYPE_ID = 'VIRTUAL_FACILITY';
const store = useCustomerServiceStore();
const orderStore = useOrderStore();
const productStore = useProductStore();
const seedStore = useSeedStore();
const userStore = useUserStore();
const ionRouter = useIonRouter();
const toastMessage = ref('');

const filters = computed({
  get: () => store.filters[bucket],
  set: (value) => (store.filters[bucket] = value)
});
const physicalFacilities = ref<FacilityOption[]>([]);

const channelOptions = computed(() =>
  (seedStore.enumsByType['ORDER_SALES_CHANNEL']?.ids || []).map((enumId) => {
    const enumeration: any = seedStore.enumsByType['ORDER_SALES_CHANNEL'].byId[enumId];
    return enumeration?.enumId || enumId;
  })
);

const facilityOptions = computed(() => physicalFacilities.value);

const shipmentMethodOptions = computed(() =>
  seedStore.shipmentMethodTypes.ids.map((id) => {
    const method: any = seedStore.shipmentMethodTypes.byId[id];
    return { id, label: method?.description || id };
  })
);

const channelFilterOptions = computed(() => channelOptions.value.map((channel) => ({ id: channel, label: formatChannel(channel) })));
const facilityFilterOptions = computed(() => facilityOptions.value.map((facility) => ({ id: facility.id, label: facility.name })));

const orders = computed(() => store.filteredOrders(bucket));
const selectedIds = computed(() => new Set(store.selection[bucket]));
const selectedOrderIds = computed(() => [...selectedIds.value]);
// Open orders are approved but not yet routed or picked, so every order-level action applies.
const bulkActions = computed(() => permittedBulkActions(
  ['park', 'facility', 'shipMethod', 'shipDates', 'cancelItems', 'createTasks'],
  {
    canUpdate: userStore.hasPermission(Actions.APP_ORDER_UPDATE),
    canCancel: userStore.hasPermission(Actions.APP_ORDER_CANCEL),
    canCreateTask: userStore.hasPermission(Actions.APP_ORDER_TASK_CREATE)
  }
));
const selectMode = ref(false);
const currentPageOrderIds = computed(() => orders.value.map((order) => order.orderId));
const allCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.length > 0 && currentPageOrderIds.value.every((orderId) => selectedIds.value.has(orderId));
});
const someCurrentPageSelected = computed(() => currentPageOrderIds.value.some((orderId) => selectedIds.value.has(orderId)));
const isLoading = computed(() => orderStore.workflowOrdersLoading[bucket]);
const orderTotal = computed(() => orderStore.workflowOrdersTotal[bucket]);
const hasMore = computed(() => orderStore.workflowOrders[bucket].length < orderStore.workflowOrdersTotal[bucket]);
const resultsSummary = computed(() =>
  `${orders.value.length} of ${orderTotal.value} ${orderTotal.value === 1 ? translate('order') : translate('orders')}`
);
const selectedProductStoreId = computed(() => productStore.getCurrentProductStore?.productStoreId || 'All');
const sortOptions = WORKFLOW_ORDER_SORT_OPTIONS;

function orderRow(order: WorkflowOrder) {
  return toWorkflowOrderRowViewModel(order, orderStore.workflowEnrichment(bucket, order.orderId));
}

type FacilityOption = {
  id: string;
  name: string;
};

function applyRouteFilters() {
  const facilityId = router.currentRoute.value.query.facilityId;
  const dateFrom = router.currentRoute.value.query.dateFrom;

  if (typeof facilityId === 'string' && facilityId) {
    filters.value.facilityId = facilityId;
  }
  if (typeof dateFrom === 'string' && dateFrom) {
    filters.value.dateFrom = dateFrom;
  } else {
    filters.value.dateFrom = '';
  }
}

watch(() => [router.currentRoute.value.query.facilityId, router.currentRoute.value.query.dateFrom], applyRouteFilters, { immediate: true });
watch(selectedProductStoreId, () => {
  filters.value.productStoreId = selectedProductStoreId.value;
}, { immediate: true });

function loadWorkflowOrders() {
  orderStore.fetchWorkflowOrders(bucket, filters.value);
}

async function loadPhysicalFacilities() {
  try {
    const resp = await api({
      url: 'oms/facilities',
      method: 'GET',
      params: {
        pageSize: 1000,
        facilityTypeId: VIRTUAL_FACILITY_TYPE_ID,
        facilityTypeId_not: 'Y',
        parentTypeId: VIRTUAL_FACILITY_TYPE_ID,
        parentTypeId_not: 'Y'
      }
    });
    const facilities = responseList(resp.data);
    physicalFacilities.value = facilities
      .map((facility: any) => ({
        id: facility.facilityId || facility.id,
        name: facility.facilityName || facility.name || facility.facilityId || facility.id
      }))
      .filter((facility: FacilityOption) => facility.id);
  } catch {
    physicalFacilities.value = [];
  }
}

function responseList(data: any) {
  return Array.isArray(data) ? data : data?.entityValueList || data?.docs || data?.list || data?.items || [];
}

async function loadMore(event: any) {
  await orderStore.loadMoreWorkflowOrders(bucket, filters.value);
  event.target.complete();
}

onMounted(() => {
  loadWorkflowOrders();
  loadPhysicalFacilities();
});

const debounceTimer = ref<ReturnType<typeof setTimeout>>();

watch(
  () => filters.value.query,
  () => {
    if (debounceTimer.value) clearTimeout(debounceTimer.value);
    debounceTimer.value = setTimeout(loadWorkflowOrders, 300);
  }
);

watch(
  () => [
    filters.value.priority,
    filters.value.productStoreId,
    filters.value.salesChannelEnumId,
    filters.value.facilityId,
    filters.value.shipmentMethodTypeId,
    filters.value.dateFrom,
    filters.value.dateThru,
    filters.value.sort
  ],
  loadWorkflowOrders
);

watch(orders, () => {
  const currentOrderIds = new Set(currentPageOrderIds.value);
  store.setSelection(
    bucket,
    store.selection[bucket].filter((orderId) => currentOrderIds.has(orderId))
  );
});

function clearFilters() {
  store.clearFilters(bucket);
  filters.value.productStoreId = selectedProductStoreId.value;
}

function enterSelectMode() {
  selectMode.value = true;
}

function exitSelectMode() {
  selectMode.value = false;
  store.clearSelection(bucket);
}

function toggleSelectMode() {
  if (selectMode.value) {
    exitSelectMode();
    return;
  }

  enterSelectMode();
}

function toggleCurrentPageSelection(checked: boolean) {
  store.setSelection(bucket, checked ? [...currentPageOrderIds.value] : []);
}

function toggleOrderSelection(orderId: string) {
  if (!selectMode.value) return;
  setOrderSelection(orderId, !selectedIds.value.has(orderId));
}

function handleOrderRowClick(order: WorkflowOrder) {
  if (selectMode.value) {
    toggleOrderSelection(order.orderId);
    return;
  }

  ionRouter.push(orderDetailLink(order));
}

function setOrderSelection(orderId: string, checked: boolean) {
  const currentSelection = new Set(store.selection[bucket]);

  if (checked) {
    currentSelection.add(orderId);
  } else {
    currentSelection.delete(orderId);
  }

  store.setSelection(bucket, [...currentSelection]);
}

function orderDetailLink(order: WorkflowOrder) {
  return `/open/${order.orderId}`;
}

function formatChannel(channel: string) {
  return channel
    .replace(/_SALES_CHANNEL$/, '')
    .replace(/_CHANNEL$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

</script>

<style scoped>
.open-order-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
  min-height: 5rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-sm);
}

.open-order-row > ion-label {
  width: 100%;
}

.open-order-row > ion-label.open-order-total {
  display: block;
  justify-self: end;
  max-width: 7rem;
  min-width: 7rem;
  width: 7rem;
}

</style>
