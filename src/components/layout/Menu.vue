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
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/funnel" router-direction="root" :class="{ selected: selectedPage === '/funnel' }">
            <ion-icon slot="start" :icon="funnelOutline" />
            <ion-label>{{ translate("Funnel") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/orders" router-direction="root" :class="{ selected: selectedPage === '/orders' }">
            <ion-icon slot="start" :icon="searchOutline" />
            <ion-label>{{ translate("Find order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDER_RETURN_VIEW)" button router-link="/returns" router-direction="root" :class="{ selected: selectedPage.startsWith('/returns') }">
            <ion-icon slot="start" :icon="arrowUndoOutline" />
            <ion-label>{{ translate("Find returns") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_CUSTOMERS_VIEW)" button router-link="/customers" router-direction="root" :class="{ selected: selectedPage === '/customers' }">
            <ion-icon slot="start" :icon="peopleOutline" />
            <ion-label>{{ translate("Find customers") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider color="light" v-if="hasPermission(Actions.APP_ORDERS_VIEW) || hasPermission(Actions.APP_SWAP_ORDER) || hasPermission(Actions.APP_ORDER_UPDATE) || hasPermission(Actions.APP_ORDER_CANCEL)">
          <ion-label>{{ translate("Blocked") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/unfillable" router-direction="root" :class="{ selected: selectedPage === '/unfillable' }">
            <ion-icon slot="start" :icon="banOutline" />
            <ion-label>{{ translate("Unfillable") }}</ion-label>
            <ion-badge v-if="rollupCounts.unfillable !== undefined" slot="end" color="medium">{{ rollupCounts.unfillable }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_SWAP_ORDER)" button router-link="/swap" router-direction="root" :class="{ selected: selectedPage === '/swap' }">
            <ion-icon slot="start" :icon="alertCircleOutline" />
            <ion-label>{{ translate("Swap") }}</ion-label>
            <ion-badge v-if="rollupCounts.swap !== undefined" slot="end" color="medium">{{ rollupCounts.swap }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDER_UPDATE)" button router-link="/bad-address" router-direction="root" :class="{ selected: selectedPage === '/bad-address' }">
            <ion-icon slot="start" :icon="locationOutline" />
            <ion-label>{{ translate("Bad address") }}</ion-label>
            <ion-badge v-if="rollupCounts.badAddress !== undefined" slot="end" color="medium">{{ rollupCounts.badAddress }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDER_CANCEL)" button router-link="/fraud" router-direction="root" :class="{ selected: selectedPage === '/fraud' }">
            <ion-icon slot="start" :icon="shieldHalfOutline" />
            <ion-label>{{ translate("Fraud") }}</ion-label>
            <ion-badge v-if="rollupCounts.fraud !== undefined" slot="end" color="medium">{{ rollupCounts.fraud }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDER_UPDATE)" button router-link="/hold" router-direction="root" :class="{ selected: selectedPage === '/hold' }">
            <ion-icon slot="start" :icon="pauseCircleOutline" />
            <ion-label>{{ translate("Hold") }}</ion-label>
            <ion-badge v-if="rollupCounts.hold !== undefined" slot="end" color="medium">{{ rollupCounts.hold }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider color="light" v-if="hasPermission(Actions.APP_ORDERS_VIEW)">
          <ion-label>{{ translate("In progress") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/brokering" router-direction="root" :class="{ selected: selectedPage === '/brokering' }">
            <ion-icon slot="start" :icon="gitNetworkOutline" />
            <ion-label>{{ translate("Brokering queue") }}</ion-label>
            <ion-badge v-if="rollupCounts.brokering !== undefined" slot="end" color="medium">{{ rollupCounts.brokering }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/open" router-direction="root" :class="{ selected: selectedPage.includes('/open') }">
            <ion-icon slot="start" :icon="playCircleOutline" />
            <ion-label>{{ translate("Open") }}</ion-label>
            <ion-badge v-if="rollupCounts.open !== undefined" slot="end" color="medium">{{ rollupCounts.open }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/inflight" router-direction="root" :class="{ selected: selectedPage.includes('/inflight') }">
            <ion-icon slot="start" :icon="airplaneOutline" />
            <ion-label>{{ translate("Inflight") }}</ion-label>
            <ion-badge v-if="rollupCounts.inflight !== undefined" slot="end" color="medium">{{ rollupCounts.inflight }}</ion-badge>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(Actions.APP_ORDERS_VIEW)" button router-link="/packed" router-direction="root" :class="{ selected: selectedPage.includes('/packed') }">
            <ion-icon slot="start" :icon="cubeOutline" />
            <ion-label>{{ translate("Packed") }}</ion-label>
            <ion-badge v-if="rollupCounts.packed !== undefined" slot="end" color="medium">{{ rollupCounts.packed }}</ion-badge>
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

    <DxpOmsInstanceFooter
      v-if="isAuthenticated"
      :instance-label="omsInstanceLabel()"
      :product-stores="productStores"
      :current-product-store-id="currentProductStore?.productStoreId"
      @update:product-store="setCurrentProductStore"
    />
  </ion-menu>
</template>

<script setup lang="ts">
import { IonBadge, IonContent, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonMenu, IonMenuToggle, IonTitle, IonToolbar } from '@ionic/vue';
import {
  airplaneOutline,
  alertCircleOutline,
  arrowUndoOutline,
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
import { commonUtil, DxpOmsInstanceFooter, translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import router from '@/router';
import { useOrderStore } from '@/store/order';
import { useProductStore } from '@/store/productStore';
import { useUserStore } from '@/store/user';
import { computed, onMounted } from 'vue';
import Actions from "@/authorization/actions";

const HOTWAX_HOST_SUFFIX = ".hotwax.io";

const { isAuthenticated } = useAuth();
const userStore = useUserStore();
const productStore = useProductStore();
const orderStore = useOrderStore();

const currentProductStore = computed(() => productStore.getCurrentProductStore);
const productStores = computed(() => productStore.getProductStores || []);
const userProfile = computed(() => userStore.getUserProfile);

// Called from the template rather than memoised: getOmsURL() reads a cookie, so a
// computed would cache the pre-login empty value for the life of the session.
function omsInstanceLabel() {
  const omsURL = commonUtil.getOmsURL();
  if(!omsURL) {return "";}

  const host = omsURL.replace(/^https?:\/\//, "").split("/")[0];

  return host.endsWith(HOTWAX_HOST_SUFFIX) ? host.slice(0, -HOTWAX_HOST_SUFFIX.length) : host;
}

// Queue rollups shown as menu badges. Each count is published to this shared map as
// a byproduct of the matching page (or the Funnel) fetching its own data, so the
// badge reflects the latest count the app has loaded. A missing key = not yet loaded.
const rollupCounts = computed(() => orderStore.navCounts);

function hasPermission(permissionId: string) {
  return userStore.hasPermission(permissionId);
}

const selectedPage = computed(() => {
  return router.currentRoute.value.path
})

onMounted(async () => {
  if (isAuthenticated.value) {
    await productStore.initializeProductStore();
  }
})

function setCurrentProductStore(productStoreId: string) {
  if (currentProductStore.value.productStoreId !== productStoreId) {
    const selectedProductStore = productStores.value.find((store: any) => store.productStoreId == productStoreId)
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
