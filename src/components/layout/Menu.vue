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
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/funnel" router-direction="root" :class="{ selected: selectedPage === '/funnel' }">
            <ion-icon slot="start" :icon="funnelOutline" />
            <ion-label>{{ translate("Funnel") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/orders" router-direction="root" :class="{ selected: selectedPage === '/orders' }">
            <ion-icon slot="start" :icon="searchOutline" />
            <ion-label>{{ translate("Find order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(CUSTOMER_VIEW_PERMISSION)" button router-link="/customers" router-direction="root" :class="{ selected: selectedPage === '/customers' }">
            <ion-icon slot="start" :icon="peopleOutline" />
            <ion-label>{{ translate("Find customers") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(`${ORDER_CREATE_PERMISSION} OR ${CUSTOMER_CREATE_PERMISSION}`)" button router-link="/create-order" router-direction="root" :class="{ selected: selectedPage === '/create-order' }">
            <ion-icon slot="start" :icon="addCircleOutline" />
            <ion-label>{{ translate("Create order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(SWAP_ORDER_PERMISSION) || hasPermission(ORDER_UPDATE_PERMISSION) || hasPermission(ORDER_CANCEL_PERMISSION)">
          <ion-label>{{ translate("Blocked") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/unfillable" router-direction="root" :class="{ selected: selectedPage === '/unfillable' }">
            <ion-icon slot="start" :icon="banOutline" />
            <ion-label>{{ translate("Unfillable") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(SWAP_ORDER_PERMISSION)" button router-link="/swap" router-direction="root" :class="{ selected: selectedPage === '/swap' }">
            <ion-icon slot="start" :icon="alertCircleOutline" />
            <ion-label>{{ translate("Swap") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_UPDATE_PERMISSION)" button router-link="/bad-address" router-direction="root" :class="{ selected: selectedPage === '/bad-address' }">
            <ion-icon slot="start" :icon="locationOutline" />
            <ion-label>{{ translate("Bad address") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_CANCEL_PERMISSION)" button router-link="/fraud" router-direction="root" :class="{ selected: selectedPage === '/fraud' }">
            <ion-icon slot="start" :icon="shieldHalfOutline" />
            <ion-label>{{ translate("Fraud") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_UPDATE_PERMISSION)" button router-link="/hold" router-direction="root" :class="{ selected: selectedPage === '/hold' }">
            <ion-icon slot="start" :icon="pauseCircleOutline" />
            <ion-label>{{ translate("Hold") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(ORDER_VIEW_PERMISSION)">
          <ion-label>{{ translate("In progress") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/brokering" router-direction="root" :class="{ selected: selectedPage === '/brokering' }">
            <ion-icon slot="start" :icon="gitNetworkOutline" />
            <ion-label>{{ translate("Brokering queue") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/open" router-direction="root" :class="{ selected: selectedPage.includes('/open') }">
            <ion-icon slot="start" :icon="playCircleOutline" />
            <ion-label>{{ translate("Open") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/inflight" router-direction="root" :class="{ selected: selectedPage.includes('/inflight') }">
            <ion-icon slot="start" :icon="airplaneOutline" />
            <ion-label>{{ translate("Inflight") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/packed" router-direction="root" :class="{ selected: selectedPage.includes('/packed') }">
            <ion-icon slot="start" :icon="cubeOutline" />
            <ion-label>{{ translate("Packed") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/settings" router-direction="root" :class="{ selected: selectedPage === '/settings' }">
            <ion-icon slot="start" :icon="settingsOutline" />
            <ion-label>{{ translate("Settings") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
      </ion-list>
    </ion-content>

    <ion-footer v-if="currentProductStore?.productStoreId || productStores.length">
      <ion-toolbar>
        <ion-item v-if="productStores.length > 1" lines="none">
          <ion-select :label="translate('Select store')" interface="popover" :value="currentProductStore.productStoreId" @ionChange="setCurrentProductStore($event)">
            <ion-select-option v-for="store in productStores" :key="store.productStoreId" :value="store.productStoreId">
              {{ store.storeName || store.productStoreId }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item v-else-if="currentProductStore?.productStoreId" lines="none">
          <ion-label class="ion-text-wrap">
            <p class="overline">{{ translate("Product Store") }}</p>
            {{ currentProductStore.storeName || currentProductStore.productStoreId }}
          </ion-label>
        </ion-item>
      </ion-toolbar>
    </ion-footer>
  </ion-menu>
</template>

<script setup lang="ts">
import { IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonMenu, IonMenuToggle, IonSelect, IonSelectOption, IonTitle, IonToolbar } from '@ionic/vue';
import {
  addCircleOutline,
  airplaneOutline,
  alertCircleOutline,
  banOutline,
  cubeOutline,
  funnelOutline,
  gitNetworkOutline,
  locationOutline,
  pauseCircleOutline,
  peopleOutline,
  playCircleOutline,
  searchOutline,
  settingsOutline,
  shieldHalfOutline
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
import { useProductStore } from '@/store/productStore';
import { useUserStore } from '@/store/user';
import { computed, onMounted } from 'vue';

const { isAuthenticated } = useAuth();
const userStore = useUserStore();
const productStore = useProductStore();

const currentProductStore = computed(() => productStore.getCurrentProductStore);
const productStores = computed(() => productStore.getProductStores || []);

function hasPermission(permissionId: string) {
  return userStore.hasPermission(permissionId);
}

const selectedPage = computed(() => {
  return router.currentRoute.value.path
})

onMounted(async () => {
  if (isAuthenticated.value && !productStores.value.length) {
    await productStore.fetchProductStores();
    await productStore.fetchProductStorePreference();
  }
})

function setCurrentProductStore(event: CustomEvent) {
  if (currentProductStore.value.productStoreId !== event.detail.value) {
    const selectedProductStore = productStores.value.find((store: any) => store.productStoreId == event.detail.value)
    if (selectedProductStore) {
      productStore.setProductStorePreference(selectedProductStore)
    }
  }
}
</script>

<style scoped>
  ion-menu.md ion-item.selected ion-icon {
    color: var(--ion-color-secondary);
  }
  ion-menu.ios ion-item.selected ion-icon {
    color: var(--ion-color-secondary);
  }
  ion-item.selected {
    --color: var(--ion-color-secondary);
  }
</style>
