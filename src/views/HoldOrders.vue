<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Hold') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <OrderTaskFilterCard
        v-model="filters"
        :channel-options="channelOptions"
        :facility-options="facilityOptions"
        :shipment-method-options="shipmentMethodOptions"
        show-ship-group-filters
        @search="replaceHoldTasks"
        @clear="clearFilters"
      />

      <ion-progress-bar v-if="isRefetching" type="indeterminate" />

      <TaskQueueListHeader
        :loaded-count="heldTasks.length"
        :total-count="holdTotal"
        singular-label="hold task"
        plural-label="hold tasks"
        :sort="filters.sort"
        :sort-options="sortOptions"
        trigger-id="hold-task-sort"
        :select-mode="selectMode"
        :all-loaded-selected="allCurrentPageSelected"
        :some-loaded-selected="someCurrentPageSelected"
        @update:sort="filters.sort = $event"
        @toggle-select-mode="toggleSelectMode"
        @toggle-loaded-selection="toggleCurrentPageSelection"
      />

      <div class="hold-orders-list">
        <HoldTaskCard
          v-for="task in heldTasks"
          :key="task.workEffortId"
          :ref="(el) => setCardRef(task.workEffortId, el)"
          :task="task"
          :selectable="selectMode"
          :selected="!!selectedOrders[task.workEffortId]"
          show-view-order-action
          @update:selected="val => selectedOrders[task.workEffortId] = val"
          @completed="fetchHoldTasks()"
        />

        <div v-if="isFirstLoad" class="ion-text-center ion-padding">
          <ion-spinner name="crescent" />
        </div>

        <ErrorState
          v-else-if="isError"
          :title="translate('Unable to load hold tasks')"
          :message="translate(holdError)"
          retryable
          @retry="fetchHoldTasks()"
        />

        <div class="empty-state" v-else-if="isEmpty">
          <p v-html="getEmptyMessage()"></p>
        </div>
      </div>

      <ion-infinite-scroll
        @ionInfinite="loadMoreHoldTasks($event)"
        threshold="100px"
        v-if="isScrollable"
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
          <ion-button fill="solid" color="primary" :disabled="!hasSelectedTasks || bulkActionRunning" @click="resolveSelectedTasks()">{{ translate('Resolve') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonProgressBar,
  IonSpinner,
  alertController,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  onIonViewWillEnter
} from '@ionic/vue';
import { translate } from '@common';
import { showToast } from '@/utils';
import ErrorState from '@/components/common/ErrorState.vue';
import OrderTaskFilterCard from '@/components/tasks/OrderTaskFilterCard.vue';
import TaskQueueListHeader from '@/components/tasks/TaskQueueListHeader.vue';
import HoldTaskCard from '@/components/tasks/HoldTaskCard.vue';
import { useUserStore } from '@/store/user';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useOrderTaskRouteState } from '@/composables/useOrderTaskRouteState';
import { usePhysicalFacilityOptions } from '@/composables/usePhysicalFacilityOptions';
import { buildTaskQueueRequest, hasTaskFilters } from '@/utils/orderTaskFilters';
import { defaultOrderTaskFilters, taskSortOptions, type TaskFilterOption } from '@/types/orderTaskFilters';

const orderTaskStore = useOrderTaskStore();
const userStore = useUserStore();
const seedStore = useSeedStore();

const filters = ref(defaultOrderTaskFilters());
useOrderTaskRouteState(filters, 'hold');
const { facilityOptions, loadPhysicalFacilities } = usePhysicalFacilityOptions();
const channelOptions = computed<TaskFilterOption[]>(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL').map((channel: any) => ({ id: channel.enumId, label: channel.description || channel.enumId })));
const shipmentMethodOptions = computed<TaskFilterOption[]>(() => seedStore.getShipmentMethodOptions);
const sortOptions = taskSortOptions('hold');
const selectMode = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});
const cardRefs = ref<Record<string, any>>({});
const bulkActionRunning = ref(false);

function setCardRef(workEffortId: string, el: any) {
  if (el) {
    cardRefs.value[workEffortId] = el;
  } else {
    delete cardRefs.value[workEffortId];
  }
}

