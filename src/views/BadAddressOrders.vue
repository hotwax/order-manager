<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Bad address') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <OrderTaskFilterCard
        v-model="filters"
        :channel-options="channelOptions"
        :facility-options="facilityOptions"
        :shipment-method-options="shipmentMethodOptions"
        show-ship-group-filters
        @search="replaceAddressValidationTasks"
        @clear="clearFilters"
      />

      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>

      <template v-else-if="error">
        <ErrorState :title="translate('Could not load bad address tasks')" :message="error" />
        <div class="ion-text-center ion-padding">
          <ion-button fill="outline" @click="fetchAddressValidationTasks()">{{ translate('Retry') }}</ion-button>
        </div>
      </template>

      <template v-else>
        <TaskQueueListHeader
          :loaded-count="addressValidationTasks.length"
          :total-count="addressValidationTotal"
          singular-label="bad address task"
          plural-label="bad address tasks"
          :sort="filters.sort"
          :sort-options="sortOptions"
          trigger-id="bad-address-task-sort"
          :select-mode="selectMode"
          :all-loaded-selected="allCurrentPageSelected"
          :some-loaded-selected="someCurrentPageSelected"
          @update:sort="filters.sort = $event"
          @toggle-select-mode="toggleSelectMode"
          @toggle-loaded-selection="toggleCurrentPageSelection"
        />

        <div class="bad-address-list">
          <BadAddressTaskCard
            v-for="task in addressValidationTasks"
            :key="task.workEffortId"
            :task="task"
            :countries="countries"
            :selectable="selectMode"
            :selected="!!selectedOrders[task.workEffortId]"
            show-view-order-action
            @update:selected="val => selectedOrders[task.workEffortId] = val"
            @completed="fetchAddressValidationTasks()"
            :ref="setCardRef"
          />
          <TaskQueueEmptyState
            v-if="!addressValidationTasks.length"
            kind="badAddress"
            :filtered="hasFilters"
            :company-carrier-url="companyCarrierUrl"
            @clear="clearFilters"
          />
        </div>

        <ion-infinite-scroll
          @ionInfinite="loadMoreAddressValidationTasks($event)"
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
          <ion-button fill="solid" color="primary" :disabled="!hasSelectedTasks || bulkActionRunning" @click="bulkSaveAndReleaseHold()">{{ translate('Save and release hold') }}</ion-button>
          <ion-button fill="outline" color="danger" :disabled="!hasSelectedTasks || bulkActionRunning" @click="bulkCancelOrder()">{{ translate('Cancel orders') }}</ion-button>
          <ion-button fill="outline" color="medium" :disabled="!hasSelectedTasks || bulkActionRunning" @click="bulkParkOrder()">{{ translate('Park') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUpdate } from 'vue';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonMenuButton, IonPage, IonSpinner, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { buildAppUrl, translate } from '@common';
import { showToast } from '@/utils';
import ErrorState from '@/components/common/ErrorState.vue';
import OrderTaskFilterCard from '@/components/tasks/OrderTaskFilterCard.vue';
import TaskQueueListHeader from '@/components/tasks/TaskQueueListHeader.vue';
import TaskQueueEmptyState from '@/components/tasks/TaskQueueEmptyState.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useOrderTaskRouteState } from '@/composables/useOrderTaskRouteState';
import { usePhysicalFacilityOptions } from '@/composables/usePhysicalFacilityOptions';
import { buildTaskQueueRequest, hasTaskFilters } from '@/utils/orderTaskFilters';
import { countTaskTargets, groupTaskCardsByTarget, runGroupedTaskMutation, shipGroupTaskTarget } from '@/utils/orderTaskBulk';
import { defaultOrderTaskFilters, taskSortOptions, type TaskFilterOption } from '@/types/orderTaskFilters';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const filters = ref(defaultOrderTaskFilters());
useOrderTaskRouteState(filters, 'badAddress');
const { facilityOptions, loadPhysicalFacilities } = usePhysicalFacilityOptions();
const channelOptions = computed<TaskFilterOption[]>(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL').map((channel: any) => ({ id: channel.enumId, label: channel.description || channel.enumId })));
const shipmentMethodOptions = computed<TaskFilterOption[]>(() => seedStore.getShipmentMethodOptions);
const sortOptions = taskSortOptions('badAddress');
// Computed once here and passed as a prop — avoids N per-card reactive subscriptions.
const countries = computed(() => seedStore.getCountries);
const companyCarrierUrl = buildAppUrl('company', '/carriers');
const selectMode = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});
const bulkActionRunning = ref(false);
// Initial-load state — covers the first task-list fetch. Cards then render their
// own skeleton while each hydrates its address form lazily.
const loading = ref(false);
const error = ref('');

const cardRefs = ref<any[]>([]);
const setCardRef = (el: any) => {
  if (el) cardRefs.value.push(el);
};
onBeforeUpdate(() => {
  cardRefs.value = [];
});

const addressValidationTasks = computed(() => orderTaskStore.getAddressValidationTasks);
const addressValidationTotal = computed(() => orderTaskStore.getAddressValidationTotal);
const isScrollable = computed(() => orderTaskStore.isAddressValidationTasksScrollable);
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => hasTaskFilters(filters.value));
const currentPageTaskIds = computed(() => addressValidationTasks.value.map((task: any) => task.workEffortId));
const allCurrentPageSelected = computed(() => currentPageTaskIds.value.length > 0 && currentPageTaskIds.value.every((workEffortId: string) => selectedOrders.value[workEffortId]));
const someCurrentPageSelected = computed(() => currentPageTaskIds.value.some((workEffortId: string) => selectedOrders.value[workEffortId]));

