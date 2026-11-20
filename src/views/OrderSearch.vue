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
        :show-clear="false"
        @clear="clearFilters"
      >
        <UniformFilterLayout @clear="clearFilters">
          <ion-input
            id="order-status-filter-trigger"
            class="order-status-filter-trigger"
            :label="translate('Status')"
            label-placement="stacked"
            fill="outline"
            :value="statusFilterLabel"
            readonly
          >
            <ion-icon slot="end" :icon="chevronDownOutline" color="medium" aria-hidden="true" />
          </ion-input>
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

          <ion-select
            v-model="searchFilters.allocationState"
            :label="translate('Allocation state')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
          >
            <ion-select-option value="All">{{ translate('All locations') }}</ion-select-option>
            <ion-select-option value="Allocated">{{ translate('Allocated') }}</ion-select-option>
            <ion-select-option value="AwaitingBrokering">{{ translate('Awaiting brokering') }}</ion-select-option>
            <ion-select-option value="Unfillable">{{ translate('Unfillable') }}</ion-select-option>
            <ion-select-option value="Archived">{{ translate('Archived') }}</ion-select-option>
          </ion-select>

          <ion-select
            v-model="searchFilters.channel"
            :label="translate('Sales channel')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
          >
            <ion-select-option value="All">{{ translate('All channels') }}</ion-select-option>
            <ion-select-option v-for="option in salesChannels" :key="option.enumId" :value="option.enumId">
              {{ option.description || option.enumName || option.enumId }}
            </ion-select-option>
          </ion-select>

          <ion-select
            v-model="searchFilters.shipmentMethodTypeId"
            :label="translate('Shipping method')"
            label-placement="stacked"
            fill="outline"
            interface="popover"
          >
            <ion-select-option value="All">{{ translate('All methods') }}</ion-select-option>
            <ion-select-option v-for="option in shipmentMethodOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </ion-select-option>
          </ion-select>

          <DateFilterSelect
            v-model="searchFilters.dateFrom"
            :label="translate('Order date from')"
            :max="searchFilters.dateThru"
            outlined
          />
          <DateFilterSelect
            v-model="searchFilters.dateThru"
            :label="translate('Order date through')"
            :min="searchFilters.dateFrom"
            outlined
          />
        </UniformFilterLayout>
      </SearchFilterCard>

      <ion-progress-bar v-if="loading" type="indeterminate" />

      <ErrorState
        v-if="error"
        :title="translate('Could not load orders')"
        :message="error"
        retryable
        @retry="runSearch()"
      />

      <ion-list v-else>
        <!-- Hidden at zero, where the empty state says it better than "0 of 0". -->
        <FindResultsHeader
          v-if="searchResults.length"
          :count-label="translate('{shown} of {count} matching orders', { shown: searchResults.length, count: searchTotal })"
          :select-all-label="translate('Select all loaded orders')"
          :select-mode="selectMode"
          :all-selected="allSelected"
          :some-selected="someSelected"
          @select-all="selectAll"
          @toggle-select-mode="toggleSelectMode"
        >
          <OrderSortPopover v-model="searchSort" trigger-id="find-order-sort-trigger" />
        </FindResultsHeader>
        <OrderRow
          v-for="order in searchResults"
          :key="order.id"
          :model="toSearchOrderRowViewModel(order)"
          :select-mode="selectMode"
          :selected="selected.has(order.id)"
          @activate="handleOrderRowClick(order)"
          @selection-change="setSelected(order.id, $event)"
        />
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

    <BulkSelectionFooter
      v-if="selectMode"
      :count="selectedOrderIds.length"
      :disabled="loading || Boolean(error)"
      :build-csv="buildOrdersCsv"
      filename="selected-orders.csv"
      :actions="bulkActions"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
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
import { commonUtil, logger, translate } from '@common';
import { chevronDownOutline } from 'ionicons/icons';
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useOrderStore, DEFAULT_ORDER_SEARCH_SORT } from '@/store/order';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useUserStore } from '@/store/user';
import { useProductStore } from '@/store/productStore';
import { useSeedData } from '@common/db';
import router from '@/router';
import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import EditShippingMethodModal from '@/components/fulfillment/EditShippingMethodModal.vue';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';

import UniformFilterLayout from '@/components/common/UniformFilterLayout.vue';
import OrderSortPopover from '@/components/orders/OrderSortPopover.vue';
import OrderRow from '@/components/orders/OrderRow.vue';
import { toSearchOrderRowViewModel } from '@/utils/orderRows';
import { buildSelectedOrdersCsv } from '@/utils/findExport';
import { useFindSelection } from '@/composables/useFindSelection';
import BulkSelectionFooter from '@/components/common/BulkSelectionFooter.vue';
import FindResultsHeader from '@/components/common/FindResultsHeader.vue';
import { showToast } from '@/utils';
import { HIDE_SHOPIFY_UNSYNCED_ACTIONS } from '@/config/featureFlags';
import Actions from "@/authorization/actions";

