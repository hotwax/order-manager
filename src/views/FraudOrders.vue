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
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search')"
        @search="fetchFraudTasks()"
        @clear="clearFilters"
      >
        <FilterSelect v-model="assignee" :label="translate('Assignee')">
          <ion-select-option value="">{{ translate('All assignees') }}</ion-select-option>
          <ion-select-option value="me">{{ translate('Me') }}</ion-select-option>
        </FilterSelect>
        <FilterSelect v-model="orderChannel" :label="translate('Channel')">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </FilterSelect>
        <FilterSelect v-model="recommendation" :label="translate('Recommendation')">
          <ion-select-option value="">{{ translate('All recommendations') }}</ion-select-option>
          <ion-select-option v-for="rec in riskRecommendations" :key="rec.enumId" :value="rec.enumId">
            {{ rec.description || rec.enumId }}
          </ion-select-option>
        </FilterSelect>
        <FilterSelect v-model="severity" :label="translate('Severity')">
          <ion-select-option value="">{{ translate('All severity') }}</ion-select-option>
          <ion-select-option v-for="level in riskLevels" :key="level.enumId" :value="level.enumId">
            {{ level.description || level.enumId }}
          </ion-select-option>
        </FilterSelect>
      </SearchFilterCard>

      <ion-list v-if="fraudTasks.length" lines="none">
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
            {{ fraudTasks.length }} {{ fraudTasks.length === 1 ? translate('fraud task') : translate('fraud tasks') }}
          </ion-label>
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate('Done') : translate('Select') }}
          </ion-button>
        </ion-list-header>
      </ion-list>

      <div class="fraud-orders">
        <FraudTaskCard
          v-for="task in fraudTasks"
          :key="task.workEffortId"
          :ref="setCardRef"
          :task="task"
          :selectable="selectMode"
          :selected="!!selectedOrders[task.workEffortId]"
          show-view-order-action
          @update:selected="val => selectedOrders[task.workEffortId] = val"
          @completed="fetchFraudTasks()"
        />
        <div class="empty-state" v-if="!fraudTasks.length">
          <p v-html="getEmptyMessage()"></p>
        </div>
      </div>

      <ion-infinite-scroll
        @ionInfinite="loadMoreFraudTasks($event)"
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
          <ion-button color="primary" :disabled="!selectedTaskCount" @click="bulkResolve">{{ translate('Resolve') }}</ion-button>
          <ion-button color="danger" :disabled="!selectedTaskCount" @click="bulkCancel">{{ translate('Cancel orders') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUpdate } from 'vue';
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonLabel, IonList, IonListHeader, IonMenuButton, IonPage, IonSelectOption, IonTitle, IonToolbar, IonInfiniteScroll, IonInfiniteScrollContent, alertController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import router from '@/router';
import { showToast } from '@/utils';
import FilterSelect from '@/components/common/FilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import FraudTaskCard from '@/components/tasks/FraudTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useUserStore } from '@/store/user';
import { useProductMaster } from '@/composables/useProductMaster';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();
const userStore = useUserStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const riskRecommendations = computed(() => seedStore.getEnumsByType('ORDER_RISK_RECOMMENDATION'));
const riskLevels = computed(() => seedStore.getEnumsByType('ORDER_RISK_LEVEL'));
const currentUserPartyId = computed(() => userStore.getUserProfile?.partyId || userStore.getUserProfile?.userId || '');

const searchQuery = ref('');
const assignee = ref('');
const recommendation = ref('');
const orderChannel = ref('');
const severity = ref('');
const selectMode = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});

// Card component instances, collected in render order to map back to fraudTasks.
const cardRefs = ref<any[]>([]);
const setCardRef = (el: any) => {
  if (el) cardRefs.value.push(el);
};
onBeforeUpdate(() => {
  cardRefs.value = [];
});

const fraudTasks = computed(() => orderTaskStore.getFraudTasks);
const isScrollable = computed(() => orderTaskStore.isFraudTasksScrollable);
const selectedTaskCount = computed(() => Object.values(selectedOrders.value).filter(Boolean).length as number);
const hasFilters = computed(() => !!(searchQuery.value || assignee.value || recommendation.value || orderChannel.value || severity.value));
const currentPageTaskIds = computed(() => fraudTasks.value.map((task: any) => task.workEffortId));
const allCurrentPageSelected = computed(() => currentPageTaskIds.value.length > 0 && currentPageTaskIds.value.every((workEffortId: string) => selectedOrders.value[workEffortId]));
const someCurrentPageSelected = computed(() => currentPageTaskIds.value.some((workEffortId: string) => selectedOrders.value[workEffortId]));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([assignee, orderChannel, recommendation, severity], () => {
  fetchFraudTasks();
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
  searchQuery.value = '';
  assignee.value = '';
  recommendation.value = '';
  orderChannel.value = '';
  severity.value = '';
  router.replace({ query: {} });
  fetchFraudTasks();
}

const fetchFraudTasks = async (pageSize?: any, pageIndex?: any) => {
  await orderTaskStore.fetchFraudTasks({
    pageSize: pageSize ?? import.meta.env.VITE_VIEW_SIZE,
    pageIndex: pageIndex ?? 0,
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(assignee.value === 'me' && currentUserPartyId.value && { currentUserPartyId: currentUserPartyId.value }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
    ...(recommendation.value && { riskRecommendationEnumId: recommendation.value }),
    ...(severity.value && { riskLevelEnumId: severity.value }),
  });

  const productIds = fraudTasks.value
    .flatMap((task: any) => task.items ?? [])
    .map((item: any) => item.productId)
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }
};

async function loadMoreFraudTasks(event: any) {
  await fetchFraudTasks(
    undefined,
    Math.ceil(fraudTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

// Collect the card instances for the currently-selected tasks, in fraudTasks order.
function selectedCards(): any[] {
  return fraudTasks.value
    .map((task: any, index: number) => (selectedOrders.value[task.workEffortId] ? cardRefs.value[index] : null))
    .filter(Boolean);
}

async function bulkResolve() {
  const cards = selectedCards();
  if (!cards.length) return;
  try {
    await Promise.all(cards.map((card: any) => card.submitResolve()));
    await showToast(translate('{count} tasks resolved.', { count: cards.length }));
    selectedOrders.value = {};
    await fetchFraudTasks();
  } catch {
    await showToast(translate('Failed to resolve some tasks. Please try again.'));
  }
}

async function bulkCancel() {
  const cards = selectedCards();
  if (!cards.length) return;
  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} orders? This action cannot be undone.', { count: cards.length }),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Cancel orders'),
        role: 'confirm',
        handler: async () => {
          try {
            await Promise.all(cards.map((card: any) => card.submitCancel()));
            selectedOrders.value = {};
            await fetchFraudTasks();
          } catch {
            await showToast(translate('Failed to cancel some orders. Please try again.'));
          }
        }
      }
    ]
  });
  await alert.present();
}

onIonViewWillEnter(() => {
  fetchFraudTasks();
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
