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
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search')"
        @search="fetchSwapTasks()"
        @clear="clearFilters"
      >
        <FilterToggle v-model="swappable" :label="translate('Swappable')" />
        <DateFilterSelect v-model="dateAfter" :label="translate('Date after')" />
        <DateFilterSelect v-model="dateBefore" :label="translate('Date before')" />
        <FilterSelect v-model="orderChannel" :label="translate('Channel')">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </FilterSelect>
      </SearchFilterCard>

      <!-- Refetch over already-rendered cards: keep them visible, show a thin
           progress bar instead of swapping in the full-page spinner. -->
      <ion-progress-bar v-if="isRefetching" type="indeterminate" />

      <!-- First load with nothing to show yet: full-page spinner. -->
      <div v-if="isFirstLoading" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
      </div>

      <!-- First-load failure: explicit, retryable error state. -->
      <template v-else-if="isErrored">
        <ErrorState :title="translate('Could not load swap tasks')" :message="errorMessage" />
        <div class="ion-text-center ion-padding">
          <ion-button fill="outline" @click="fetchSwapTasks()">{{ translate('Retry') }}</ion-button>
        </div>
      </template>

      <template v-else>
        <div class="swap-order-list">
          <SwapTaskCard
            v-for="task in swapTasks"
            :key="task.workEffortId"
            :task="task"
            show-view-order-action
            @completed="fetchSwapTasks()"
          />
          <!-- True empty state: only after a successful zero-row response. -->
          <div class="empty-state" v-if="!swapTasks.length && isSuccess">
            <p v-html="getEmptyMessage()"></p>
          </div>
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
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonMenuButton, IonPage, IonProgressBar, IonSelectOption, IonSpinner, IonTitle, IonToolbar, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import router from '@/router';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import FilterToggle from '@/components/common/FilterToggle.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));

const searchQuery = ref('');
const swappable = ref(false);
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');

const swapTasks = computed(() => orderTaskStore.getSwapTasks);
const isScrollable = computed(() => orderTaskStore.isSwapTasksScrollable);
const hasFilters = computed(() => !!(searchQuery.value || swappable.value || dateAfter.value || dateBefore.value || orderChannel.value));

const swapStatus = computed(() => orderTaskStore.getSwapStatus);
const errorMessage = computed(() => translate(orderTaskStore.getSwapError));
// First open / cleared list: nothing to show while the first page loads.
const isFirstLoading = computed(() => swapStatus.value === 'loading' && !swapTasks.value.length);
// Refetch with cards already on screen (filter change, search, post-action reload).
const isRefetching = computed(() => swapStatus.value === 'loading' && swapTasks.value.length > 0);
const isErrored = computed(() => swapStatus.value === 'error');
const isSuccess = computed(() => swapStatus.value === 'success');

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([swappable, dateAfter, dateBefore, orderChannel], () => {
  fetchSwapTasks();
});

function clearFilters() {
  searchQuery.value = '';
  swappable.value = false;
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  router.replace({ query: {} });
  fetchSwapTasks();
}

const fetchSwapTasks = async (pageSize?: any, pageIndex?: any) => {
  // The store owns the load/error status and the product/stock enrichment, so it
  // only flips to `success` once the cards can render stably.
  await orderTaskStore.fetchSwapTasks({
    pageSize: pageSize ?? import.meta.env.VITE_VIEW_SIZE,
    pageIndex: pageIndex ?? 0,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(swappable.value && { swappable: 'Y' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
  });
};

async function loadMoreSwapTasks(event: any) {
  await fetchSwapTasks(
    undefined,
    Math.ceil(swapTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  fetchSwapTasks();
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