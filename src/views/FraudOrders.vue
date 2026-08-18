<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Fraud') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <OrderTaskFilterCard
        v-model="filters"
        :channel-options="channelOptions"
        :order-status-options="orderStatusOptions"
        :risk-recommendation-options="riskRecommendationOptions"
        :risk-level-options="riskLevelOptions"
        show-fraud-filters
        @search="replaceFraudTasks"
        @clear="clearFilters"
      />

      <!-- Refetch progress bar: shown while a first-page reload runs over existing cards. -->
      <ion-progress-bar v-if="isRefetching" type="indeterminate" />

      <TaskQueueListHeader
        :loaded-count="fraudTasks.length"
        :total-count="fraudTotal"
        singular-label="fraud task"
        plural-label="fraud tasks"
        :sort="filters.sort"
        :sort-options="sortOptions"
        trigger-id="fraud-task-sort"
        :select-mode="selectMode"
        :all-loaded-selected="allCurrentPageSelected"
        :some-loaded-selected="someCurrentPageSelected"
        @update:sort="filters.sort = $event"
        @toggle-select-mode="toggleSelectMode"
        @toggle-loaded-selection="toggleCurrentPageSelection"
      />

      <!-- First-load spinner: only before any card exists. -->
      <div v-if="isFirstLoad" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>

      <!-- Error/retry state replaces the list when the first-page request failed. -->
      <ErrorState
        v-else-if="hasError"
        :title="translate('Could not load fraud tasks')"
        :message="translate(fraudError)"
        retryable
        @retry="fetchFraudTasks()"
      />

      <div v-else class="fraud-orders">
        <FraudTaskCard
          v-for="task in fraudTasks"
          :key="task.workEffortId"
          :ref="(element) => setCardRef(task.workEffortId, element)"
          :task="task"
          :selectable="selectMode"
          :selected="!!selectedOrders[task.workEffortId]"
          show-view-order-action
          @update:selected="val => selectedOrders[task.workEffortId] = val"
          @completed="fetchFraudTasks()"
        />
        <!-- True empty state: only after a successful zero-row response. -->
        <TaskQueueEmptyState
          v-if="showEmptyState"
          kind="fraud"
          :filtered="hasFilters"
          @clear="clearFilters"
        />
      </div>

      <ion-infinite-scroll
        :disabled="!isScrollable"
        threshold="100px"
        @ionInfinite="loadMoreFraudTasks($event)"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading')"
        />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="selectMode">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button color="primary" :disabled="!selectedTaskCount || bulkActionRunning" @click="bulkResolve">{{ translate('Resolve') }}</ion-button>
          <ion-button v-if="!HIDE_SHOPIFY_UNSYNCED_ACTIONS" color="danger" :disabled="!selectedTaskCount || bulkActionRunning" @click="bulkCancel">{{ translate('Cancel orders') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonMenuButton, IonPage, IonProgressBar, IonSpinner, IonTitle, IonToolbar, IonInfiniteScroll, IonInfiniteScrollContent, alertController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import { showToast } from '@/utils';
import ErrorState from '@/components/common/ErrorState.vue';
import OrderTaskFilterCard from '@/components/tasks/OrderTaskFilterCard.vue';
import TaskQueueListHeader from '@/components/tasks/TaskQueueListHeader.vue';
import TaskQueueEmptyState from '@/components/tasks/TaskQueueEmptyState.vue';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductMaster } from '@/composables/useProductMaster';
import { useOrderTaskRouteState } from '@/composables/useOrderTaskRouteState';
import { buildTaskQueueRequest, hasTaskFilters } from '@/utils/orderTaskFilters';
import { countTaskTargets, orderTaskTarget, runGroupedTaskMutation, selectedTaskCardsById } from '@/utils/orderTaskBulk';
import { HIDE_SHOPIFY_UNSYNCED_ACTIONS } from '@/config/featureFlags';
import { defaultOrderTaskFilters, taskSortOptions, type TaskFilterOption } from '@/types/orderTaskFilters';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const filters = ref(defaultOrderTaskFilters());
useOrderTaskRouteState(filters, 'fraud');
const channelOptions = computed<TaskFilterOption[]>(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL').map((channel: any) => ({ id: channel.enumId, label: channel.description || channel.enumId })));
const orderStatusOptions = computed<TaskFilterOption[]>(() => seedStore.getStatusItemsByType('ORDER_STATUS').map((status: any) => ({ id: status.statusId, label: status.description || status.statusId })));
const riskRecommendationOptions = computed<TaskFilterOption[]>(() => seedStore.getEnumsByType('ORDER_RISK_RECOMMENDATION').map((recommendation: any) => ({ id: recommendation.enumId, label: recommendation.description || recommendation.enumId })));
const riskLevelOptions = computed<TaskFilterOption[]>(() => seedStore.getEnumsByType('ORDER_RISK_LEVEL').map((level: any) => ({ id: level.enumId, label: level.description || level.enumId })));
const sortOptions = taskSortOptions('fraud');
const selectMode = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});
const bulkActionRunning = ref(false);

const cardRefs = ref<Record<string, any>>({});
function setCardRef(workEffortId: string, element: any) {
  if (element) cardRefs.value[workEffortId] = element;
  else delete cardRefs.value[workEffortId];
}

