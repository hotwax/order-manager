<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()" :aria-label="translate('Close')">
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
      <ion-fab-button :disabled="!selectedReasonId" @click="confirm()" :aria-label="translate('Confirm')">
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
import { seedRows, useSeedTable } from '@/db/orderManagerDb';
import { getEnumsByParentType } from '@/db/seedLookups';

const { records: enums } = useSeedTable('enums');
const { records: enumTypes } = useSeedTable('enumTypes');

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
  const cachedReasons = [
    ...getEnumsByParentType(enums.value, enumTypes.value, 'REPORT_AN_ISSUE'),
    ...getEnumsByParentType(enums.value, enumTypes.value, 'RPRT_NO_VAR_LOG'),
  ];
  if (cachedReasons.length) {
    const seen = new Set<string>();
    rejectionReasons.value = cachedReasons.filter((r) => {
      if (seen.has(r.enumId)) return false;
      seen.add(r.enumId);
      return true;
    });
  } else {
    isLoading.value = true;
  }
  try {
    if (!cachedReasons.length) {
      // Cached into `rejectionReasons` for the modal's lifetime, so read the rows rather
      // than depending on the reactive slice having emitted.
      const [enumRows, enumTypeRows] = await Promise.all([
        seedRows('enums'),
        seedRows('enumTypes'),
      ]);
      const reasons = [
        ...getEnumsByParentType(enumRows, enumTypeRows, 'REPORT_AN_ISSUE'),
        ...getEnumsByParentType(enumRows, enumTypeRows, 'RPRT_NO_VAR_LOG'),
      ];
      const seen = new Set<string>();
      rejectionReasons.value = reasons.filter((r) => {
        if (seen.has(r.enumId)) return false;
        seen.add(r.enumId);
        return true;
      });
    }
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
