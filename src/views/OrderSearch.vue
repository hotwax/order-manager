<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Find orders') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Order, external ID, customer, email')"
        @clear="clearFilters"
      >
        <ion-item id="order-status-filter-trigger" button lines="none">
          <ion-label>
            <p>Status</p>
            <h3>{{ statusFilterLabel }}</h3>
          </ion-label>
        </ion-item>
        <ion-popover trigger="order-status-filter-trigger" trigger-action="click">
          <ion-content>
            <ion-list>
              <ion-item lines="none">
                <ion-checkbox
                  :checked="!selectedStatusIds.length"
                  justify="start"
                  label-placement="end"
                  @ionChange="setAllStatusesFilter(Boolean($event.detail.checked))"
                >
                  {{ translate('All statuses') }}
                </ion-checkbox>
              </ion-item>
              <ion-item v-for="option in orderStatuses" :key="option.statusId" lines="none">
                <ion-checkbox
                  :checked="selectedStatusIds.includes(option.statusId)"
                  justify="start"
                  label-placement="end"
                  @ionChange="setStatusFilter(option.statusId, Boolean($event.detail.checked))"
                >
                  {{ option.description || option.statusId }}
                </ion-checkbox>
              </ion-item>
            </ion-list>
          </ion-content>
        </ion-popover>
        <ion-input v-model="searchFilters.dateFrom" label="Order date from" label-placement="stacked" type="date" />
        <ion-input v-model="searchFilters.dateThru" label="Order date thru" label-placement="stacked" type="date" />
        <ion-select v-model="searchFilters.channel" label="Channel" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All channels</ion-select-option>
          <ion-select-option v-for="option in salesChannels" :key="option.enumId" :value="option.enumId">
            {{ option.description || option.enumName || option.enumId }}
          </ion-select-option>
        </ion-select>
        <ion-select v-model="searchSort" label="Sort by order date" label-placement="stacked" interface="popover">
          <ion-select-option value="orderDate desc">{{ translate('Newest first') }}</ion-select-option>
          <ion-select-option value="orderDate asc">{{ translate('Oldest first') }}</ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        title="Order search failed"
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
          <ion-button v-if="canUseBulkActions" fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>
        <ion-item
          v-for="order in searchResults"
          :key="order.id"
          :button="selectMode"
          :router-link="selectMode ? undefined : `/orders/${order.id}`"
          @click="toggleOrderSelection(order.id)"
        >
          <ion-checkbox
            v-if="selectMode"
            slot="start"
            :checked="selectedOrderIds.includes(order.id)"
            @click.stop
            @ionChange="setOrderSelection(order.id, $event.detail.checked)"
          />
          <ion-label>
            <h2>{{ order.externalId || order.id }}</h2>
            <p>{{ order.id }} · {{ order.customerName || order.customerId || translate('Unknown customer') }}</p>
            <p>{{ createdDateLabel(order.orderDate) }} · {{ translate('Ship') }} {{ shipTimeLeftLabel(order.orderDate) }}</p>
          </ion-label>
          <ion-badge :color="statusColor(order.status)" slot="end">
            {{ statusDescription(order.status) }}
          </ion-badge>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!loading && !error && !searchResults.length"
        :title="translate('No matching orders')"
        :message="translate('Adjust the search text or filters to broaden the order list.')"
      />

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading more orders')" />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="selectMode">
      <ion-toolbar>
        <ion-title size="small">{{ selectedOrderIds.length }} {{ translate('selected') }}</ion-title>
        <ion-buttons slot="end" class="bulk-action-buttons">
          <ion-button :disabled="!selectedOrderIds.length || !canCancelOrders" @click="confirmCancelOrders">{{ translate('Cancel open items') }}</ion-button>
          <ion-button :disabled="!selectedOrderIds.length || !canUpdateOrders" @click="openEditShippingMethodModal">{{ translate('Edit shipping method') }}</ion-button>
          <ion-button :disabled="!selectedOrderIds.length || !canCreateOrderTasks" @click="openAddTaskModal">{{ translate('Add task') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
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
  IonPopover,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  alertController,
  modalController,
} from '@ionic/vue';
import { commonUtil, translate } from '@common';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useOrderStore } from '@/store/order';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useUserStore } from '@/store/user';
import { useSeedStore } from '@/store/seed';
import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import EditShippingMethodModal from '@/components/fulfillment/EditShippingMethodModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import { showToast } from '@/utils';
import {
  ORDER_CANCEL_PERMISSION,
  ORDER_TASK_CREATE_PERMISSION,
  ORDER_UPDATE_PERMISSION
} from '@/authorization/permissions';

