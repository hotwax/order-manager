<template>
  <ion-menu side="start" content-id="main-content" type="overlay" :disabled="!isAuthenticated || router.currentRoute.value.path === '/login'">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Order Manager") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/funnel" router-direction="root">
            <ion-icon slot="start" :icon="funnelOutline" />
            <ion-label>{{ translate("Funnel") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(SWAP_ORDER_PERMISSION) || hasPermission(ORDER_UPDATE_PERMISSION) || hasPermission(ORDER_CANCEL_PERMISSION)">
          <ion-label>{{ translate("Blocked") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(SWAP_ORDER_PERMISSION)" button router-link="/unfillable" router-direction="root">
            <ion-icon slot="start" :icon="alertCircleOutline" />
            <ion-label>{{ translate("Unfillable") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatSwappableCount(menuCounts.unfillable) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_UPDATE_PERMISSION)" button router-link="/bad-address" router-direction="root">
            <ion-icon slot="start" :icon="locationOutline" />
            <ion-label>{{ translate("Bad address") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatCount(menuCounts.badAddress) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_CANCEL_PERMISSION)" button router-link="/fraud" router-direction="root">
            <ion-icon slot="start" :icon="shieldHalfOutline" />
            <ion-label>{{ translate("Fraud") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatCount(menuCounts.fraud) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_UPDATE_PERMISSION)" button router-link="/hold" router-direction="root">
            <ion-icon slot="start" :icon="pauseCircleOutline" />
            <ion-label>{{ translate("Hold") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatCount(menuCounts.hold) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(ORDER_VIEW_PERMISSION)">
          <ion-label>{{ translate("In progress") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/open" router-direction="root">
            <ion-icon slot="start" :icon="playCircleOutline" />
            <ion-label>{{ translate("Open") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatCount(menuCounts.open) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/inflight" router-direction="root">
            <ion-icon slot="start" :icon="airplaneOutline" />
            <ion-label>{{ translate("Inflight") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatCount(menuCounts.inflight) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/packed" router-direction="root">
            <ion-icon slot="start" :icon="cubeOutline" />
            <ion-label>{{ translate("Packed") }}</ion-label>
            <ion-note v-if="showMenuCounts" slot="end">{{ formatCount(menuCounts.packed) }}</ion-note>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(ORDER_VIEW_PERMISSION) || hasPermission(CUSTOMER_VIEW_PERMISSION) || hasPermission(`${ORDER_CREATE_PERMISSION} OR ${CUSTOMER_CREATE_PERMISSION}`)">
          <ion-label>{{ translate("Find") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/orders" router-direction="root">
            <ion-icon slot="start" :icon="ticketOutline" />
            <ion-label>{{ translate("Orders") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(CUSTOMER_VIEW_PERMISSION)" button router-link="/customers" router-direction="root">
            <ion-icon slot="start" :icon="personCircleOutline" />
            <ion-label>{{ translate("Customers") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(`${ORDER_CREATE_PERMISSION} OR ${CUSTOMER_CREATE_PERMISSION}`)" button router-link="/create-order" router-direction="root">
            <ion-icon slot="start" :icon="addCircleOutline" />
            <ion-label>{{ translate("Create order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/settings" router-direction="root">
            <ion-icon slot="start" :icon="settingsOutline" />
            <ion-label>{{ translate("Settings") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
      </ion-list>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonMenu, IonMenuToggle, IonNote, IonTitle, IonToolbar } from '@ionic/vue';
import {
  addCircleOutline,
  airplaneOutline,
  alertCircleOutline,
  cubeOutline,
  funnelOutline,
  locationOutline,
  pauseCircleOutline,
  personCircleOutline,
  playCircleOutline,
  settingsOutline,
  shieldHalfOutline,
  ticketOutline
} from 'ionicons/icons';
import { translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import {
  CUSTOMER_CREATE_PERMISSION,
  CUSTOMER_VIEW_PERMISSION,
  ORDER_CANCEL_PERMISSION,
  ORDER_CREATE_PERMISSION,
  ORDER_UPDATE_PERMISSION,
  ORDER_VIEW_PERMISSION,
  SWAP_ORDER_PERMISSION
} from '@/authorization/permissions';
import router from '@/router';
import { useCustomerServiceStore } from '@/store/customerService';
import { useOrderStore } from '@/store/order';
import { useProductStore } from '@/store/productStore';
import { useUserStore } from '@/store/user';

const { isAuthenticated } = useAuth();
const userStore = useUserStore();
const customerServiceStore = useCustomerServiceStore();
const orderStore = useOrderStore();
const productStore = useProductStore();
const menuCountsLoadedFor = ref('');
const showMenuCounts = ref(false);

const currentProductStoreId = computed(() =>
  productStore.getCurrentProductStore?.productStoreId || productStore.getProductStores?.[0]?.productStoreId || ''
);

const menuCounts = computed(() => {
  const holdTasks = customerServiceStore.getHoldTasks;
  const openOrderTotal = orderStore.workflowOrdersTotal.open || customerServiceStore.getOpenOrders.openOrdersCount || 0;

  return {
    unfillable: customerServiceStore.unfillableTrend.reduce((total, count) => total + count, 0),
    badAddress: Number(holdTasks.holdBadAddressCount || 0),
    fraud: Number(holdTasks.holdFraudRiskCount || 0),
    hold: Number(holdTasks.holdTasksTotalCount || 0),
    open: Number(openOrderTotal || 0),
    inflight: Number(orderStore.workflowOrdersTotal.inflight || 0),
    packed: Number(orderStore.workflowOrdersTotal.packed || 0)
  };
});

function hasPermission(permissionId: string) {
  return userStore.hasPermission(permissionId);
}

function menuCountFilters(bucket: 'open' | 'inflight' | 'packed') {
  return {
    ...customerServiceStore.filters[bucket],
    productStoreId: currentProductStoreId.value || 'All'
  };
}

async function loadMenuCounts() {
  const productStoreId = currentProductStoreId.value;
  const cacheKey = productStoreId || 'all';

  if (menuCountsLoadedFor.value === cacheKey) return;

  menuCountsLoadedFor.value = cacheKey;
  const requests: Promise<unknown>[] = [];

  if (hasPermission(SWAP_ORDER_PERMISSION) || hasPermission(ORDER_UPDATE_PERMISSION) || hasPermission(ORDER_CANCEL_PERMISSION)) {
    requests.push(customerServiceStore.fetchUnfillable(productStoreId));
    requests.push(customerServiceStore.fetchHoldTasks(productStoreId));
  }

  if (hasPermission(ORDER_VIEW_PERMISSION)) {
    requests.push(customerServiceStore.fetchOpenOrders(productStoreId));
    requests.push(orderStore.fetchWorkflowOrders('open', menuCountFilters('open')));
    requests.push(orderStore.fetchWorkflowOrders('inflight', menuCountFilters('inflight')));
    requests.push(orderStore.fetchWorkflowOrders('packed', menuCountFilters('packed')));
  }

  if (!requests.length) return;

  await Promise.allSettled(requests);
  showMenuCounts.value = true;
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString();
}

function formatSwappableCount(value: number) {
  return translate('{count} swappable', { count: formatCount(value) });
}

watch(
  () => [isAuthenticated.value, currentProductStoreId.value] as const,
  ([authenticated]) => {
    if (!authenticated) return;
    loadMenuCounts();
  },
  { immediate: true }
);
</script>
