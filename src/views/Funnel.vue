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
      div class facets
        ion item class facet item for each product store user is linked to
        ion item h1 product store name globe icon

        ion card class global stat
          div class total orders 
            p class overline date today
            p class big number order count where order date is today
            p time since day start

          div class metrics
            div class metric
              p brokering status
              progress bar
              p picked and packed
              progress bar

        section class drilldown
          ion card
            p class overline open orders
            p class big number orders where status is approved
            p order date from 1st result where status is approved sorted by order date ascending

          ion card
          p class overline unfillable
          p class big number number of orders where facility id equals unfillable
          animated spark line graph

          ion card
          p class overline Order Hold tasks
          p class big number number of orders with hold tasks
          ion item substitute number of workefforts where purpose type is substitute
          ion item bad address number of workefforts where purpose type is bad address
          ion item fraud risk number of workefforts where purpose type is fraud

        br divider

        ion item h1 facility name business icon
        div class dimension
          ion search search facilities
          ion segment
            order volume
            Fulfillment Velocity
            Partial fulfillments

        ion list class facilities
          ion list header Top 10 facilities by selected dimension or Search results
          metric
            ion radio for each facility in result facility name end slot order count
            progress bar where 100% progress is metric count of highest randing facility in given metric
        h1 Fill rate at Facility name
          copy fulfillment dashboard from fulfillment app to here
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
