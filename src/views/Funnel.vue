<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate("Order Funnel") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ translate("Overview") }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="ion-text-center">
            <h2>{{ totalOrders }} {{ translate("Total Orders") }}</h2>
            <p>{{ totalBlocked }} {{ translate("Blocked") }} · {{ totalInProgress }} {{ translate("In Progress") }}</p>
          </div>
        </ion-card-content>
      </ion-card>

      <ion-list>
        <ion-item-divider>
          <ion-label>{{ translate("Blocked") }}</ion-label>
        </ion-item-divider>

        <ion-item button router-link="/unfillable" router-direction="forward">
          <ion-icon slot="start" :icon="alertCircleOutline" color="danger" />
          <ion-label>
            <h2>{{ translate("Unfillable") }}</h2>
            <p>{{ translate("Orders that cannot be filled due to inventory shortage") }}</p>
          </ion-label>
          <ion-badge slot="end" color="danger">{{ counts['unfillable'] }}</ion-badge>
        </ion-item>

        <ion-item button router-link="/bad-address" router-direction="forward">
          <ion-label>
            <h2>{{ translate("Bad address") }}</h2>
          </ion-label>
        </ion-item>

        <ion-item button router-link="/fraud" router-direction="forward">
          <ion-icon slot="start" :icon="shieldHalfOutline" color="danger" />
          <ion-label>
            <h2>{{ translate("Fraud") }}</h2>
            <p>{{ translate("Suspicious orders flagged for manual review") }}</p>
          </ion-label>
          <ion-badge slot="end" color="danger">{{ counts['fraud'] }}</ion-badge>
        </ion-item>

        <ion-item button router-link="/hold" router-direction="forward">
          <ion-label>
            <h2>{{ translate("Hold") }}</h2>
          </ion-label>
        </ion-item>

        <ion-item-divider>
          <ion-label>{{ translate("In Progress") }}</ion-label>
        </ion-item-divider>

        <ion-item button router-link="/open" router-direction="forward">
          <ion-icon slot="start" :icon="playCircleOutline" color="primary" />
          <ion-label>
            <h2>{{ translate("Open") }}</h2>
            <p>{{ translate("Newly created or approved orders awaiting fulfillment") }}</p>
          </ion-label>
          <ion-badge slot="end" color="primary">{{ counts['open'] }}</ion-badge>
        </ion-item>

        <ion-item button router-link="/inflight" router-direction="forward">
          <ion-icon slot="start" :icon="airplaneOutline" color="secondary" />
          <ion-label>
            <h2>{{ translate("Inflight") }}</h2>
            <p>{{ translate("Orders brokered and sent to fulfilment facility") }}</p>
          </ion-label>
          <ion-badge slot="end" color="secondary">{{ counts['inflight'] }}</ion-badge>
        </ion-item>

        <ion-item button router-link="/packed" router-direction="forward">
          <ion-icon slot="start" :icon="cubeOutline" color="success" />
          <ion-label>
            <h2>{{ translate("Packed") }}</h2>
            <p>{{ translate("Orders packed and ready for shipping pick up") }}</p>
          </ion-label>
          <ion-badge slot="end" color="success">{{ counts['packed'] }}</ion-badge>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonMenuButton
} from '@ionic/vue';
import {
  airplaneOutline,
  alertCircleOutline,
  cubeOutline,
  playCircleOutline,
  shieldHalfOutline
} from 'ionicons/icons';
import { computed } from 'vue';
import { translate } from '@common';
import { useCustomerServiceStore } from '@/store/customerService';

const store = useCustomerServiceStore();
const counts = computed(() => store.bucketCounts);

const totalBlocked = computed(() => {
  return counts.value['unfillable'] + counts.value['fraud'];
});

const totalInProgress = computed(() => {
  return counts.value['open'] + counts.value['inflight'] + counts.value['packed'];
});

const totalOrders = computed(() => totalBlocked.value + totalInProgress.value);
</script>
