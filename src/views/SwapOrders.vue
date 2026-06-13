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
        :show-clear="false"
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

      <div class="swap-order-list">
        <SwapTaskCard
          v-for="task in swapTasks"
          :key="task.workEffortId"
          :task="task"
          show-view-order-action
          @completed="fetchSwapTasks()"
        />
        <div class="empty-state" v-if="!swapTasks.length">
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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonButtons, IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonMenuButton, IonPage, IonSelectOption, IonTitle, IonToolbar, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import FilterToggle from '@/components/common/FilterToggle.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductMaster } from '@/composables/useProductMaster';
import { useStockStore } from '@/store/stock';

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
  fetchSwapTasks();
}

const fetchSwapTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchSwapTasks({
    viewSize,
    viewIndex,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(swappable.value && { swappable: 'Y' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
  });

  const productIds = swapTasks.value
    .flatMap((task: any) => task.items ?? [])
    .flatMap((item: any) => [item.productId, item.substituteProducts?.[0]?.productId])
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }

  const stockRequests = new Map();

  swapTasks.value.forEach((task: any) => {
    const facilityId = task.facilityId;

    (task.items ?? []).forEach((item: any) => {
      const productId = item.substituteProducts?.[0]?.productId;

      if (productId && facilityId) {
        const key = `${productId}|${facilityId}`;

        if (!stockRequests.has(key)) {
          stockRequests.set(key, { productId, facilityId });
        }
      }
    });
  });


  await Promise.all(
    [...stockRequests.values()].map((stockRequest: any) =>
      useStockStore().fetchStock(stockRequest)
    )
  );
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
