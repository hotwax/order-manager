<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Edit Shipping Method') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item>
        <ion-select
          :label="translate('Carrier')"
          interface="popover"
          :placeholder="translate('Select Carrier')"
          :value="selectedCarrierId"
          @ionChange="onCarrierChange($event.detail.value)"
        >
          <ion-select-option v-for="carrier in availableCarriers" :key="carrier.partyId" :value="carrier.partyId">
            {{ [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
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
      <ion-fab-button :disabled="!selectedCarrierId || !selectedMethodId" @click="confirm()">
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
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, onMounted, ref } from 'vue';
import { translate } from '@common';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();

const selectedCarrierId = ref('');
const selectedMethodId = ref('');

const availableCarriers = computed(() =>
  [...orderDetailStore.carrierParties].sort((a, b) => {
    const nameA = [a.firstName, a.lastName].filter(Boolean).join(' ') || a.groupName || a.partyId;
    const nameB = [b.firstName, b.lastName].filter(Boolean).join(' ') || b.groupName || b.partyId;
    return nameA.localeCompare(nameB);
  })
);

const methodsForCarrier = computed(() =>
  [...orderDetailStore.shippingMethodsByCarrier(selectedCarrierId.value)].sort(
    (a, b) => Number(a.sequenceNumber ?? Infinity) - Number(b.sequenceNumber ?? Infinity)
  )
);

onMounted(() => {
  orderDetailStore.fetchCarrierParties();
  orderDetailStore.fetchShippingMethods();
});

function onCarrierChange(carrierId: string) {
  selectedCarrierId.value = carrierId;
  selectedMethodId.value = '';
}

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
