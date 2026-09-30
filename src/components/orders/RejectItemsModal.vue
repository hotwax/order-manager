<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()" :aria-label="translate('Close')" :title="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Reject items') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div v-if="!rejectionReasons.length" class="empty-state">
      <p>{{ translate('No rejection reasons found') }}</p>
    </div>

    <ion-radio-group v-else v-model="selectedReasonId">
      <ion-list lines="none">
        <ion-item v-for="reason in rejectionReasons" :key="reason.enumId">
          <ion-radio label-placement="end" justify="start" :value="reason.enumId">
            <ion-label>{{ reason.description || reason.enumCode || reason.enumId }}</ion-label>
          </ion-radio>
        </ion-item>
      </ion-list>
    </ion-radio-group>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedReasonId" @click="confirm()" :aria-label="translate('Save')">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import { translate } from '@common';
import { useSeedData } from '@common/db';

const seed = useSeedData();


const selectedReasonId = ref('');

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  if (!selectedReasonId.value) return;
  modalController.dismiss({ rejectionReasonId: selectedReasonId.value }, 'confirm');
}

const rejectionReasons = computed(() => {
  const seen = new Set<string>();
  return [...seed.enumsByParentType('REPORT_AN_ISSUE'), ...seed.enumsByParentType('RPRT_NO_VAR_LOG')].filter((reason: any) => {
    if (seen.has(reason.enumId)) return false;
    seen.add(reason.enumId);

    return true;
  });
});
</script>

