<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Inflight orders') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="filters.query"
        :placeholder="translate('Order name, order ID, external ID')"
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
        <ion-select v-model="filters.facilityId" label="Facility" label-placement="stacked" interface="popover">
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
        <ion-item
          id="inflight-order-date-from-trigger"
          class="inflight-order-date-filter inflight-order-date-filter-fixed"
          button
          detail="false"
          lines="none"
        >
          <ion-label>
            <p>{{ translate('Order date from') }}</p>
            {{ dateFilterLabel(filters.dateFrom) }}
          </ion-label>
        </ion-item>
        <ion-item
          id="inflight-order-date-thru-trigger"
          class="inflight-order-date-filter inflight-order-date-filter-fixed"
          button
          detail="false"
          lines="none"
        >
          <ion-label>
            <p>{{ translate('Order date thru') }}</p>
            {{ dateFilterLabel(filters.dateThru) }}
          </ion-label>
        </ion-item>
      </SearchFilterCard>

      <ion-popover trigger="inflight-order-date-from-trigger" trigger-action="click" :show-backdrop="false">
        <ion-datetime
          presentation="date"
          :value="filters.dateFrom || undefined"
          :show-default-buttons="true"
          @ionChange="setDateFilter('dateFrom', $event.detail.value)"
        />
      </ion-popover>
      <ion-popover trigger="inflight-order-date-thru-trigger" trigger-action="click" :show-backdrop="false">
        <ion-datetime
          presentation="date"
          :value="filters.dateThru || undefined"
          :show-default-buttons="true"
          @ionChange="setDateFilter('dateThru', $event.detail.value)"
        />
      </ion-popover>

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
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>

        <div
          v-for="order in orders"
          :key="`${order.orderId}-${order.shipGroupSeqId}`"
          class="list-item inflight-order-row"
          :role="selectMode ? 'button' : 'link'"
          tabindex="0"
          @click="handleOrderRowClick(order)"
          @keydown.enter.prevent="handleOrderRowClick(order)"
          @keydown.space.prevent="handleOrderRowClick(order)"
        >
          <ion-item
            lines="none"
          >
            <ion-checkbox
              slot="start"
              :checked="selectedIds.has(order.orderId)"
              @click.stop
              @keydown.stop
              @ion-change="setOrderSelection(order.orderId, $event.detail.checked)"
            />
            <ion-label>
              <p class="overline">{{ order.orderId }}</p>
              {{ order.orderName || order.externalId || order.orderId }}
              <p>{{ formatStatus(order.statusId) }}</p>
            </ion-label>
          </ion-item>

          <ion-label class="tablet ion-text-start">
            {{ order.customerName || translate('Customer') }}
            <p>{{ customerAddressLine(order) }}</p>
            <p v-if="customerAddressTrailingLine(order)">{{ customerAddressTrailingLine(order) }}</p>
          </ion-label>

          <ion-label class="tablet ion-text-start">
            <p class="overline">{{ order.facilityName || order.facilityId || translate('Facility name') }}</p>
            {{ order.shipmentMethodDesc || order.shippingMethodTypeId || translate('Method name') }}
            <p>{{ carrierLabel(order) }}</p>
          </ion-label>

          <ion-label class="tablet">
            {{ formatDateTime(order.orderDate) }}
            <p>{{ orderedRelativeLabel(order.orderDate) }}</p>
          </ion-label>

          <ion-label class="inflight-delivery ion-text-end">
            {{ estimatedDeliveryDateLabel(order) }}
            <p>{{ translate('Estimated delivery date') }}</p>
            <p v-if="estimatedDeliveryRelativeLabel(order)">{{ estimatedDeliveryRelativeLabel(order) }}</p>
          </ion-label>
        </div>
      </ion-list>

      <div v-if="isLoading && !orders.length" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>
      <EmptyState
        v-else-if="!isLoading && !orders.length"
        :title="translate('No inflight orders')"
        :message='translate("Orders that have arrived at a warehouse but aren&apos;t on a picklist yet will appear here.")'
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
  IonDatetime,
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
  IonPage,
  IonPopover,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  alertController,
  useIonRouter
} from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import { useCustomerServiceStore, BULK_ACTIONS } from '@/store/customerService';
import { useOrderStore } from '@/store/order';
import { useSeedStore } from '@/store/seed';
import type { BulkActionDefinition, WorkflowOrder } from '@/types/customerService';
import EmptyState from '@/components/common/EmptyState.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import { api, translate } from '@common';
import router from '@/router';

const bucket = 'inflight';
const VIRTUAL_FACILITY_TYPE_ID = 'VIRTUAL_FACILITY';
const store = useCustomerServiceStore();
const orderStore = useOrderStore();
const seedStore = useSeedStore();
const route = router.currentRoute.value;
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

