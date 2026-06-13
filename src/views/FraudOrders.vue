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
        :show-clear="false"
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

      <SelectAllResultsItem v-if="fraudTasks.length" v-model="selectAll" :count="fraudTasks.length" />

      <div class="fraud-orders">
        <FraudTaskCard
          v-for="task in fraudTasks"
          :key="task.workEffortId"
          :ref="setCardRef"
          :task="task"
          :selectable="true"
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

    <ion-footer v-if="fraudTasks.length">
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
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonMenuButton, IonPage, IonSelectOption, IonTitle, IonToolbar, IonInfiniteScroll, IonInfiniteScrollContent, alertController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import { showToast } from '@/utils';
import FilterSelect from '@/components/common/FilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import SelectAllResultsItem from '@/components/common/SelectAllResultsItem.vue';
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
const selectAll = ref(false);
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

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch(selectAll, (val) => {
  fraudTasks.value.forEach((task: any) => {
    selectedOrders.value[task.workEffortId] = val;
  });
});

watch([assignee, orderChannel, recommendation, severity], () => {
  fetchFraudTasks();
});

function clearFilters() {
  searchQuery.value = '';
  assignee.value = '';
  recommendation.value = '';
  orderChannel.value = '';
  severity.value = '';
  fetchFraudTasks();
}

const fetchFraudTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchFraudTasks({
    viewSize,
    viewIndex,
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
    selectAll.value = false;
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
          await Promise.all(cards.map((card: any) => card.submitCancel()));
          selectedOrders.value = {};
          selectAll.value = false;
          await fetchFraudTasks();
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

@media (max-width: 640px) {
  .fraud-orders {
    padding-inline: 0;
  }
}
</style>
