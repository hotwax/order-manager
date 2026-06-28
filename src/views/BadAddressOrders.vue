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
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search')"
        @search="fetchAddressValidationTasks()"
        @clear="clearFilters"
      >
        <FilterSelect v-model="assignee" :label="translate('Assignee')">
          <ion-select-option value="">{{ translate('All assignees') }}</ion-select-option>
          <ion-select-option value="me">{{ translate('Me') }}</ion-select-option>
        </FilterSelect>
        <DateFilterSelect v-model="dateAfter" :label="translate('Date after')" />
        <DateFilterSelect v-model="dateBefore" :label="translate('Date before')" />
        <FilterSelect v-model="orderChannel" :label="translate('Channel')">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </FilterSelect>
      </SearchFilterCard>

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
        <ion-list v-if="addressValidationTasks.length" lines="none">
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
              {{ addressValidationTasks.length }} {{ addressValidationTasks.length === 1 ? translate('bad address task') : translate('bad address tasks') }}
            </ion-label>
            <ion-button fill="clear" size="small" @click="toggleSelectMode">
              {{ selectMode ? translate('Done') : translate('Select') }}
            </ion-button>
          </ion-list-header>
        </ion-list>

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
          <div class="empty-state" v-if="!addressValidationTasks.length">
            <p v-html="getEmptyMessage()"></p>
          </div>
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
          <ion-button fill="solid" color="primary" :disabled="!hasSelectedTasks" @click="bulkSaveAndReleaseHold()">{{ translate('Save and Release Hold') }}</ion-button>
          <ion-button fill="outline" color="danger" :disabled="!hasSelectedTasks" @click="bulkCancelOrder()">{{ translate('Cancel Order') }}</ion-button>
          <ion-button fill="outline" color="medium" :disabled="!hasSelectedTasks" @click="bulkParkOrder()">{{ translate('Park') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUpdate } from 'vue';
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonList, IonListHeader, IonMenuButton, IonPage, IonSelectOption, IonSpinner, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import router from '@/router';
import { showToast } from '@/utils';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useUserStore } from '@/store/user';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();
const userStore = useUserStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
// Computed once here and passed as a prop — avoids N per-card reactive subscriptions.
const countries = computed(() => seedStore.getCountries);
const currentUserPartyId = computed(() => userStore.getUserProfile?.partyId || userStore.getUserProfile?.userId || '');

const searchQuery = ref('');
const assignee = ref('');
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const selectMode = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});
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
const isScrollable = computed(() => orderTaskStore.isAddressValidationTasksScrollable);
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => !!(searchQuery.value || assignee.value || dateAfter.value || dateBefore.value || orderChannel.value));
const currentPageTaskIds = computed(() => addressValidationTasks.value.map((task: any) => task.workEffortId));
const allCurrentPageSelected = computed(() => currentPageTaskIds.value.length > 0 && currentPageTaskIds.value.every((workEffortId: string) => selectedOrders.value[workEffortId]));
const someCurrentPageSelected = computed(() => currentPageTaskIds.value.some((workEffortId: string) => selectedOrders.value[workEffortId]));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

// Each card builds its own address form lazily (see BadAddressTaskCard); the view
// only prunes selections for tasks that drop out of the list on refresh.
watch(addressValidationTasks, (tasks) => {
  const incoming = new Set(tasks.map((t: any) => t.workEffortId));
  Object.keys(selectedOrders.value).forEach(id => {
    if (!incoming.has(id)) delete selectedOrders.value[id];
  });
});

watch([assignee, dateAfter, dateBefore, orderChannel], () => {
  fetchAddressValidationTasks();
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
  addressValidationTasks.value.forEach((task: any) => {
    selectedOrders.value[task.workEffortId] = checked;
  });
}

function clearFilters() {
  searchQuery.value = '';
  assignee.value = '';
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  router.replace({ query: {} });
  fetchAddressValidationTasks();
}

const fetchAddressValidationTasks = async (pageSize?: any, pageIndex?: any) => {
  // Show the full-page loading/error state only when there is nothing to show yet
  // (first open of the route). Infinite-scroll pages and reloads after an action
  // keep the existing, already-hydrated cards visible while they refresh.
  const showFullLoading = !pageIndex && !addressValidationTasks.value.length;
  if (showFullLoading) {
    loading.value = true;
    error.value = '';
  }
  try {
    const ok = await orderTaskStore.fetchAddressValidationTasks({
      pageSize: pageSize ?? import.meta.env.VITE_VIEW_SIZE,
      pageIndex: pageIndex ?? 0,
      ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
      ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
      ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
      ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
      ...(assignee.value === 'me' && currentUserPartyId.value && { currentUserPartyId: currentUserPartyId.value }),
    });
    if (!ok) {
      if (showFullLoading) error.value = translate('Failed to load bad address tasks. Please try again.');
      return;
    }
  } finally {
    if (showFullLoading) loading.value = false;
  }
};

function getSelectedCards() {
  return cardRefs.value.filter((card: any) => card && selectedOrders.value[card.task.workEffortId]);
}

async function bulkSaveAndReleaseHold() {
  const cards = getSelectedCards();
  if (!cards.length) return;

  const invalidCard = cards.find((card: any) => !!card.validate());
  if (invalidCard) {
    await showToast(invalidCard.validate()!);
    return;
  }

  const alert = await alertController.create({
    header: translate('Save and release hold'),
    message: translate('Are you sure you want to save address and release hold for {count} selected order(s)?').replace('{count}', String(cards.length)),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Save and release hold'),
        role: 'confirm',
        handler: async () => {
          await Promise.all(cards.map((card: any) => card.submitSaveAndRelease()));
          selectedOrders.value = {};
          await fetchAddressValidationTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function bulkCancelOrder() {
  const cards = getSelectedCards();
  if (!cards.length) return;

  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} selected order(s)? This action cannot be undone.').replace('{count}', String(cards.length)),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Cancel orders'),
        role: 'confirm',
        handler: async () => {
          try {
            await Promise.all(cards.map((card: any) => card.submitCancel()));
            selectedOrders.value = {};
            await fetchAddressValidationTasks();
          } catch {
            await showToast(translate('Failed to cancel some orders. Please try again.'));
          }
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

  try {
    await Promise.all(cards.map((card: any) => card.submitPark(facilityId)));
    selectedOrders.value = {};
    await showToast(translate('Orders successfully moved to parking.'));
    await fetchAddressValidationTasks();
  } catch {
    await showToast(translate('Failed to park one or more orders. Please try again.'));
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
  fetchAddressValidationTasks();
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