const heldTasks = computed(() => orderTaskStore.getHoldTasks);
const holdTotal = computed(() => orderTaskStore.getHoldTotal);
const isScrollable = computed(() => orderTaskStore.isHoldTasksScrollable);
const holdStatus = computed(() => orderTaskStore.getHoldStatus);
const holdError = computed(() => orderTaskStore.getHoldError);
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => hasTaskFilters(filters.value));
const currentPageTaskIds = computed(() => heldTasks.value.map((task) => task.workEffortId));
const allCurrentPageSelected = computed(() => currentPageTaskIds.value.length > 0 && currentPageTaskIds.value.every((workEffortId: string) => selectedOrders.value[workEffortId]));
const someCurrentPageSelected = computed(() => currentPageTaskIds.value.some((workEffortId: string) => selectedOrders.value[workEffortId]));

// First-load spinner: loading the initial page with nothing on screen yet.
const isFirstLoad = computed(() => holdStatus.value === 'loading' && !heldTasks.value.length);
// Progress bar: a first-page refetch while rows are still shown (filter change / refresh).
const isRefetching = computed(() => holdStatus.value === 'loading' && heldTasks.value.length > 0);
// Error state only when nothing is on screen to show instead.
const isError = computed(() => holdStatus.value === 'error' && !heldTasks.value.length);
// True empty state only after a successful zero-row response.
const isEmpty = computed(() => holdStatus.value === 'success' && !heldTasks.value.length);

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

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
  if (!suppressAutomaticFetch) replaceHoldTasks();
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
  heldTasks.value.forEach((task) => {
    selectedOrders.value[task.workEffortId] = checked;
  });
}

// Prune selections for tasks that are no longer in the list (e.g. after a filter change)
// without forcing select mode on or off.
watch(heldTasks, () => {
  const validIds = new Set(heldTasks.value.map((task) => task.workEffortId));
  Object.keys(selectedOrders.value).forEach((id) => {
    if (!validIds.has(id)) delete selectedOrders.value[id];
  });
});

function clearFilters() {
  suppressAutomaticFetch = true;
  filters.value = defaultOrderTaskFilters();
  suppressAutomaticFetch = false;
  replaceHoldTasks();
}

async function resolveSelectedTasks() {
  const selected = Object.entries(selectedOrders.value)
    .filter(([, checked]) => checked)
    .map(([id]) => id);
  if (!selected.length) return;

  const alert = await alertController.create({
    header: translate('Resolve tasks'),
    message: translate('Are you sure you want to resolve {count} selected task(s)?').replace('{count}', String(selected.length)),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Resolve tasks'),
        role: 'confirm',
        handler: async () => {
          bulkActionRunning.value = true;
          try {
            const results = await Promise.allSettled(
              selected
                .map(id => cardRefs.value[id])
                .filter(Boolean)
                .map(card => card.submitResolve())
            );
            const failed = results.filter((result) => result.status === 'rejected').length;
            const succeeded = results.length - failed;
            if (succeeded) await showToast(translate('{count} task(s) completed.', { count: succeeded }));
            if (failed) await showToast(translate('{count} task(s) failed.', { count: failed }));
            await replaceHoldTasks();
          } finally {
            bulkActionRunning.value = false;
          }
        }
      }
    ]
  });
  await alert.present();
}


const fetchHoldTasks = async (pageSize?: any, pageIndex?: any) => {
  const isFirstPage = !Number(pageIndex || 0);
  if (isFirstPage) resetSelection();
  // The store owns loading/error status and keeps failures in state.
  await orderTaskStore.fetchHoldTasks(buildTaskQueueRequest(
    'hold',
    filters.value,
    pageSize ?? import.meta.env.VITE_VIEW_SIZE,
    pageIndex ?? 0,
  ));
};

function replaceHoldTasks() {
  return fetchHoldTasks(undefined, 0);
}

function resetSelection() {
  selectedOrders.value = {};
  selectMode.value = false;
}

async function loadMoreHoldTasks(event: any) {
  await fetchHoldTasks(
    undefined,
    Math.ceil(heldTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  loadPhysicalFacilities();
  replaceHoldTasks();
});
</script>

<style scoped>
.hold-orders-list {
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
  .hold-orders-list {
    padding-inline: 0;
  }
}
</style>
