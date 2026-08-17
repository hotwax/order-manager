<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Ship group dates') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list lines="none">
      <ion-item>
        <ion-label>
          {{ translate('The ship-by date is applied to every ship group of the {count} selected order(s).', { count: props.orderCount }) }}
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-input
          :label="translate('Ship by')"
          label-placement="stacked"
          type="date"
          v-model="shipByDate"
        />
      </ion-item>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!shipByDate" @click="confirm()" :aria-label="translate('Save')">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { ref } from 'vue';
import { translate } from '@common';

const props = defineProps<{
  orderCount: number;
}>();

// Ship-by is the only date the ship group itself carries. estimatedShipDate belongs to the
// shipment and estimatedDeliveryDate to the order item, so neither can be set from an
// order-level bulk action.
const shipByDate = ref('');

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  if (!shipByDate.value) return;
  modalController.dismiss({ shipByDate: shipByDate.value }, 'confirm');
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