// Each card builds its own address form lazily (see BadAddressTaskCard); the view
// only prunes selections for tasks that drop out of the list on refresh.
watch(addressValidationTasks, (tasks) => {
  const incoming = new Set(tasks.map((t: any) => t.workEffortId));
  Object.keys(selectedOrders.value).forEach(id => {
    if (!incoming.has(id)) delete selectedOrders.value[id];
  });
});

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
  if (!suppressAutomaticFetch) replaceAddressValidationTasks();
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
  addressValidationTasks.value.forEach((task: any) => {
    selectedOrders.value[task.workEffortId] = checked;
  });
}

function clearFilters() {
  suppressAutomaticFetch = true;
  filters.value = defaultOrderTaskFilters();
  suppressAutomaticFetch = false;
  replaceAddressValidationTasks();
}

const fetchAddressValidationTasks = async (pageSize?: any, pageIndex?: any) => {
  const isFirstPage = !Number(pageIndex || 0);
  if (isFirstPage) resetSelection();
  // Show the full-page loading/error state only when there is nothing to show yet
  // (first open of the route). Infinite-scroll pages and reloads after an action
  // keep the existing, already-hydrated cards visible while they refresh.
  const showFullLoading = !pageIndex && !addressValidationTasks.value.length;
  if (showFullLoading) {
    loading.value = true;
    error.value = '';
  }
  try {
    const ok = await orderTaskStore.fetchAddressValidationTasks(buildTaskQueueRequest(
      'badAddress',
      filters.value,
      pageSize ?? import.meta.env.VITE_VIEW_SIZE,
      pageIndex ?? 0,
    ));
    if (!ok) {
      if (showFullLoading) error.value = translate('Failed to load bad address tasks. Please try again.');
      return;
    }
  } finally {
    if (showFullLoading) loading.value = false;
  }
};

function replaceAddressValidationTasks() {
  return fetchAddressValidationTasks(undefined, 0);
}

function resetSelection() {
  selectedOrders.value = {};
  selectMode.value = false;
}

function getSelectedCards() {
  return cardRefs.value.filter((card: any) => card && selectedOrders.value[card.task.workEffortId]);
}

async function bulkSaveAndReleaseHold() {
  const cards = getSelectedCards();
  if (!cards.length) return;

  const representativeCards = groupTaskCardsByTarget(cards, shipGroupTaskTarget).map(([card]) => card);
  const invalidCard = representativeCards.find((card: any) => !!card.validate());
  if (invalidCard) {
    await showToast(invalidCard.validate()!);
    return;
  }
  const shipGroupCount = countTaskTargets(cards, shipGroupTaskTarget);

  const alert = await alertController.create({
    header: translate('Save and release hold'),
    message: translate('Are you sure you want to save address and release hold for {count} selected ship group(s)?').replace('{count}', String(shipGroupCount)),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Save and release hold'),
        role: 'confirm',
        handler: async () => {
          await runGroupedBulkCards(cards, (card) => card.submitSaveAndReleaseDomain(), 'TASK_COMPLETED');
        }
      }
    ]
  });
  await alert.present();
}

async function bulkCancelOrder() {
  const cards = getSelectedCards();
  if (!cards.length) return;
  const shipGroupCount = countTaskTargets(cards, shipGroupTaskTarget);

  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} selected ship group(s)? This action cannot be undone.').replace('{count}', String(shipGroupCount)),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Cancel orders'),
        role: 'confirm',
        handler: async () => {
          await runGroupedBulkCards(cards, (card) => card.submitCancelDomain(), 'TASK_CANCELLED');
        }
      }
    ]
  });
  await alert.present();
}

async function bulkParkOrder() {
  const cards = getSelectedCards();
  if (!cards.length) return;

  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (!facilityId) return;

  await runGroupedBulkCards(cards, (card) => card.submitParkDomain(facilityId), 'TASK_COMPLETED');
}

async function runGroupedBulkCards(
  cards: any[],
  operation: (card: any) => Promise<unknown>,
  duplicateStatusId: 'TASK_COMPLETED' | 'TASK_CANCELLED',
) {
  bulkActionRunning.value = true;
  try {
    const results = await runGroupedTaskMutation(
      cards,
      shipGroupTaskTarget,
      operation,
      (card: any) => card.submitTaskStatus(duplicateStatusId),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeeded = results.length - failed;
    if (succeeded) await showToast(translate('{count} task(s) completed.', { count: succeeded }));
    if (failed) await showToast(translate('{count} task(s) failed.', { count: failed }));
    await replaceAddressValidationTasks();
  } finally {
    bulkActionRunning.value = false;
  }
}

async function loadMoreAddressValidationTasks(event: any) {
  await fetchAddressValidationTasks(
    undefined,
    Math.ceil(addressValidationTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  loadPhysicalFacilities();
  replaceAddressValidationTasks();
});
</script>

<style scoped>
.bad-address-list {
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
  .bad-address-list {
    padding-inline: 0;
  }
}
</style>
