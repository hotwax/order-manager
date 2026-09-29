<template>
  <DxpModal :state="shippingMethodModal" :title="translate('Edit shipping method')">
    <ion-list>
      <ion-item>
        <ion-select
          :label="translate('Carrier')"
          interface="popover"
          :placeholder="translate('Select carrier')"
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
          :placeholder="translate('Select shipping method')"
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
  </DxpModal>
</template>

<script setup lang="ts">
import {
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
import { computed, onMounted, ref } from 'vue';
import { DxpModal, translate, useDxpModal } from '@common';
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
  return [...list].sort((a, b) => {
    const nameA = [a.firstName, a.lastName].filter(Boolean).join(' ') || a.groupName || a.partyId;
    const nameB = [b.firstName, b.lastName].filter(Boolean).join(' ') || b.groupName || b.partyId;
    return nameA.localeCompare(nameB);
  });
});

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

// Save hands back the carrier and method; the screen that opened the modal updates the orders.
const shippingMethodModal = useDxpModal({
  dirty: () => !!selectedCarrierId.value,
  canConfirm: () => !!selectedCarrierId.value && !!selectedMethodId.value,
  confirm: () => ({ carrierPartyId: selectedCarrierId.value, shipmentMethodTypeId: selectedMethodId.value }),
});
</script>
