<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="filters.query"
        :placeholder="searchPlaceholder"
        @clear="clearFilters"
      >
        <ion-input v-model="filters.customerName" label="Customer name" :placeholder="translate('Search by name')" label-placement="stacked" :clear-input="true" />
        <ion-select v-model="filters.priority" label="Priority" label-placement="stacked" interface="popover">
          <ion-select-option :value="null">All</ion-select-option>
          <ion-select-option :value="true">High priority</ion-select-option>
          <ion-select-option :value="false">Normal / no priority</ion-select-option>
        </ion-select>
        <ion-select v-model="filters.salesChannelEnumId" label="Channel" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All channels</ion-select-option>
          <ion-select-option v-for="channel in channelOptions" :key="channel" :value="channel">
            {{ formatChannel(channel) }}
          </ion-select-option>
        </ion-select>
        <ion-select v-if="showFacility" v-model="filters.facilityId" label="Facility" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All facilities</ion-select-option>
          <ion-select-option v-for="facility in facilityOptions" :key="facility.id" :value="facility.id">
            {{ facility.name }}
          </ion-select-option>
        </ion-select>
        <ion-select v-model="filters.shipmentMethodTypeId" label="Shipment method" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All methods</ion-select-option>
          <ion-select-option v-for="method in shipmentMethodOptions" :key="method.id" :value="method.id">
            {{ method.label }}
          </ion-select-option>
        </ion-select>
        <ion-input v-model="filters.dateFrom" :label="translate('Order date from')" label-placement="stacked" type="date" />
        <ion-input v-model="filters.dateThru" :label="translate('Order date thru')" label-placement="stacked" type="date" />
      </SearchFilterCard>

      <ion-list v-if="orders.length">
        <ion-list-header>
          <ion-checkbox
            class="ion-margin-end"
            v-if="selectMode"
            :checked="allCurrentPageSelected"
            :indeterminate="someCurrentPageSelected && !allCurrentPageSelected"
            @ion-change="toggleCurrentPageSelection($event.detail.checked)"
          />
          <ion-label>{{ orderTotal }} {{ orderTotal === 1 ? translate('order') : translate('orders') }}</ion-label>
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>
        <ion-item
          v-for="order in orders"
          :key="order.orderId"
          button
          :router-link="selectMode ? undefined : orderDetailLink(order)"
          @click="toggleOrderSelection(order.orderId)"
        >
          <ion-checkbox
            v-if="selectMode"
            slot="start"
            :checked="selectedIds.has(order.orderId)"
            @click.stop
            @ion-change="setOrderSelection(order.orderId, $event.detail.checked)"
          />
          <ion-label>
            <h2>{{ order.orderName }} · {{ order.externalId }}</h2>
            <p>{{ order.customerName }} · {{ order.productStoreName }} · {{ formatChannel(order.salesChannelEnumId) }}</p>
            <p>
              {{ formatDate(order.orderDate) }} · {{ order.itemCount }} item{{ order.itemCount === 1 ? '' : 's' }} ·
              {{ order.shipmentMethodDesc }}
              <template v-if="order.facilityName"> · {{ order.facilityName }}</template>
            </p>
          </ion-label>
          <ion-note slot="end">
            <div>{{ order.priority }}</div>
            <div>{{ formatCurrency(order.grandTotal, order.currencyUomId) }}</div>
          </ion-note>
        </ion-item>
      </ion-list>

      <div v-if="isLoading && !orders.length" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>
      <EmptyState
        v-else-if="!isLoading && !orders.length"
        :title="emptyTitle"
        :message="emptyMessage"
      />

      <ion-infinite-scroll
        threshold="100px"
        v-show="hasMore"
        @ionInfinite="loadMore($event)"
      >
        <ion-infinite-scroll-content loading-spinner="crescent" />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="selectMode">
      <ion-toolbar>
        <ion-title size="small">{{ selectedIds.size }} {{ translate('selected') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            v-for="action in actions"
            :key="action.id"
            :disabled="!selectedIds.size"
            @click="runAction(action)"
          >
            {{ action.label }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>

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
  IonFooter,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  alertController
} from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import { useCustomerServiceStore, BULK_ACTIONS } from '@/store/customerService';
import { useOrderStore } from '@/store/order';
import { useSeedStore } from '@/store/seed';
import type { BulkActionDefinition, WorkflowBucket, WorkflowOrder } from '@/types/customerService';
import EmptyState from '@/components/common/EmptyState.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import { commonUtil, translate } from '@common';
import router from '@/router';

const props = defineProps<{
  bucket: WorkflowBucket;
  title: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyMessage: string;
  showFacility?: boolean;
}>();

const store = useCustomerServiceStore();
const orderStore = useOrderStore();
const seedStore = useSeedStore();
const route = router.currentRoute.value;
const toastMessage = ref('');

const filters = computed({
  get: () => store.filters[props.bucket],
  set: (value) => (store.filters[props.bucket] = value)
});

const channelOptions = computed(() =>
  (seedStore.enumsByType['ORDER_SALES_CHANNEL']?.ids || []).map((enumId) => {
    const enumeration: any = seedStore.enumsByType['ORDER_SALES_CHANNEL'].byId[enumId];
    return enumeration?.enumId || enumId;
  })
);

const facilityOptions = computed(() =>
  seedStore.facilities.ids.map((id) => {
    const facility: any = seedStore.facilities.byId[id];
    return { id, name: facility?.facilityName || id };
  })
);

const shipmentMethodOptions = computed(() =>
  seedStore.shipmentMethodTypes.ids.map((id) => {
    const method: any = seedStore.shipmentMethodTypes.byId[id];
    return { id, label: method?.description || id };
  })
);

const orders = computed(() => store.filteredOrders(props.bucket));
const selectedIds = computed(() => new Set(store.selection[props.bucket]));
const actions = computed<BulkActionDefinition[]>(() => BULK_ACTIONS[props.bucket]);
const selectMode = ref(false);
const currentPageOrderIds = computed(() => orders.value.map((order) => order.orderId));
const allCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.length > 0 && currentPageOrderIds.value.every((orderId) => selectedIds.value.has(orderId));
});
const someCurrentPageSelected = computed(() => currentPageOrderIds.value.some((orderId) => selectedIds.value.has(orderId)));

