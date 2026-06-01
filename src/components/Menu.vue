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
          <ion-item button router-link="/funnel" router-direction="root">
            <ion-icon slot="start" :icon="funnelOutline" />
            <ion-label>{{ translate("Funnel") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/orders" router-direction="root">
            <ion-icon slot="start" :icon="searchOutline" />
            <ion-label>{{ translate("Find order") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/customers" router-direction="root">
            <ion-icon slot="start" :icon="peopleOutline" />
            <ion-label>{{ translate("Find customers") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider>
          <ion-label>{{ translate("Blocked") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/unfillable" router-direction="root">
            <ion-icon slot="start" :icon="alertCircleOutline" />
            <ion-label>{{ translate("Unfillable") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/bad-address" router-direction="root">
            <ion-icon slot="start" :icon="locationOutline" />
            <ion-label>{{ translate("Bad address") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/fraud" router-direction="root">
            <ion-icon slot="start" :icon="shieldHalfOutline" />
            <ion-label>{{ translate("Fraud") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/hold" router-direction="root">
            <ion-icon slot="start" :icon="pauseCircleOutline" />
            <ion-label>{{ translate("Hold") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-item-divider>
          <ion-label>{{ translate("In progress") }}</ion-label>
        </ion-item-divider>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/open" router-direction="root">
            <ion-icon slot="start" :icon="playCircleOutline" />
            <ion-label>{{ translate("Open") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/inflight" router-direction="root">
            <ion-icon slot="start" :icon="airplaneOutline" />
            <ion-label>{{ translate("Inflight") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/packed" router-direction="root">
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
import router from '@/router';

const { isAuthenticated } = useAuth();
</script>
