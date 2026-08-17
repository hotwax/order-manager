<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Cancel open items') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list lines="none">
      <ion-item>
        <ion-label>
          {{ translate('Every open item of the {count} selected order(s) will be cancelled.', { count: props.orderCount }) }}
        </ion-label>
      </ion-item>
    </ion-list>

    <div v-if="isLoading" class="empty-state">
      <ion-spinner name="crescent" />
    </div>

    <div v-else-if="!cancelReasons.length" class="empty-state">
      <p>{{ translate('No cancellation reasons found') }}</p>
    </div>

    <ion-radio-group v-else v-model="selectedReasonId">
      <ion-list lines="none">
        <ion-item v-for="reason in cancelReasons" :key="reason.enumId">
          <ion-radio label-placement="end" justify="start" :value="reason.enumId">
            <ion-label>{{ reason.description || reason.enumCode || reason.enumId }}</ion-label>
          </ion-radio>
        </ion-item>
      </ion-list>
    </ion-radio-group>

    <ion-list lines="none">
      <ion-item>
        <ion-textarea
          :label="translate('Comment')"
          label-placement="stacked"
          :placeholder="translate('Optional note recorded against each cancelled item')"
          :rows="3"
          v-model="comment"
        />
      </ion-item>
    </ion-list>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedReasonId" @click="confirm()" :aria-label="translate('Confirm')">
        <ion-icon :icon="checkmarkOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSpinner, IonTextarea, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { translate } from '@common';
import { useSeedStore } from '@/store/seed';

const props = defineProps<{
  orderCount: number;
}>();

const seed = useSeedStore();

const isLoading = ref(false);
const cancelReasons = ref<any[]>([]);
const selectedReasonId = ref('');
const comment = ref('');

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function confirm() {
  if (!selectedReasonId.value) return;
  modalController.dismiss({ reason: selectedReasonId.value, comment: comment.value.trim() }, 'confirm');
}

// Cancellation records the same reason enumerations the single-item reject flow uses, so a bulk
// cancel stays comparable with the per-item history an operator already reads on the order.
async function loadCancelReasons() {
  const cached = dedupe([
    ...seed.getEnumsByParentType('REPORT_AN_ISSUE'),
    ...seed.getEnumsByParentType('RPRT_NO_VAR_LOG'),
  ]);
  if (cached.length) {
    cancelReasons.value = cached;
    return;
  }

  isLoading.value = true;
  try {
    await Promise.all([
      seed.loadEnumsByParentType('REPORT_AN_ISSUE'),
      seed.loadEnumsByParentType('RPRT_NO_VAR_LOG'),
    ]);
    cancelReasons.value = dedupe([
      ...seed.getEnumsByParentType('REPORT_AN_ISSUE'),
      ...seed.getEnumsByParentType('RPRT_NO_VAR_LOG'),
    ]);
  } finally {
    isLoading.value = false;
  }
}

function dedupe(reasons: any[]) {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    if (seen.has(reason.enumId)) return false;
    seen.add(reason.enumId);
    return true;
  });
}

onMounted(loadCancelReasons);
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
