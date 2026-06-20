<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate(title) }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate(searchPlaceholder)"
        @clear="clearFilters"
      >
        <slot name="filters" />
        <ion-select
          v-model="searchFilters.channel"
          label="Sales channel"
          label-placement="stacked"
          interface="popover"
          :interface-options="{ showBackdrop: false }"
        >
          <ion-select-option value="All">All sales channels</ion-select-option>
          <ion-select-option v-for="option in salesChannels" :key="option.enumId" :value="option.enumId">
            {{ option.description || option.enumName || option.enumId }}
          </ion-select-option>
        </ion-select>
        <ion-select
          v-model="searchFilters.shipmentMethodTypeId"
          label="Shipping method"
          label-placement="stacked"
          interface="popover"
          :interface-options="{ showBackdrop: false }"
        >
          <ion-select-option value="All">All methods</ion-select-option>
          <ion-select-option v-for="option in shipmentMethodOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </ion-select-option>
        </ion-select>
        <DateFilterSelect v-model="searchFilters.dateFrom" :label="translate('Order date from')" />
        <DateFilterSelect v-model="searchFilters.dateThru" :label="translate('Order date thru')" />
      </SearchFilterCard>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        title="Could not load orders"
        :message="error"
      />

      <ion-list v-else>
        <ion-list-header class="order-results-header">
          <span class="order-results-header-start">
            <ion-checkbox
              v-if="selectMode"
              :checked="allCurrentPageSelected"
              :indeterminate="someCurrentPageSelected && !allCurrentPageSelected"
              @ionChange="toggleCurrentPageSelection($event.detail.checked)"
            />
          </span>
          <ion-label>{{ translate("{loaded} of {total} orders", { loaded: searchResults.length, total: searchTotal }) }}</ion-label>
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>
        <div
          v-for="order in searchResults"
          :key="order.id"
          class="list-item queue-order-row"
          :role="selectMode ? 'button' : 'link'"
          tabindex="0"
          @click="handleOrderRowClick(order)"
          @keydown.enter.prevent="handleOrderRowClick(order)"
          @keydown.space.prevent="handleOrderRowClick(order)"
        >
          <ion-item lines="none">
            <ion-checkbox
              slot="start"
              :checked="selectedOrderIds.includes(order.id)"
              @click.stop
              @keydown.stop
              @ionChange="setOrderSelection(order.id, $event.detail.checked)"
            />
            <ion-label>
              <p class="overline">{{ order.id }}</p>
              {{ order.externalId || order.orderName || order.id }}
              <p>{{ statusDescription(order.status) }}</p>
            </ion-label>
          </ion-item>

          <ion-label class="tablet ion-text-start">
            {{ order.customerName || order.customerId || translate('Unknown customer') }}
            <p>{{ customerAddressLine(order) }}</p>
            <p v-if="customerAddressTrailingLine(order)">{{ customerAddressTrailingLine(order) }}</p>
          </ion-label>

          <ion-label class="tablet ion-text-start">
            {{ queueReasonLabel(order) }}
            <p>{{ queueRuleLabel(order) }}</p>
          </ion-label>

          <ion-label class="tablet">
            {{ formatDateTime(order.orderDate) }}
            <p>{{ orderedRelativeLabel(order.orderDate) }}</p>
          </ion-label>

          <ion-label class="queue-delivery ion-text-end">
            {{ estimatedDeliveryDateLabel(order) }}
            <p>{{ translate('Estimated delivery date') }}</p>
            <p v-if="estimatedDeliveryRelativeLabel(order)">{{ estimatedDeliveryRelativeLabel(order) }}</p>
          </ion-label>
        </div>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !searchResults.length"
        :title="translate(emptyTitle)"
        :message="translate(emptyMessage)"
      />

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading more orders')" />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="selectMode">
      <ion-toolbar>
        <ion-title size="small">{{ selectedOrderIds.length }} {{ translate('selected') }}</ion-title>
        <ion-buttons slot="end" class="bulk-action-buttons">
          <ion-button v-if="hasGlobalAction('brokerSelected')" :disabled="!selectedOrderIds.length" @click="openBrokerSelectedModal">
            {{ translate('Broker selected') }}
          </ion-button>
          <ion-button :disabled="!selectedOrderIds.length" @click="confirmCancelOrders">{{ translate('Cancel open items') }}</ion-button>
          <ion-button :disabled="!selectedOrderIds.length" @click="openEditShippingMethodModal">{{ translate('Edit shipping method') }}</ion-button>
          <ion-button :disabled="!selectedOrderIds.length" @click="openAddTaskModal">{{ translate('Add task') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
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
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  alertController,
  modalController,
  useIonRouter,
} from '@ionic/vue';
import { api, translate } from '@common';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { searchOrders } from '@/services/order';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useOrderTaskStore } from '@/store/orderTask';
import { useProductStore } from '@/store/productStore';
import { useSeedStore } from '@/store/seed';
import type { Order } from '@/types/order';
import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import EditShippingMethodModal from '@/components/fulfillment/EditShippingMethodModal.vue';
import RoutingGroupModal from '@/components/fulfillment/RoutingGroupModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import { showToast } from '@/utils';