const orders = computed(() => store.filteredOrders(bucket));
const selectedIds = computed(() => new Set(store.selection[bucket]));
const actions = computed<BulkActionDefinition[]>(() => BULK_ACTIONS[bucket]);
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

type DateFilterField = 'dateFrom' | 'dateThru';
type FacilityOption = {
  id: string;
  name: string;
};

function dateFilterLabel(value: string) {
  if (!value) return translate('Select date');

  const date = dateFromValue(value);
  return date ? date.toFormat('MM/dd/yyyy') : value;
}

function setDateFilter(field: DateFilterField, value: string | string[] | null | undefined) {
  filters.value[field] = normalizeDateFilterValue(value);
}

function normalizeDateFilterValue(value: string | string[] | null | undefined) {
  if (!value) return '';
  const selectedValue = Array.isArray(value) ? value[0] : value;
  return selectedValue ? String(selectedValue).slice(0, 10) : '';
}

function applyRouteFilters() {
  const facilityId = route.query.facilityId;

  if (typeof facilityId === 'string' && facilityId) {
    filters.value.facilityId = facilityId;
  }
}

watch(() => route.query.facilityId, applyRouteFilters, { immediate: true });

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
    bucket,
    store.selection[bucket].filter((orderId) => currentOrderIds.has(orderId))
  );
});

function clearFilters() {
  store.clearFilters(bucket);
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
    selectMode.value = true;
  } else {
    currentSelection.delete(orderId);
  }

  store.setSelection(bucket, [...currentSelection]);
  if (!currentSelection.size) selectMode.value = false;
}

function orderDetailLink(order: WorkflowOrder) {
  return `/inflight/${order.orderId}`;
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
  store.runBulkAction(bucket, action.id);
  toastMessage.value = `${action.label} · ${count} ${count === 1 ? translate('order') : translate('orders')}`;
}

function customerAddressLine(order: WorkflowOrder) {
  return order.shippingAddress1 || order.productStoreName || order.externalId || '';
}

function customerAddressTrailingLine(order: WorkflowOrder) {
  const parts = [
    order.shippingCity,
    order.shippingStateProvinceGeoId,
    order.shippingPostalCode,
    order.shippingCountryGeoId
  ].filter(Boolean);

  if (parts.length) return parts.join(' ');
  return order.shippingAddress1 ? '' : order.externalId;
}

function carrierLabel(order: WorkflowOrder) {
  return order.carrierPartyId || formatChannel(order.salesChannelEnumId);
}

function orderedRelativeLabel(orderDateValue: string) {
  const relative = formatRelativeDate(orderDateValue);
  return relative ? `${translate('Ordered')} ${relative}` : '';
}

function estimatedDeliveryValue(order: WorkflowOrder) {
  return order.estimatedDeliveryDate || order.shipBeforeDate;
}

function estimatedDeliveryDateLabel(order: WorkflowOrder) {
  const date = dateFromValue(estimatedDeliveryValue(order));
  return date ? date.toFormat('MM-dd-yyyy') : translate('No delivery date');
}

function estimatedDeliveryRelativeLabel(order: WorkflowOrder) {
  const date = dateFromValue(estimatedDeliveryValue(order));
  return date?.toRelative() || '';
}

function formatChannel(channel: string) {
  if (!channel) return '';
  return channel
    .replace(/_SALES_CHANNEL$/, '')
    .replace(/_CHANNEL$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(statusId: string) {
  if (!statusId) return '';
  return statusId
    .replace(/^ORDER_/, '')
    .replace(/^ITEM_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateFromValue(value?: string | null) {
  if (!value) return null;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    const numericDate = DateTime.fromMillis(numericValue);
    if (numericDate.isValid) return numericDate;
  }

  const sqlDate = DateTime.fromSQL(value);
  if (sqlDate.isValid) return sqlDate;

  const isoDate = DateTime.fromISO(value);
  return isoDate.isValid ? isoDate : null;
}

function formatDateTime(orderDateValue: string) {
  const date = dateFromValue(orderDateValue);
  return date ? date.toFormat('MM-dd-yyyy hh:mm a') : '';
}

function formatRelativeDate(orderDateValue: string) {
  const date = dateFromValue(orderDateValue);
  return date?.toRelative() || '';
}
</script>

<style scoped>
.inflight-order-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
  min-height: 5rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-sm);
}

.inflight-order-row > ion-label {
  width: 100%;
}

.inflight-order-row > ion-label.inflight-delivery {
  display: block;
  justify-self: end;
  max-width: 10rem;
  min-width: 10rem;
  width: 10rem;
}

.inflight-order-date-filter.inflight-order-date-filter-fixed {
  flex: 0 0 11rem;
  min-width: 11rem;
  max-width: 11rem;
}

@media (max-width: 640px) {
  .inflight-order-date-filter.inflight-order-date-filter-fixed {
    flex: 1 1 auto;
    max-width: none;
    min-width: 0;
    width: 100%;
  }
}
</style>