const orderStore = useOrderStore();
const orderDetailStore = useOrderDetailStore();
const userStore = useUserStore();
const seedStore = useSeedStore();
const { searchQuery, searchFilters, searchSort, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(orderStore);
const debounceTimer = ref<ReturnType<typeof setTimeout>>();
const selectMode = ref(false);
const selectedOrderIds = ref<string[]>([]);

const orderStatuses = computed(() => seedStore.getStatusItemsByType('ORDER_STATUS'));
const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const selectedProductStoreId = computed(() => userStore.currentProductStore?.productStoreId || 'All');
const selectedStatusIds = computed(() => {
  const status = searchFilters.value.status as string[] | string;
  if (Array.isArray(status)) return status;

  return status && status !== 'All' ? [status] : [];
});
const statusFilterLabel = computed(() => {
  if (!selectedStatusIds.value.length) return translate('All statuses');
  if (selectedStatusIds.value.length === 1) return statusDescription(selectedStatusIds.value[0]);

  return `${selectedStatusIds.value.length} ${translate('statuses')}`;
});
const currentPageOrderIds = computed(() => searchResults.value.map((order) => order.id));
const allCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.length > 0 && currentPageOrderIds.value.every((orderId) => selectedOrderIds.value.includes(orderId));
});
const someCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.some((orderId) => selectedOrderIds.value.includes(orderId));
});
const canCancelOrders = computed(() => userStore.hasPermission(ORDER_CANCEL_PERMISSION));
const canUpdateOrders = computed(() => userStore.hasPermission(ORDER_UPDATE_PERMISSION));
const canCreateOrderTasks = computed(() => userStore.hasPermission(ORDER_TASK_CREATE_PERMISSION));
const canUseBulkActions = computed(() => canCancelOrders.value || canUpdateOrders.value || canCreateOrderTasks.value);

onMounted(async () => {
  orderStore.searchFilters.productStoreId = selectedProductStoreId.value;
  await orderStore.runSearch();
});

watch(searchQuery, () => {
  scheduleSearch();
});

watch(searchFilters, () => {
  orderStore.runSearch();
}, { deep: true });

watch(searchSort, () => {
  orderStore.runSearch();
});

watch(searchResults, () => {
  const currentOrderIds = new Set(currentPageOrderIds.value);
  selectedOrderIds.value = selectedOrderIds.value.filter((orderId) => currentOrderIds.has(orderId));
});

function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => orderStore.runSearch(), 300);
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
            await orderStore.runSearch();
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
    await orderStore.runSearch();
  } catch {
    await showToast(translate('Failed to update shipping method. Please try again.'));
  }
}

function clearFilters() {
  orderStore.searchQuery = '';
  orderStore.searchSort = 'orderDate desc';
  selectedOrderIds.value = [];
  orderStore.searchFilters = {
    status: [],
    channel: 'All',
    productStoreId: selectedProductStoreId.value,
    dateFrom: '',
    dateThru: '',
  };
}

async function loadMore(event: CustomEvent) {
  await orderStore.appendNextPage();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

function enterSelectMode() {
  selectMode.value = true;
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

  enterSelectMode();
}

function toggleCurrentPageSelection(checked: boolean) {
  selectedOrderIds.value = checked ? [...currentPageOrderIds.value] : [];
}

function toggleOrderSelection(orderId: string) {
  if (!selectMode.value) return;
  setOrderSelection(orderId, !selectedOrderIds.value.includes(orderId));
}

function setOrderSelection(orderId: string, checked: boolean) {
  if (checked) {
    if (!selectedOrderIds.value.includes(orderId)) selectedOrderIds.value = [...selectedOrderIds.value, orderId];
    return;
  }

  selectedOrderIds.value = selectedOrderIds.value.filter((selectedOrderId) => selectedOrderId !== orderId);
}

function clearStatusFilter() {
  searchFilters.value.status = [];
}

function setAllStatusesFilter(checked: boolean) {
  if (checked) clearStatusFilter();
}

function setStatusFilter(statusId: string, checked: boolean) {
  const nextStatusIds = new Set(selectedStatusIds.value);

  if (checked) nextStatusIds.add(statusId);
  else nextStatusIds.delete(statusId);

  searchFilters.value.status = [...nextStatusIds];
}

function statusDescription(statusId: string) {
  return seedStore.statusDescription(statusId);
}

function statusColor(statusId: string) {
  const label = statusDescription(statusId);
  return commonUtil.getColorByDesc(label) || commonUtil.getColorByDesc(statusId) || commonUtil.getColorByDesc('default');
}

function createdDateLabel(value: string) {
  const date = parseOrderDate(value);
  if (!date?.isValid) return value || 'Date unavailable';

  const now = DateTime.now();
  if (date.hasSame(now, 'day')) {
    const hoursAgo = Math.max(0, Math.floor(now.diff(date, 'hours').hours));
    if (hoursAgo < 1) return 'Created less than 1h ago';
    return `Created ${hoursAgo}h ago`;
  }

  return `Created ${date.toLocaleString(DateTime.DATE_MED)}`;
}

function shipTimeLeftLabel(value: string) {
  const date = parseOrderDate(value);
  if (!date?.isValid) return 'time unavailable';

  const shipBy = date.plus({ hours: 24 });
  const minutesLeft = Math.ceil(shipBy.diffNow('minutes').minutes);

  if (minutesLeft <= 0) return 'overdue';
  if (minutesLeft < 60) return `in ${minutesLeft}m`;

  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  return minutes ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
}

function parseOrderDate(value: string) {
  if (!value) return undefined;

  if (/^\d+$/.test(value)) {
    const numericValue = Number(value);
    return DateTime.fromMillis(value.length <= 10 ? numericValue * 1000 : numericValue);
  }

  return DateTime.fromISO(value);
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
</style>