const fraudTasks = computed(() => orderTaskStore.getFraudTasks);
const fraudTotal = computed(() => orderTaskStore.getFraudTotal);
const fraudStatus = computed(() => orderTaskStore.getFraudStatus);
const fraudError = computed(() => orderTaskStore.getFraudError);
const isScrollable = computed(() => orderTaskStore.isFraudTasksScrollable);
// First load: request pending and no cards rendered yet.
const isFirstLoad = computed(() => fraudStatus.value === 'loading' && !fraudTasks.value.length);
// Refetch: reload running while cards already exist (keeps list visible, shows a bar).
const isRefetching = computed(() => fraudStatus.value === 'loading' && fraudTasks.value.length > 0);
// Only take over the page when there's nothing to show; a failed refetch with
// cards on screen keeps the existing rows instead of blanking the queue.
const hasError = computed(() => fraudStatus.value === 'error' && !fraudTasks.value.length);
// Empty copy only after a settled, successful, zero-row first-page response.
const showEmptyState = computed(() => fraudStatus.value === 'success' && !fraudTasks.value.length);
const selectedTaskCount = computed(() => Object.values(selectedOrders.value).filter(Boolean).length as number);
const hasFilters = computed(() => hasTaskFilters(filters.value));
const currentPageTaskIds = computed(() => fraudTasks.value.map((task: any) => task.workEffortId));
const allCurrentPageSelected = computed(() => currentPageTaskIds.value.length > 0 && currentPageTaskIds.value.every((workEffortId: string) => selectedOrders.value[workEffortId]));
const someCurrentPageSelected = computed(() => currentPageTaskIds.value.some((workEffortId: string) => selectedOrders.value[workEffortId]));

let suppressAutomaticFetch = false;
watch(() => [
  filters.value.salesChannelEnumId,
  filters.value.orderDateFrom,
  filters.value.orderDateThru,
  filters.value.taskCreatedFrom,
  filters.value.taskCreatedThru,
  filters.value.orderStatusId,
  filters.value.riskRecommendationEnumId,
  filters.value.riskLevelEnumId,
  filters.value.sort,
], () => {
  if (!suppressAutomaticFetch) replaceFraudTasks();
}, { flush: 'sync' });

function toggleSelectMode() {
  if (selectMode.value) {
    selectMode.value = false;
    selectedOrders.value = {};
    return;
  }
  selectMode.value = true;
}

function toggleCurrentPageSelection(checked: boolean) {
  fraudTasks.value.forEach((task: any) => {
    selectedOrders.value[task.workEffortId] = checked;
  });
}

// Prune selections for tasks no longer in the list (e.g. after a filter change)
// without forcing select mode on or off.
watch(fraudTasks, () => {
  const validIds = new Set(fraudTasks.value.map((task: any) => task.workEffortId));
  Object.keys(selectedOrders.value).forEach((id) => {
    if (!validIds.has(id)) delete selectedOrders.value[id];
  });
});

function clearFilters() {
  suppressAutomaticFetch = true;
  filters.value = defaultOrderTaskFilters();
  suppressAutomaticFetch = false;
  replaceFraudTasks();
}

const fetchFraudTasks = async (pageSize?: any, pageIndex?: any) => {
  // A first-page load replaces the result set, so drop any stale selection.
  if (!pageIndex) {
    resetSelection();
  }
  await orderTaskStore.fetchFraudTasks(buildTaskQueueRequest(
    'fraud',
    filters.value,
    pageSize ?? import.meta.env.VITE_VIEW_SIZE,
    pageIndex ?? 0,
  ));

  const productIds = fraudTasks.value
    .flatMap((task: any) => task.items ?? [])
    .map((item: any) => item.productId)
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }
};

function replaceFraudTasks() {
  return fetchFraudTasks(undefined, 0);
}

function resetSelection() {
  selectedOrders.value = {};
  selectMode.value = false;
}

async function loadMoreFraudTasks(event: any) {
  try {
    await fetchFraudTasks(
      undefined,
      Math.ceil(fraudTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
    );
  } finally {
    await event.target.complete();
  }
}

function selectedCards(): any[] {
  return selectedTaskCardsById(fraudTasks.value, selectedOrders.value, cardRefs.value);
}

async function bulkResolve() {
  const cards = selectedCards();
  if (!cards.length) return;
  await runBulkCards(cards, (card) => card.submitResolve());
}

async function bulkCancel() {
  const cards = selectedCards();
  if (!cards.length) return;
  const orderCount = countTaskTargets(cards, orderTaskTarget);
  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} orders? This action cannot be undone.', { count: orderCount }),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Cancel orders'),
        role: 'confirm',
        handler: async () => {
          await runBulkResults(() => runGroupedTaskMutation(
            cards,
            orderTaskTarget,
            (card: any) => card.submitCancelDomain(),
            (card: any) => card.submitTaskStatus('TASK_CANCELLED'),
          ));
        }
      }
    ]
  });
  await alert.present();
}

async function runBulkCards(cards: any[], operation: (card: any) => Promise<unknown>) {
  return runBulkResults(() => Promise.allSettled(cards.map(operation)));
}

async function runBulkResults(getResults: () => Promise<PromiseSettledResult<unknown>[]>) {
  bulkActionRunning.value = true;
  try {
    const results = await getResults();
    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeeded = results.length - failed;
    if (succeeded) await showToast(translate('{count} task(s) completed.', { count: succeeded }));
    if (failed) await showToast(translate('{count} task(s) failed.', { count: failed }));
    await replaceFraudTasks();
  } finally {
    bulkActionRunning.value = false;
  }
}

onIonViewWillEnter(() => {
  replaceFraudTasks();
});
</script>

<style scoped>
.fraud-orders {
  padding: 0 var(--spacer-sm) var(--spacer-sm);
}

.order-results-header {
  align-items: center;
  display: flex;
  gap: 8px;
}

.order-results-header-start {
  display: flex;
  min-width: 24px;
}

@media (max-width: 640px) {
  .fraud-orders {
    padding-inline: 0;
  }
}
</style>