const isApiBucket = props.bucket === 'open' || props.bucket === 'inflight' || props.bucket === 'packed';
const apiBucket = props.bucket as 'open' | 'inflight' | 'packed';

const isLoading = computed(() => isApiBucket && orderStore.workflowOrdersLoading[apiBucket]);

const orderTotal = computed(() =>
  isApiBucket ? orderStore.workflowOrdersTotal[apiBucket] : orders.value.length
);

const hasMore = computed(() =>
  isApiBucket && orderStore.workflowOrders[apiBucket].length < orderStore.workflowOrdersTotal[apiBucket]
);

function applyRouteFilters() {
  const facilityId = route.query.facilityId;

  if (typeof facilityId === 'string' && facilityId) {
    filters.value.facilityId = facilityId;
  }
}

watch(() => route.query.facilityId, applyRouteFilters, { immediate: true });

function loadWorkflowOrders() {
  orderStore.fetchWorkflowOrders(props.bucket as 'open' | 'inflight' | 'packed', filters.value);
}

async function loadMore(event: any) {
  await orderStore.loadMoreWorkflowOrders(props.bucket as 'open' | 'inflight' | 'packed', filters.value);
  event.target.complete();
}

onMounted(loadWorkflowOrders);

const debounceTimer = ref<ReturnType<typeof setTimeout>>();

watch(
  () => [filters.value.query, filters.value.customerName],
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
    filters.value.dateThru
  ],
  loadWorkflowOrders
);

watch(orders, () => {
  const currentOrderIds = new Set(currentPageOrderIds.value);
  store.setSelection(
    props.bucket,
    store.selection[props.bucket].filter((orderId) => currentOrderIds.has(orderId))
  );
});

function clearFilters() {
  store.clearFilters(props.bucket);
}

function enterSelectMode() {
  selectMode.value = true;
}

function exitSelectMode() {
  selectMode.value = false;
  store.clearSelection(props.bucket);
}

function toggleSelectMode() {
  if (selectMode.value) {
    exitSelectMode();
    return;
  }

  enterSelectMode();
}

function toggleCurrentPageSelection(checked: boolean) {
  store.setSelection(props.bucket, checked ? [...currentPageOrderIds.value] : []);
}

function toggleOrderSelection(orderId: string) {
  if (!selectMode.value) return;
  setOrderSelection(orderId, !selectedIds.value.has(orderId));
}

function setOrderSelection(orderId: string, checked: boolean) {
  const currentSelection = new Set(store.selection[props.bucket]);

  if (checked) {
    currentSelection.add(orderId);
  } else {
    currentSelection.delete(orderId);
  }

  store.setSelection(props.bucket, [...currentSelection]);
}

function orderDetailLink(order: WorkflowOrder) {
  return `/${props.bucket}/${order.orderId}`;
}

async function runAction(action: BulkActionDefinition) {
  if (!selectedIds.value.size) return;

  if (action.confirmText) {
    const alert = await alertController.create({
      header: action.label,
      message: action.confirmText,
      buttons: [
        { text: translate('Cancel'), role: 'cancel' },
        { text: translate('Confirm'), role: 'confirm' }
      ]
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return;
  }

  const count = selectedIds.value.size;
  store.runBulkAction(props.bucket, action.id);
  toastMessage.value = `${action.label} · ${count} ${count === 1 ? translate('order') : translate('orders')}`;
}

function formatChannel(channel: string) {
  return channel
    .replace(/_SALES_CHANNEL$/, '')
    .replace(/_CHANNEL$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(iso: string) {
  if (!iso) return '';
  return DateTime.fromMillis(Number(iso)).toFormat('LLL d, h:mma');
}

function formatCurrency(amount: number, currency: string) {
  return commonUtil.formatCurrency(amount, currency);
}

</script>
