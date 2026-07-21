<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Swap') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <OrderTaskFilterCard
        v-model="filters"
        :channel-options="channelOptions"
        :facility-options="facilityOptions"
        :shipment-method-options="shipmentMethodOptions"
        show-ship-group-filters
        @search="replaceSwapTasks"
        @clear="clearFilters"
      />

      <!-- Refetch over already-rendered cards: keep them visible, show a thin
           progress bar instead of swapping in the full-page spinner. -->
      <ion-progress-bar v-if="isRefetching" type="indeterminate" />

      <!-- First load with nothing to show yet: full-page spinner. -->
      <div v-if="isFirstLoading" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>

      <!-- First-load failure: explicit, retryable error state. -->
      <ErrorState
        v-else-if="isErrored"
        :title="translate('Could not load swap tasks')"
        :message="errorMessage"
        retryable
        @retry="fetchSwapTasks()"
      />

      <template v-else>
        <TaskQueueListHeader
          :loaded-count="swapTasks.length"
          :total-count="swapTotal"
          singular-label="swap task"
          plural-label="swap tasks"
          :sort="filters.sort"
          :sort-options="sortOptions"
          trigger-id="swap-task-sort"
          :select-mode="selectMode"
          :all-loaded-selected="allLoadedSelected"
          :some-loaded-selected="someLoadedSelected"
          @update:sort="filters.sort = $event"
          @toggle-select-mode="toggleSelectMode"
          @toggle-loaded-selection="toggleLoadedSelection"
        />

        <div class="swap-order-list">
          <SwapTaskCard
            v-for="task in swapTasks"
            :key="task.workEffortId"
            :ref="(element) => setCardRef(task.workEffortId, element)"
            :task="task"
            :selectable="selectMode"
            :selected="!!selectedTasks[task.workEffortId]"
            show-view-order-action
            @update:selected="selectedTasks[task.workEffortId] = $event"
            @completed="replaceSwapTasks"
          />
          <TaskQueueEmptyState
            v-if="!swapTasks.length && isSuccess && hasFilters"
            kind="swap"
            filtered
            @clear="clearFilters"
          />
          <SwapSetupPanel
            v-else-if="!swapTasks.length && isSuccess"
            :candidates="setupCandidates"
            :loading="setupLoading"
            :error="setupError"
            :can-manage-substitutes="canManageSubstitutes"
            :configured-product-ids="configuredProductIds"
            @manage="openSubstituteModal"
            @rebroker="rebrokerProductOrders"
            @retry="loadSetupCandidates"
          />
        </div>

       <ion-infinite-scroll
          @ionInfinite="loadMoreSwapTasks($event)"
          threshold="100px"
          v-if="isScrollable"
        >
          <ion-infinite-scroll-content
            loading-spinner="crescent"
            :loading-text="translate('Loading')"
          />
        </ion-infinite-scroll>
      </template>
    </ion-content>

    <ion-footer v-if="selectMode">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button color="danger" :disabled="!hasSelectedTasks || bulkActionRunning" @click="bulkCancelOrders">
            {{ translate('Cancel orders') }}
          </ion-button>
          <ion-button color="medium" :disabled="!hasSelectedTasks || bulkActionRunning" @click="bulkParkOrders">
            {{ translate('Park') }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonMenuButton, IonPage, IonProgressBar, IonSpinner, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import ErrorState from '@/components/common/ErrorState.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import OrderTaskFilterCard from '@/components/tasks/OrderTaskFilterCard.vue';
import TaskQueueListHeader from '@/components/tasks/TaskQueueListHeader.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import { useOrderTaskRouteState } from '@/composables/useOrderTaskRouteState';
import { usePhysicalFacilityOptions } from '@/composables/usePhysicalFacilityOptions';
import { buildTaskQueueRequest, hasTaskFilters } from '@/utils/orderTaskFilters';
import { defaultOrderTaskFilters, taskSortOptions, type TaskFilterOption } from '@/types/orderTaskFilters';
import TaskQueueEmptyState from '@/components/tasks/TaskQueueEmptyState.vue';
import SubstituteRelationshipModal from '@/components/swaps/SubstituteRelationshipModal.vue';
import SwapSetupPanel, { type SwapSetupCandidate } from '@/components/swaps/SwapSetupPanel.vue';
import RoutingGroupModal from '@/components/fulfillment/RoutingGroupModal.vue';
import { useProductMaster } from '@/composables/useProductMaster';
import { useProductCacheStore } from '@/store/productCache';
import { useProductStore } from '@/store/productStore';
import { useUserStore } from '@/store/user';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { PRODUCT_ASSOCIATION_UPDATE_PERMISSION } from '@/authorization/permissions';
import { fetchUnfillableProductCandidates, fetchUnfillableShipGroupsForProduct } from '@/services/order';
import { fetchActiveSubstitutes } from '@/services/productAssociations';
import { showToast } from '@/utils';
import { countTaskTargets, runGroupedTaskMutation, shipGroupTaskTarget } from '@/utils/orderTaskBulk';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();
const productStore = useProductStore();
const userStore = useUserStore();
const productCache = useProductCacheStore();
const productMaster = useProductMaster();

const filters = ref(defaultOrderTaskFilters());
useOrderTaskRouteState(filters, 'swap');
const { facilityOptions, loadPhysicalFacilities } = usePhysicalFacilityOptions();
const channelOptions = computed<TaskFilterOption[]>(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL').map((channel: any) => ({
  id: channel.enumId,
  label: channel.description || channel.enumId,
})));
const shipmentMethodOptions = computed<TaskFilterOption[]>(() => seedStore.getShipmentMethodOptions);
const sortOptions = taskSortOptions('swap');
const selectMode = ref(false);
const selectedTasks = ref<Record<string, boolean>>({});
const cardRefs = ref<Record<string, any>>({});
const bulkActionRunning = ref(false);
const setupCandidates = ref<SwapSetupCandidate[]>([]);
const setupLoading = ref(false);
const setupError = ref('');
const configuredProductIds = ref<string[]>([]);

