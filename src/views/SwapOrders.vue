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
      <ErrorState
        v-else-if="isErrored"
        :title="translate('Could not load swap tasks')"
        :message="errorMessage"
        retryable
        @retry="fetchSwapTasks()"
      />

      <template v-else>
        <div class="swap-order-list">
          <SwapTaskCard
            v-for="task in swapTasks"
            :key="task.workEffortId"
            :task="task"
            show-view-order-action
            @completed="fetchSwapTasks()"
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
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonButtons, IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonMenuButton, IonPage, IonProgressBar, IonSelectOption, IonSpinner, IonTitle, IonToolbar, modalController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import router from '@/router';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import FilterToggle from '@/components/common/FilterToggle.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import SwapTaskCard from '@/components/tasks/SwapTaskCard.vue';
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
import { showToast } from '@/utils';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();
const productStore = useProductStore();
const userStore = useUserStore();
const productCache = useProductCacheStore();
const productMaster = useProductMaster();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));

const searchQuery = ref('');
const swappable = ref(false);
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const setupCandidates = ref<SwapSetupCandidate[]>([]);
const setupLoading = ref(false);
const setupError = ref('');
const configuredProductIds = ref<string[]>([]);

const swapTasks = computed(() => orderTaskStore.getSwapTasks);
const isScrollable = computed(() => orderTaskStore.isSwapTasksScrollable);
const hasFilters = computed(() => !!(searchQuery.value || swappable.value || dateAfter.value || dateBefore.value || orderChannel.value));
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
  if (!pageIndex && isSuccess.value && !swapTasks.value.length && !hasFilters.value) {
    await loadSetupCandidates();
  }
};

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