const seed = useSeedData();
const orderStore = useOrderStore();
const orderDetailStore = useOrderDetailStore();
const userStore = useUserStore();
const productStore = useProductStore();
const { searchQuery, searchFilters, searchSort, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(orderStore);

const {
  selectMode, selectedIds: selectedOrderIds, selected, allSelected, someSelected,
  setSelected, toggleSelected, selectAll, clearSelection, exitSelectMode, toggleSelectMode
} = useFindSelection(computed(() => searchResults.value.map((order) => order.id)));

function handleOrderRowClick(order: any) {
  if (selectMode.value) {
    toggleSelected(order.id);
  } else {
    router.push(`/orders/${order.id}`);
  }
}
const debounceTimer = ref<ReturnType<typeof setTimeout>>();

const orderStatuses = computed(() => seed.statusItemsByType('ORDER_STATUS'));
const salesChannels = computed(() => seed.enumsByType('ORDER_SALES_CHANNEL'));
const shipmentMethodOptions = computed(() => seed.shipmentMethodOptions());

const selectedProductStoreId = computed(() => productStore.getCurrentProductStore?.productStoreId || 'All');
const selectedStatusIds = computed(() => {
  const status = searchFilters.value.status as string[] | string;
  if (Array.isArray(status)) return status;

  return status && status !== 'All' ? [status] : [];
});
const statusFilterLabel = computed(() => {
  if (!selectedStatusIds.value.length) return translate('All statuses');
  if (selectedStatusIds.value.length === 1) return statusDescription(selectedStatusIds.value[0]);

  return translate('{count} statuses', { count: selectedStatusIds.value.length });
});
const canCancelOrders = computed(() => userStore.hasPermission(Actions.APP_ORDER_CANCEL));
const canUpdateOrders = computed(() => userStore.hasPermission(Actions.APP_ORDER_UPDATE));
const canCreateOrderTasks = computed(() => userStore.hasPermission(Actions.APP_ORDER_TASK_CREATE));

const bulkActions = computed(() => [
  ...(!HIDE_SHOPIFY_UNSYNCED_ACTIONS && canCancelOrders.value
    ? [{ id: 'cancelOrders', label: translate('Cancel open items'), destructive: true, run: confirmCancelOrders }]
    : []),
  ...(canUpdateOrders.value
    ? [{ id: 'shipping', label: translate('Edit shipping method'), run: openEditShippingMethodModal }]
    : []),
  ...(canCreateOrderTasks.value
    ? [{ id: 'task', label: translate('Add task'), run: openAddTaskModal }]
    : [])
]);


onMounted(async () => {
  orderStore.searchFilters.productStoreId = selectedProductStoreId.value;
  await runSearch();
});

watch(selectedProductStoreId, () => {
  orderStore.searchFilters.productStoreId = selectedProductStoreId.value;
});

watch(searchQuery, () => {
  scheduleSearch();
});

watch(searchFilters, () => {
  runSearch();
}, { deep: true });

watch(searchSort, () => {
  runSearch();
});

/** The order search with the facility type rows its rows' virtual-location checks need. */
async function runSearch() {
  return orderStore.runSearch(await seed.getFacilityTypes().catch(() => []));
}
function scheduleSearch() {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => runSearch(), 300);
}

function buildOrdersCsv() {
  return buildSelectedOrdersCsv(searchResults.value, selectedOrderIds.value);
}

async function confirmCancelOrders() {
  const orderIds = [...selectedOrderIds.value];
  const alert = await alertController.create({
    header: translate('Cancel open items'),
    message: translate('This will cancel all open items for the {count} selected orders. This action cannot be undone.', { count: orderIds.length }),
    buttons: [
      { text: translate('Keep items'), role: 'cancel' },
      {
        text: translate('Cancel open items'),
        role: 'confirm',
        handler: async () => {
          try {
            await orderDetailStore.bulkCancelOrders(orderIds);
            await showToast(translate('Orders cancelled successfully.'));
            exitSelectMode();
            await runSearch();
          } catch (err) {
            const serverError = commonUtil.getErrorMessage(err);
            logger.error(err);
            await showToast(`${translate('Failed to cancel orders. Please try again.')} ${serverError}`);
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
  } catch (err) {
    const serverError = commonUtil.getErrorMessage(err);
    logger.error(err);
    await showToast(`${translate('Failed to create tasks. Please try again.')} ${serverError}`);
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
  } catch (err) {
    const serverError = commonUtil.getErrorMessage(err);
    logger.error(err);
    await showToast(`${translate('Failed to update shipping method. Please try again.')} ${serverError}`);
  }
}

function clearFilters() {
  orderStore.searchQuery = '';
  orderStore.searchSort = DEFAULT_ORDER_SEARCH_SORT;
  clearSelection();
  orderStore.searchFilters = {
    status: [],
    channel: 'All',
    shipmentMethodTypeId: 'All',
    allocationState: 'All',
    productStoreId: selectedProductStoreId.value,
    dateFrom: '',
    dateThru: '',
    hasVirtualFacilityItems: false,
    archivedOnly: false,
  };
}

async function loadMore(event: CustomEvent) {
  await orderStore.appendNextPage(await seed.getFacilityTypes().catch(() => []));
  (event.target as HTMLIonInfiniteScrollElement).complete();
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
  return seed.statusDescription(statusId);
}

</script>

<style scoped>
.order-status-filter-trigger {
  cursor: pointer;
}

</style>
