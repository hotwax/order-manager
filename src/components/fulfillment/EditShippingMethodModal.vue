<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Edit Shipping Method') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <!-- Carriers are a short, stable list, so they are laid out flat instead of behind a popover:
         picking one is a single tap and the whole set is visible at once. -->
    <ion-radio-group v-model="selectedCarrierId">
      <ion-list lines="none">
        <ion-list-header>
          <ion-label>{{ translate('Carrier') }}</ion-label>
        </ion-list-header>
        <ion-item v-if="!availableCarriers.length">
          <ion-label color="medium">{{ translate('No carriers found') }}</ion-label>
        </ion-item>
        <ion-item v-for="carrier in availableCarriers" :key="carrier.partyId">
          <ion-radio label-placement="end" justify="start" :value="carrier.partyId">
            <ion-label>{{ carrierName(carrier) }}</ion-label>
          </ion-radio>
        </ion-item>
      </ion-list>
    </ion-radio-group>

    <ion-list>
      <ion-item>
        <ion-select
          :label="translate('Shipping method')"
          interface="popover"
          :placeholder="translate('Select Shipping Method')"
          :value="selectedMethodId || undefined"
          :disabled="!selectedCarrierId"
          @ionChange="selectedMethodId = $event.detail.value"
        >
          <ion-select-option
            v-for="method in methodsForCarrier"
            :key="method.shipmentMethodTypeId"
            :value="method.shipmentMethodTypeId"
          >
            {{ seed.shipmentMethodDescription(method.shipmentMethodTypeId) }}
          </ion-select-option>
        </ion-select>
      </ion-item>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedCarrierId || !selectedMethodId" :aria-label="translate('Confirm')" @click="confirm()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, onMounted, ref, watch } from 'vue';
import { translate } from '@common';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();

const selectedCarrierId = ref('');
const selectedMethodId = ref('');

const availableCarriers = computed(() => {
  const list = orderDetailStore.carrierParties.length
    ? orderDetailStore.carrierParties
    : seed.carriers.ids.map((id) => seed.carriers.byId[id]);
  return [...list].sort((a, b) => carrierName(a).localeCompare(carrierName(b)));
});

function carrierName(carrier: any) {
  return [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId;
}

const methodsForCarrier = computed(() =>
  [...orderDetailStore.shippingMethodsByCarrier(selectedCarrierId.value)].sort(
    (a, b) => Number(a.sequenceNumber ?? Infinity) - Number(b.sequenceNumber ?? Infinity)
  )
);

onMounted(() => {
  orderDetailStore.fetchCarrierParties();
  orderDetailStore.fetchShippingMethods();
});

// Methods are carrier-specific, so a carrier change invalidates any method already chosen.
watch(selectedCarrierId, () => {
  selectedMethodId.value = '';
});

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  modalController.dismiss(
    { carrierPartyId: selectedCarrierId.value, shipmentMethodTypeId: selectedMethodId.value },
    'confirm'
  );
}
</script>
