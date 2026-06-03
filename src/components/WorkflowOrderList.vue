<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="filters.query"
        :placeholder="searchPlaceholder"
        @clear="clearFilters"
      >
        <ion-select v-model="filters.productStoreId" label="Product store" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All stores</ion-select-option>
          <ion-select-option v-for="store in store.productStores" :key="store.id" :value="store.id">
            {{ store.name }}
          </ion-select-option>
        </ion-select>
        <ion-select v-model="filters.salesChannelEnumId" label="Channel" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All channels</ion-select-option>
          <ion-select-option v-for="channel in store.channels" :key="channel" :value="channel">
            {{ formatChannel(channel) }}
          </ion-select-option>
        </ion-select>
        <ion-select v-if="showFacility" v-model="filters.facilityId" label="Facility" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All facilities</ion-select-option>
          <ion-select-option v-for="facility in store.facilities" :key="facility.id" :value="facility.id">
            {{ facility.name }}
          </ion-select-option>
        </ion-select>
        <ion-select v-model="filters.priority" label="Priority" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All priorities</ion-select-option>
          <ion-select-option v-for="priority in store.priorities" :key="priority" :value="priority">
            {{ priority }}
          </ion-select-option>
        </ion-select>
        <ion-input v-model="filters.dateFrom" label="Order date from" label-placement="stacked" type="date" />
        <ion-input v-model="filters.dateThru" label="Order date thru" label-placement="stacked" type="date" />
      </SearchFilterCard>

      <ion-list>
        <ion-list-header>
          <ion-checkbox
            v-if="selectMode"
            :checked="allCurrentPageSelected"
            :indeterminate="someCurrentPageSelected && !allCurrentPageSelected"
            @ion-change="toggleCurrentPageSelection($event.detail.checked)"
          />
          <ion-label>{{ orders.length }} {{ orders.length === 1 ? 'order' : 'orders' }}</ion-label>
          <ion-button fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? 'Done' : 'Select' }}
          </ion-button>
        </ion-list-header>
        <ion-item
          v-for="order in orders"
          :key="order.orderId"
          button
          :router-link="selectMode ? undefined : orderDetailLink(order)"
          @click="toggleOrderSelection(order.orderId)"
        >
          <ion-checkbox
            v-if="selectMode"
            slot="start"
            :checked="selectedIds.has(order.orderId)"
            @click.stop
            @ion-change="setOrderSelection(order.orderId, $event.detail.checked)"
          />
          <ion-label>
            <h2>{{ order.orderName }} · {{ order.externalId }}</h2>
            <p>{{ order.customerName }} · {{ order.productStoreName }} · {{ formatChannel(order.salesChannelEnumId) }}</p>
            <p>
              {{ formatDate(order.orderDate) }} · {{ order.itemCount }} item{{ order.itemCount === 1 ? '' : 's' }} ·
              {{ order.shipmentMethodDesc }}
              <template v-if="order.facilityName"> · {{ order.facilityName }}</template>
            </p>
          </ion-label>
          <ion-note slot="end">
            <div>{{ order.priority }}</div>
            <div>{{ formatCurrency(order.grandTotal, order.currencyUomId) }}</div>
          </ion-note>
        </ion-item>
      </ion-list>

      <EmptyState
        v-if="!orders.length"
        :title="emptyTitle"
        :message="emptyMessage"
      />
    </ion-content>

    <ion-footer v-if="selectMode">
      <ion-toolbar>
        <ion-title size="small">{{ selectedIds.size }} selected</ion-title>
        <ion-buttons slot="end">
          <ion-button
            v-for="action in actions"
            :key="action.id"
            :disabled="!selectedIds.size"
            @click="runAction(action)"
          >
            {{ action.label }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>

    <ion-toast
      :is-open="!!toastMessage"
      :message="toastMessage"
      :duration="2000"
      position="top"
      @did-dismiss="toastMessage = ''"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar,
  alertController
} from '@ionic/vue';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { DateTime } from 'luxon';
import { useCustomerServiceStore, BULK_ACTIONS } from '@/store/customerService';
import type { BulkActionDefinition, WorkflowBucket, WorkflowOrder } from '@/types/customerService';
import EmptyState from '@/components/EmptyState.vue';
import SearchFilterCard from '@/components/SearchFilterCard.vue';
import { commonUtil } from '@common';