type QueueGlobalAction = 'brokerSelected';

const props = defineProps<{
  // Facility IDs that scope this queue. This preset is always applied and is not user-removable.
  facilityIds: string[];
  title: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyMessage: string;
  globalActions?: QueueGlobalAction[];
}>();
const emit = defineEmits<{
  (e: 'clearFilters'): void;
}>();
const orderDetailStore = useOrderDetailStore();
const orderTaskStore = useOrderTaskStore();
const productStore = useProductStore();
const seedStore = useSeedStore();
const ionRouter = useIonRouter();

const PAGE_SIZE = 50;

const searchQuery = ref('');
const searchFilters = ref({
  channel: 'All',
  shipmentMethodTypeId: 'All',
  dateFrom: '',
  dateThru: '',
});
const searchResults = ref<Order[]>([]);
const searchTotal = ref(0);
const pageIndex = ref(0);
const loading = ref(false);
const error = ref('');
const debounceTimer = ref<ReturnType<typeof setTimeout>>();
const selectMode = ref(false);
const selectedOrderIds = ref<string[]>([]);

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const shipmentMethodOptions = computed(() => seedStore.getShipmentMethodOptions);
const selectedProductStoreId = computed(() => productStore.getCurrentProductStore?.productStoreId || 'All');
const hasMore = computed(() => searchResults.value.length < searchTotal.value);

const currentPageOrderIds = computed(() => searchResults.value.map((order) => order.id));
const allCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.length > 0 && currentPageOrderIds.value.every((orderId) => selectedOrderIds.value.includes(orderId));
});
const someCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.some((orderId) => selectedOrderIds.value.includes(orderId));
});

function hasGlobalAction(action: QueueGlobalAction): boolean {
  return props.globalActions?.includes(action) ?? false;
}

onMounted(runSearch);

watch(searchQuery, scheduleSearch);
watch(() => props.facilityIds, () => runSearch(), { deep: true });
watch(searchFilters, () => runSearch(), { deep: true });
watch(searchResults, () => {
  const currentOrderIds = new Set(currentPageOrderIds.value);
  selectedOrderIds.value = selectedOrderIds.value.filter((orderId) => currentOrderIds.has(orderId));
});

function toSearchParams(page: number) {
  return {
    queryString: searchQuery.value,
    channel: searchFilters.value.channel,
    shipmentMethodTypeId: searchFilters.value.shipmentMethodTypeId,
    productStoreId: selectedProductStoreId.value,
    facilityIds: props.facilityIds,
    dateFrom: searchFilters.value.dateFrom,
    dateThru: searchFilters.value.dateThru,
    sort: 'orderDate desc',
    pageSize: PAGE_SIZE,
    pageIndex: page,
  };
}

async function runSearch() {
  loading.value = true;
  error.value = '';
  try {
    const result = await searchOrders(toSearchParams(0));
    pageIndex.value = 0;
    searchResults.value = result.orders;
    searchTotal.value = result.total;
  } catch (err: any) {
    error.value = err?.message || translate('Failed to load orders');
  } finally {
    loading.value = false;
  }
}

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(runSearch, 300);
}

async function loadMore(event: CustomEvent) {
  if (!loading.value && hasMore.value) {
    try {
      const nextPageIndex = pageIndex.value + 1;
      const result = await searchOrders(toSearchParams(nextPageIndex));
      pageIndex.value = nextPageIndex;
      searchResults.value = [...searchResults.value, ...result.orders];
      searchTotal.value = result.total;
    } catch (err: any) {
      error.value = err?.message || translate('Failed to load orders');
    }
  }
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

async function confirmCancelOrders() {
  const orderIds = [...selectedOrderIds.value];
  const alert = await alertController.create({
    header: translate('Cancel open items'),
    message: translate('This will cancel all open items for the {count} selected order(s). This action cannot be undone.', { count: orderIds.length }),
    buttons: [
      { text: translate('Dismiss'), role: 'cancel' },
      {
        text: translate('Confirm'),
        handler: async () => {
          try {
            await orderDetailStore.bulkCancelOrders(orderIds);
            await showToast(translate('Orders cancelled successfully.'));
            exitSelectMode();
            await runSearch();
          } catch {
            await showToast(translate('Failed to cancel orders. Please try again.'));
          }
        },
      },
    ],
  });
  await alert.present();
}

async function openAddTaskModal() {
  const orderIds = [...selectedOrderIds.value];
  const modal = await modalController.create({ component: AddOrderTaskModal });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data) return;
  try {
    await orderDetailStore.bulkCreateOrderTasks(orderIds, data);
    await showToast(translate('Tasks created successfully.'));
    exitSelectMode();
  } catch {
    await showToast(translate('Failed to create tasks. Please try again.'));
  }
}

