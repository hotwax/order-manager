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
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/orders" router-direction="root">
            <ion-icon slot="start" :icon="searchOutline" />
            <ion-label>{{ translate("Find order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(CUSTOMER_VIEW_PERMISSION)" button router-link="/customers" router-direction="root">
            <ion-icon slot="start" :icon="peopleOutline" />
            <ion-label>{{ translate("Find customers") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(`${ORDER_CREATE_PERMISSION} OR ${CUSTOMER_CREATE_PERMISSION}`)" button router-link="/create-order" router-direction="root">
            <ion-icon slot="start" :icon="addCircleOutline" />
            <ion-label>{{ translate("Create order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(SWAP_ORDER_PERMISSION) || hasPermission(ORDER_UPDATE_PERMISSION) || hasPermission(ORDER_CANCEL_PERMISSION)">
          <ion-label>{{ translate("Blocked") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(SWAP_ORDER_PERMISSION)" button router-link="/swap" router-direction="root">
            <ion-icon slot="start" :icon="alertCircleOutline" />
            <ion-label>{{ translate("Swap") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_UPDATE_PERMISSION)" button router-link="/bad-address" router-direction="root">
            <ion-icon slot="start" :icon="locationOutline" />
            <ion-label>{{ translate("Bad address") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_CANCEL_PERMISSION)" button router-link="/fraud" router-direction="root">
            <ion-icon slot="start" :icon="shieldHalfOutline" />
            <ion-label>{{ translate("Fraud") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_UPDATE_PERMISSION)" button router-link="/hold" router-direction="root">
            <ion-icon slot="start" :icon="pauseCircleOutline" />
            <ion-label>{{ translate("Hold") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider v-if="hasPermission(ORDER_VIEW_PERMISSION)">
          <ion-label>{{ translate("In progress") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/open" router-direction="root">
            <ion-icon slot="start" :icon="playCircleOutline" />
            <ion-label>{{ translate("Open") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/inflight" router-direction="root">
            <ion-icon slot="start" :icon="airplaneOutline" />
            <ion-label>{{ translate("Inflight") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item v-if="hasPermission(ORDER_VIEW_PERMISSION)" button router-link="/packed" router-direction="root">
            <ion-icon slot="start" :icon="cubeOutline" />
            <ion-label>{{ translate("Packed") }}</ion-label>
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
import { IonContent, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonMenu, IonMenuToggle, IonTitle, IonToolbar } from '@ionic/vue';
import {
  addCircleOutline,
  airplaneOutline,
  alertCircleOutline,
  cubeOutline,
  funnelOutline,
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
import { useUserStore } from '@/store/user';

const { isAuthenticated } = useAuth();
const userStore = useUserStore();

function hasPermission(permissionId: string) {
  return userStore.hasPermission(permissionId);
}
</script>
