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
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search')"
        @search="fetchHoldTasks()"
        @clear="clearFilters"
      >
        <FilterSelect v-model="assignee" :label="translate('Assignee')">
          <ion-select-option value="">{{ translate('All assignees') }}</ion-select-option>
          <ion-select-option value="me">{{ translate('Me') }}</ion-select-option>
        </FilterSelect>
        <DateFilterSelect v-model="dateAfter" :label="translate('Order date after')" />
        <DateFilterSelect v-model="dateBefore" :label="translate('Order date before')" />
        <FilterSelect v-model="orderChannel" :label="translate('Channel')">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </FilterSelect>
      </SearchFilterCard>

      <ion-progress-bar v-if="isRefetching" type="indeterminate" />

      <ion-list v-if="heldTasks.length" lines="none">
        <ion-list-header class="order-results-header">
          <span class="order-results-header-start">
            <ion-checkbox
              v-if="selectMode"
              :checked="allCurrentPageSelected"
              :indeterminate="someCurrentPageSelected && !allCurrentPageSelected"
              @ionChange="toggleCurrentPageSelection($event.detail.checked)"
            />
          </span>
          <ion-label>
            {{ heldTasks.length }} {{ heldTasks.length === 1 ? translate('hold task') : translate('hold tasks') }}
          </ion-label>
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>
      </ion-list>

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
          <ion-button fill="solid" color="primary" :disabled="!hasSelectedTasks" @click="resolveSelectedTasks()">{{ translate('Resolve') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonProgressBar,
  IonSelectOption,
  IonSpinner,
  alertController,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  onIonViewWillEnter
} from '@ionic/vue';
import { translate } from '@common';
import router from '@/router';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import HoldTaskCard from '@/components/tasks/HoldTaskCard.vue';
import { useUserStore } from '@/store/user';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';

const orderTaskStore = useOrderTaskStore();
const userStore = useUserStore();
const seedStore = useSeedStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const currentUserPartyId = computed(() => userStore.getUserProfile?.partyId || userStore.getUserProfile?.userId || '');

const searchQuery = ref('');
const assignee = ref('');
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const selectMode = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});
const cardRefs = ref<Record<string, any>>({});

function setCardRef(workEffortId: string, el: any) {
  if (el) {
    cardRefs.value[workEffortId] = el;
  } else {
    delete cardRefs.value[workEffortId];
  }
}

const heldTasks = computed(() => orderTaskStore.getHoldTasks);
const isScrollable = computed(() => orderTaskStore.isHoldTasksScrollable);
const holdStatus = computed(() => orderTaskStore.getHoldStatus);
const holdError = computed(() => orderTaskStore.getHoldError);
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => !!(searchQuery.value || assignee.value || dateAfter.value || dateBefore.value || orderChannel.value));
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

watch([assignee, dateAfter, dateBefore, orderChannel], () => {
  fetchHoldTasks();
});

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
  searchQuery.value = '';
  assignee.value = '';
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  router.replace({ query: {} });
  fetchHoldTasks();
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
          await Promise.all(
            selected
              .map(id => cardRefs.value[id])
              .filter(Boolean)
              .map(card => card.submitResolve())
          );
          selectedOrders.value = {};
          await fetchHoldTasks();
        }
      }
    ]
  });
  await alert.present();
}


const fetchHoldTasks = async (pageSize?: any, pageIndex?: any) => {
  // The store owns loading/error status and keeps failures in state.
  await orderTaskStore.fetchHoldTasks({
    pageSize: pageSize ?? import.meta.env.VITE_VIEW_SIZE,
    pageIndex: pageIndex ?? 0,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
    ...(assignee.value === 'me' && currentUserPartyId.value && { currentUserPartyId: currentUserPartyId.value }),
  });
};

async function loadMoreHoldTasks(event: any) {
  await fetchHoldTasks(
    undefined,
    Math.ceil(heldTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  fetchHoldTasks();
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