const actualOrderIds = ['M100051'];
const fallbackActualOrderId = actualOrderIds[Math.floor(Math.random() * actualOrderIds.length)];

const props = defineProps<{
  bucket: WorkflowBucket;
  title: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyMessage: string;
  showFacility?: boolean;
}>();

const store = useCustomerServiceStore();
const route = useRoute();
const toastMessage = ref('');

const filters = computed({
  get: () => store.filters[props.bucket],
  set: (value) => (store.filters[props.bucket] = value)
});

const orders = computed(() => store.filteredOrders(props.bucket));
const selectedIds = computed(() => new Set(store.selection[props.bucket]));
const actions = computed<BulkActionDefinition[]>(() => BULK_ACTIONS[props.bucket]);
const selectMode = ref(false);
const currentPageOrderIds = computed(() => orders.value.map((order) => order.orderId));
const allCurrentPageSelected = computed(() => {
  return currentPageOrderIds.value.length > 0 && currentPageOrderIds.value.every((orderId) => selectedIds.value.has(orderId));
});
const someCurrentPageSelected = computed(() => currentPageOrderIds.value.some((orderId) => selectedIds.value.has(orderId)));

function queryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function applyRouteFilters() {
  const productStoreId = queryValue(route.query.productStoreId);
  const facilityId = queryValue(route.query.facilityId);

  if (typeof productStoreId === 'string') {
    filters.value.productStoreId = productStoreId;
  }

  if (typeof facilityId === 'string') {
    filters.value.facilityId = facilityId;
  }
}

watch(() => route.query, applyRouteFilters, { immediate: true });

watch(orders, () => {
  const currentOrderIds = new Set(currentPageOrderIds.value);
  store.setSelection(
    props.bucket,
    store.selection[props.bucket].filter((orderId) => currentOrderIds.has(orderId))
  );
});

function clearFilters() {
  store.clearFilters(props.bucket);
}

function enterSelectMode() {
  selectMode.value = true;
}

function exitSelectMode() {
  selectMode.value = false;
  store.clearSelection(props.bucket);
}

function toggleSelectMode() {
  if (selectMode.value) {
    exitSelectMode();
    return;
  }

  enterSelectMode();
}

function toggleCurrentPageSelection(checked: boolean) {
  store.setSelection(props.bucket, checked ? [...currentPageOrderIds.value] : []);
}

function toggleOrderSelection(orderId: string) {
  if (!selectMode.value) return;
  setOrderSelection(orderId, !selectedIds.value.has(orderId));
}

function setOrderSelection(orderId: string, checked: boolean) {
  const currentSelection = new Set(store.selection[props.bucket]);

  if (checked) {
    currentSelection.add(orderId);
  } else {
    currentSelection.delete(orderId);
  }

  store.setSelection(props.bucket, [...currentSelection]);
}

function orderDetailLink(order: WorkflowOrder) {
  return `/orders/${order.orderId.startsWith('ORD-') ? fallbackActualOrderId : order.orderId}`;
}

async function runAction(action: BulkActionDefinition) {
  if (!selectedIds.value.size) return;

  if (action.confirmText) {
    const alert = await alertController.create({
      header: action.label,
      message: action.confirmText,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Confirm', role: 'confirm' }
      ]
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return;
  }

  const count = selectedIds.value.size;
  store.runBulkAction(props.bucket, action.id);
  toastMessage.value = `${action.label} · ${count} order${count === 1 ? '' : 's'}`;
}

function formatChannel(channel: string) {
  return channel
    .replace(/_SALES_CHANNEL$/, '')
    .replace(/_CHANNEL$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(iso: string) {
  if (!iso) return '';
  return DateTime.fromISO(iso).toFormat('LLL d, h:mma');
}

function formatCurrency(amount: number, currency: string) {
  return commonUtil.formatCurrency(amount, currency);
}

</script>
