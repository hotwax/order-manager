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
        :show-clear="false"
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

      <SelectAllResultsItem v-if="heldTasks.length" v-model="selectAll" :count="heldTasks.length" />

      <div class="hold-orders-list">
        <HoldTaskCard
          v-if="heldTasks.length"
          v-for="task in heldTasks"
          :key="task.workEffortId"
          :ref="(el) => setCardRef(task.workEffortId, el)"
          :task="task"
          :selectable="true"
          :selected="!!selectedOrders[task.workEffortId]"
          show-view-order-action
          @update:selected="val => selectedOrders[task.workEffortId] = val"
          @completed="fetchHoldTasks()"
        />
        <div class="empty-state" v-if="!heldTasks.length">
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

    <ion-footer v-if="heldTasks.length">
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
  IonContent,
  IonFooter,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonSelectOption,
  alertController,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  onIonViewWillEnter
} from '@ionic/vue';
import { translate } from '@common';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import SelectAllResultsItem from '@/components/common/SelectAllResultsItem.vue';
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
const swappable = ref(false);
const assignee = ref('');
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const selectAll = ref(false);
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
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => !!(searchQuery.value || assignee.value || dateAfter.value || dateBefore.value || orderChannel.value));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([assignee, dateAfter, dateBefore, orderChannel], () => {
  fetchHoldTasks();
});

watch(selectAll, (val) => {
  heldTasks.value.forEach(task => {
    selectedOrders.value[task.workEffortId] = val;
  });
});

function clearFilters() {
  searchQuery.value = '';
  swappable.value = false;
  assignee.value = '';
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
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
          selectAll.value = false;
          await fetchHoldTasks();
        }
      }
    ]
  });
  await alert.present();
}


const fetchHoldTasks = async (pageSize?: any, pageIndex?: any) => {
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

@media (max-width: 640px) {
  .hold-orders-list {
    padding-inline: 0;
  }
}
</style>
