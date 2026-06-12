<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Reject Items') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div v-if="isLoading" class="empty-state">
      <ion-spinner name="crescent" />
    </div>

    <div v-else-if="!rejectionReasons.length" class="empty-state">
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
      <ion-fab-button :disabled="!selectedReasonId" @click="confirm()">
        <ion-icon :icon="checkmarkOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { translate } from '@common';
import { useSeedStore } from '@/store/seed';

const seed = useSeedStore();

const isLoading = ref(false);
const rejectionReasons = ref<any[]>([]);
const selectedReasonId = ref('');

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  if (!selectedReasonId.value) return;
  modalController.dismiss({ rejectionReasonId: selectedReasonId.value }, 'confirm');
}

async function loadRejectionReasons() {
  isLoading.value = true;
  try {
    await Promise.all([
      seed.loadEnumsByParentType('REPORT_AN_ISSUE'),
      seed.loadEnumsByParentType('RPRT_NO_VAR_LOG'),
    ]);
    const reasons = [
      ...seed.getEnumsByParentType('REPORT_AN_ISSUE'),
      ...seed.getEnumsByParentType('RPRT_NO_VAR_LOG'),
    ];
    // Deduplicate by enumId
    const seen = new Set<string>();
    rejectionReasons.value = reasons.filter((r) => {
      if (seen.has(r.enumId)) return false;
      seen.add(r.enumId);
      return true;
    });
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadRejectionReasons);
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