async function openEditShippingMethodModal() {
  const orderIds = [...selectedOrderIds.value];
  const modal = await modalController.create({ component: EditShippingMethodModal });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data) return;
  try {
    await orderDetailStore.bulkUpdateShippingMethods(orderIds, data.carrierPartyId, data.shipmentMethodTypeId);
    await showToast(translate('Shipping method updated successfully.'));
    exitSelectMode();
    await runSearch();
  } catch {
    await showToast(translate('Failed to update shipping method. Please try again.'));
  }
}

async function openBrokerSelectedModal() {
  const orderIds = [...selectedOrderIds.value];
  const productStoreId = productStore.getCurrentProductStore?.productStoreId;

  if (!productStoreId || productStoreId === 'All') {
    await showToast(translate('Select a product store before brokering orders.'));
    return;
  }

  const modal = await modalController.create({ component: RoutingGroupModal, componentProps: { productStoreId } });
  await modal.present();
  const { data: routingGroupId } = await modal.onWillDismiss();
  if (!routingGroupId) return;

  await brokerSelectedOrderShipGroups(orderIds, routingGroupId, productStoreId);
}

async function brokerSelectedOrderShipGroups(orderIds: string[], routingGroupId: string, productStoreId: string) {
  loading.value = true;
  try {
    const brokerableShipGroups = await brokerableShipGroupsForOrders(orderIds);
    if (!brokerableShipGroups.length) {
      await showToast(translate('No brokerable ship groups found for the selected orders.'));
      return;
    }

    const results = await Promise.allSettled(
      brokerableShipGroups.map((shipGroup) =>
        orderTaskStore.brokerShipGroup({
          routingGroupId,
          orderId: shipGroup.orderId,
          shipGroupSeqId: shipGroup.shipGroupSeqId,
          productStoreId,
        })
      )
    );
    const failureCount = results.filter((result) => result.status === 'rejected').length;
    const successCount = results.length - failureCount;

    if (successCount) {
      await showToast(translate('{count} ship group(s) brokered successfully.', { count: successCount }));
      exitSelectMode();
      await runSearch();
    }
    if (failureCount) {
      await showToast(translate('{count} ship group(s) could not be brokered. Please try again.', { count: failureCount }));
    }
  } catch {
    await showToast(translate('Failed to broker selected orders. Please try again.'));
  } finally {
    loading.value = false;
  }
}

async function brokerableShipGroupsForOrders(orderIds: string[]) {
  const shipGroupsByOrder = await Promise.all(
    orderIds.map(async (orderId) => ({
      orderId,
      shipGroups: await fetchOrderShipGroups(orderId),
    }))
  );

  return shipGroupsByOrder.flatMap(({ orderId, shipGroups }) =>
    shipGroups
      .filter(isVirtualShipGroup)
      .map((shipGroup) => ({ orderId, shipGroupSeqId: shipGroupSeqId(shipGroup) }))
      .filter((shipGroup) => shipGroup.shipGroupSeqId)
  );
}

async function fetchOrderShipGroups(orderId: string) {
  const response = await api({ url: `oms/orders/${orderId}/shipGroups`, method: 'GET' });
  return Array.isArray(response.data) ? response.data : (response.data?.docs || response.data?.shipGroups || []);
}

function shipGroupSeqId(shipGroup: any) {
  return shipGroup.shipGroupSeqId || shipGroup.id || '';
}

function isVirtualShipGroup(shipGroup: any) {
  const facilityId = shipGroup.facilityId || shipGroup.facility?.facilityId || '';
  if (!facilityId) return true;

  const facility = seedStore.facility(facilityId);
  const facilityTypeId = shipGroup.facilityTypeId || shipGroup.facility?.facilityTypeId || facility?.facilityTypeId;
  const parentTypeId = shipGroup.facilityParentTypeId || shipGroup.parentFacilityTypeId || seedStore.facilityType(facilityTypeId)?.parentTypeId;

  return facilityTypeId === 'VIRTUAL_FACILITY' || parentTypeId === 'VIRTUAL_FACILITY';
}
function clearFilters() {
  searchQuery.value = '';
  selectedOrderIds.value = [];
  searchFilters.value = {
    channel: 'All',
    shipmentMethodTypeId: 'All',
    dateFrom: '',
    dateThru: '',
  };
  emit('clearFilters');
}

