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
        :show-clear="false"
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

      <SelectAllResultsItem v-if="addressValidationTasks.length" v-model="selectAll" :count="addressValidationTasks.length" />

      <div class="bad-address-list">
        <BadAddressTaskCard
          v-for="task in addressValidationTasks"
          :key="task.workEffortId"
          :task="task"
          :selectable="true"
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
    </ion-content>

    <ion-footer v-if="addressValidationTasks.length">
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
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonMenuButton, IonPage, IonSelectOption, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { translate } from '@common';
import { showToast } from '@/utils';
import DateFilterSelect from '@/components/common/DateFilterSelect.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import SelectAllResultsItem from '@/components/common/SelectAllResultsItem.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import BadAddressTaskCard from '@/components/tasks/BadAddressTaskCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useUserStore } from '@/store/user';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();
const userStore = useUserStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const currentUserPartyId = computed(() => userStore.getUserProfile?.partyId || userStore.getUserProfile?.userId || '');

const searchQuery = ref('');
const assignee = ref('');
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const selectAll = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});

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

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([assignee, dateAfter, dateBefore, orderChannel], () => {
  fetchAddressValidationTasks();
});

watch(selectAll, (val) => {
  addressValidationTasks.value.forEach(task => {
    selectedOrders.value[task.workEffortId] = val;
  });
});

function clearFilters() {
  searchQuery.value = '';
  assignee.value = '';
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  fetchAddressValidationTasks();
}

const fetchAddressValidationTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchAddressValidationTasks({
    viewSize,
    viewIndex,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
    ...(assignee.value === 'me' && currentUserPartyId.value && { currentUserPartyId: currentUserPartyId.value }),
  });
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
          selectAll.value = false;
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
          await Promise.all(cards.map((card: any) => card.submitCancel()));
          selectedOrders.value = {};
          selectAll.value = false;
          await fetchAddressValidationTasks();
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
    selectAll.value = false;
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

@media (max-width: 640px) {
  .bad-address-list {
    padding-inline: 0;
  }
}
</style>