const swapTasks = computed(() => orderTaskStore.getSwapTasks);
const swapTotal = computed(() => orderTaskStore.getSwapTotal);
const isScrollable = computed(() => orderTaskStore.isSwapTasksScrollable);
const hasFilters = computed(() => hasTaskFilters(filters.value));
const selectedTaskIds = computed(() => Object.entries(selectedTasks.value).filter(([, selected]) => selected).map(([id]) => id));
const hasSelectedTasks = computed(() => selectedTaskIds.value.length > 0);
const allLoadedSelected = computed(() => swapTasks.value.length > 0 && swapTasks.value.every((task: any) => selectedTasks.value[task.workEffortId]));
const someLoadedSelected = computed(() => swapTasks.value.some((task: any) => selectedTasks.value[task.workEffortId]));
const selectedProductStoreId = computed(() => productStore.getCurrentProductStore?.productStoreId || '');
const canManageSubstitutes = computed(() => userStore.hasPermission(PRODUCT_ASSOCIATION_UPDATE_PERMISSION));
const swapStatus = computed(() => orderTaskStore.getSwapStatus);
const errorMessage = computed(() => translate(orderTaskStore.getSwapError));
// First open / cleared list: nothing to show while the first page loads.
const isFirstLoading = computed(() => swapStatus.value === 'loading' && !swapTasks.value.length);
// Refetch with cards already on screen (filter change, search, post-action reload).
const isRefetching = computed(() => swapStatus.value === 'loading' && swapTasks.value.length > 0);
// Only take over the page when there's nothing to show; a failed refetch with
// cards on screen keeps the existing rows instead of blanking the queue.
const isErrored = computed(() => swapStatus.value === 'error' && !swapTasks.value.length);
const isSuccess = computed(() => swapStatus.value === 'success');

let suppressAutomaticFetch = false;
watch(() => [
  filters.value.salesChannelEnumId,
  filters.value.orderDateFrom,
  filters.value.orderDateThru,
  filters.value.taskCreatedFrom,
  filters.value.taskCreatedThru,
  filters.value.facilityId,
  filters.value.shipmentMethodTypeId,
  filters.value.sort,
], () => {
  if (!suppressAutomaticFetch) replaceSwapTasks();
}, { flush: 'sync' });

function clearFilters() {
  suppressAutomaticFetch = true;
  filters.value = defaultOrderTaskFilters();
  suppressAutomaticFetch = false;
  replaceSwapTasks();
}

const fetchSwapTasks = async (pageSize?: any, pageIndex?: any) => {
  const isFirstPage = !Number(pageIndex || 0);
  if (isFirstPage) resetSelection();
  // The store owns the load/error status and the product/stock enrichment, so it
  // only flips to `success` once the cards can render stably.
  await orderTaskStore.fetchSwapTasks(buildTaskQueueRequest(
    'swap',
    filters.value,
    pageSize ?? import.meta.env.VITE_VIEW_SIZE,
    pageIndex ?? 0,
  ));
  if (isFirstPage && isSuccess.value && !swapTasks.value.length && !hasFilters.value) {
    await loadSetupCandidates();
  }
};

function replaceSwapTasks() {
  return fetchSwapTasks(undefined, 0);
}

function setCardRef(workEffortId: string, element: any) {
  if (element) cardRefs.value[workEffortId] = element;
  else delete cardRefs.value[workEffortId];
}

function resetSelection() {
  selectedTasks.value = {};
  selectMode.value = false;
}

function toggleSelectMode() {
  if (selectMode.value) resetSelection();
  else selectMode.value = true;
}

function toggleLoadedSelection(checked: boolean) {
  swapTasks.value.forEach((task: any) => {
    selectedTasks.value[task.workEffortId] = checked;
  });
}

function selectedCards() {
  return selectedTaskIds.value.map((id) => cardRefs.value[id]).filter(Boolean);
}