function exitSelectMode() {
  selectMode.value = false;
  selectedOrderIds.value = [];
}

function toggleSelectMode() {
  if (selectMode.value) {
    exitSelectMode();
    return;
  }

  selectMode.value = true;
}

function toggleCurrentPageSelection(checked: boolean) {
  selectedOrderIds.value = checked ? [...currentPageOrderIds.value] : [];
}

function toggleOrderSelection(orderId: string) {
  if (!selectMode.value) return;
  setOrderSelection(orderId, !selectedOrderIds.value.includes(orderId));
}

function handleOrderRowClick(order: Order) {
  if (selectMode.value) {
    toggleOrderSelection(order.id);
    return;
  }

  ionRouter.push(orderDetailLink(order));
}

function setOrderSelection(orderId: string, checked: boolean) {
  if (checked) {
    if (!selectedOrderIds.value.includes(orderId)) selectedOrderIds.value = [...selectedOrderIds.value, orderId];
    selectMode.value = true;
    return;
  }

  selectedOrderIds.value = selectedOrderIds.value.filter((selectedOrderId) => selectedOrderId !== orderId);
  if (!selectedOrderIds.value.length) selectMode.value = false;
}

function orderDetailLink(order: Order) {
  return `/orders/${order.id}`;
}

function statusDescription(statusId: string) {
  return seedStore.statusDescription(statusId);
}

function hasParkingUnitCount(order: Order) {
  return Number(order.parkingUnitCount ?? 0) > 0;
}

function parkingUnitCountLabel(order: Order) {
  const unitCount = Number(order.parkingUnitCount ?? 0);
  const formattedUnitCount = Number.isInteger(unitCount) ? String(unitCount) : unitCount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const unitLabel = unitCount === 1 ? translate('unit') : translate('units');

  return `${formattedUnitCount} ${unitLabel} ${translate('in parking')}`;
}

function customerAddressLine(order: Order) {
  return order.shippingAddress1 || order.customerId || order.externalId || '';
}

function customerAddressTrailingLine(order: Order) {
  const parts = [
    order.shippingCity,
    order.shippingStateProvinceGeoId,
    order.shippingPostalCode,
    order.shippingCountryGeoId
  ].filter(Boolean);

  if (parts.length) return parts.join(' ');
  return order.shippingAddress1 ? '' : order.externalId;
}

function queueReasonLabel(order: Order) {
  return order.queueReason || order.rejectionReason || translate('Reason unavailable');
}

function queueRuleLabel(order: Order) {
  if (order.ruleName) return order.ruleName;
  if (hasParkingUnitCount(order)) return parkingUnitCountLabel(order);

  return translate('Rule name unavailable');
}

function estimatedDeliveryValue(order: Order) {
  return order.estimatedDeliveryDate || order.shipBeforeDate || order.shipByDate || '';
}

function estimatedDeliveryDateLabel(order: Order) {
  const date = dateFromValue(estimatedDeliveryValue(order));
  return date ? date.toFormat('MM-dd-yyyy') : translate('No delivery date');
}

function estimatedDeliveryRelativeLabel(order: Order) {
  const date = dateFromValue(estimatedDeliveryValue(order));
  return date?.toRelative() || '';
}

function orderedRelativeLabel(orderDateValue: string) {
  const date = dateFromValue(orderDateValue);
  const relativeDate = date?.toRelative();
  return relativeDate ? `${translate('Ordered')} ${relativeDate}` : '';
}

function formatDateTime(value: string) {
  const date = dateFromValue(value);
  return date ? date.toFormat('MM-dd-yyyy hh:mm a') : '';
}

function dateFromValue(value?: string | null) {
  if (!value) return undefined;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    const numericDate = DateTime.fromMillis(value.length <= 10 ? numericValue * 1000 : numericValue);
    if (numericDate.isValid) return numericDate;
  }

  const sqlDate = DateTime.fromSQL(value);
  if (sqlDate.isValid) return sqlDate;

  const isoDate = DateTime.fromISO(value);
  return isoDate.isValid ? isoDate : undefined;
}
</script>

<style scoped>
.order-results-header {
  align-items: center;
  display: flex;
  gap: 8px;
}

.order-results-header-start {
  display: flex;
  min-width: 24px;
}

.bulk-action-buttons {
  overflow-x: auto;
}

.queue-order-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
  min-height: 5rem;
  border-block-start: var(--border-medium);
  padding-inline-end: var(--spacer-sm);
}

.queue-order-row > ion-label {
  width: 100%;
}

.queue-order-row > ion-label.queue-delivery {
  display: block;
  justify-self: end;
  max-width: 10rem;
  min-width: 10rem;
  width: 10rem;
}
</style>
