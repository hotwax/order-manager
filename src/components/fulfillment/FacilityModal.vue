<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Park order') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding-top">
    <ion-radio-group v-model="selectedFacilityId">
      <ion-list>
        <ion-item v-for="option in parkingOptions" :key="option.facilityId">
          <ion-radio slot="start" :value="option.facilityId" />
          <ion-label>
            {{ translate(option.label) }}
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-radio-group>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedFacilityId" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { ref } from 'vue';
import { translate } from '@common';

type ParkingOption = {
  facilityId: string;
  label: string;
};

const parkingOptions: ParkingOption[] = [
  { facilityId: 'REJECTED_ITM_PARKING', label: 'Rejected' },
  { facilityId: 'UNFILLABLE_PARKING', label: 'Unfillable' },
  { facilityId: 'BACKORDER_PARKING', label: 'Backorder' },
  { facilityId: 'PRE_ORDER_PARKING', label: 'Pre-order' },
];

const selectedFacilityId = ref(parkingOptions[0].facilityId);

function closeModal(facilityId?: string) {
  modalController.dismiss(facilityId);
}

function save() {
  if (selectedFacilityId.value) {
    closeModal(selectedFacilityId.value);
  }
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