async function runBulkAction(action: 'submitCancel' | 'submitPark', facilityId?: string) {
  const cards = selectedCards();
  if (!cards.length) return;
  bulkActionRunning.value = true;
  try {
    const taskStatusId = action === 'submitPark' ? 'TASK_COMPLETED' : 'TASK_CANCELLED';
    const results = await runGroupedTaskMutation(
      cards,
      shipGroupTaskTarget,
      (card: any) => action === 'submitPark' ? card.submitParkDomain(facilityId) : card.submitCancelDomain(),
      (card: any) => card.submitTaskStatus(taskStatusId),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeeded = results.length - failed;
    if (succeeded) await showToast(translate('{count} task(s) completed.', { count: succeeded }));
    if (failed) await showToast(translate('{count} task(s) failed.', { count: failed }));
    await replaceSwapTasks();
  } finally {
    bulkActionRunning.value = false;
  }
}

async function bulkCancelOrders() {
  const cards = selectedCards();
  if (!cards.length) return;
  const shipGroupCount = countTaskTargets(cards, shipGroupTaskTarget);
  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} selected ship group(s)? This action cannot be undone.', { count: shipGroupCount }),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      { text: translate('Cancel orders'), role: 'confirm', handler: () => runBulkAction('submitCancel') },
    ],
  });
  await alert.present();
}

async function bulkParkOrders() {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (facilityId) await runBulkAction('submitPark', facilityId);
}

async function loadSetupCandidates() {
  const productStoreId = selectedProductStoreId.value;
  if (!productStoreId) {
    setupCandidates.value = [];
    setupError.value = translate('Select a product store to review unfillable products.');
    return;
  }
  setupLoading.value = true;
  setupError.value = '';
  try {
    const candidates = await fetchUnfillableProductCandidates(productStoreId);
    productMaster.init();
    await productMaster.prefetch(candidates.map((candidate) => candidate.productId));
    setupCandidates.value = candidates.map((candidate) => ({
      ...candidate,
      ...(productCache.getProduct(candidate.productId) || {}),
    }));

    // Fetch active substitute associations in parallel for all candidate products
    const associationsResults = await Promise.allSettled(
      candidates.map((candidate) => fetchActiveSubstitutes(candidate.productId))
    );

    const configuredIds: string[] = [];
    associationsResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        configuredIds.push(candidates[idx].productId);
      }
    });
    configuredProductIds.value = configuredIds;
  } catch (cause) {
    setupCandidates.value = [];
    setupError.value = translate('Failed to load unfillable products. Please try again.');
  } finally {
    setupLoading.value = false;
  }
}

async function openSubstituteModal(candidate: SwapSetupCandidate) {
  const modal = await modalController.create({
    component: SubstituteRelationshipModal,
    componentProps: { productId: candidate.productId, sourceProduct: candidate },
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (data?.hasSubstitutes) {
    configuredProductIds.value = [...new Set([...configuredProductIds.value, candidate.productId])];
  } else if (role === 'confirm') {
    configuredProductIds.value = configuredProductIds.value.filter((productId) => productId !== candidate.productId);
  }
  if (role === 'confirm') await showToast(translate('Substitute relationships updated.'));
}

async function rebrokerProductOrders(candidate: SwapSetupCandidate) {
  const productStoreId = selectedProductStoreId.value;
  if (!productStoreId || productStoreId === 'All') return;
  const modal = await modalController.create({ component: RoutingGroupModal, componentProps: { productStoreId } });
  await modal.present();
  const { data: routingGroupId } = await modal.onWillDismiss();
  if (!routingGroupId) return;

  setupLoading.value = true;
  setupError.value = '';
  try {
    const shipGroups = await fetchUnfillableShipGroupsForProduct(productStoreId, candidate.productId);
    if (!shipGroups.length) {
      await showToast(translate('No approved unfillable orders remain for this product.'));
      await loadSetupCandidates();
      return;
    }
    const results = await Promise.allSettled(shipGroups.map((shipGroup) => orderTaskStore.brokerShipGroup({
      routingGroupId,
      productStoreId,
      orderId: shipGroup.orderId,
      shipGroupSeqId: shipGroup.shipGroupSeqId,
    })));
    const failures = results.filter((result) => result.status === 'rejected').length;
    const successes = results.length - failures;
    if (successes) await showToast(translate('{count} ship group(s) submitted for rebrokering.', { count: successes }));
    if (failures) await showToast(translate('{count} ship group(s) could not be rebrokered.', { count: failures }));
    await fetchSwapTasks();
  } catch (cause) {
    setupError.value = translate('Failed to rebroker orders for this product. Please try again.');
  } finally {
    setupLoading.value = false;
  }
}

async function loadMoreSwapTasks(event: any) {
  await fetchSwapTasks(
    undefined,
    Math.ceil(swapTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  loadPhysicalFacilities();
  replaceSwapTasks();
});
</script>

<style scoped>
.swap-order-list {
  padding: 0 var(--spacer-sm) var(--spacer-sm);
}

@media (max-width: 640px) {
  .swap-order-list {
    padding-inline: 0;
  }
}
</style>
