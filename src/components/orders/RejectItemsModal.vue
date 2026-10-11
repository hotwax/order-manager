<template>
  <DxpModal :state="rejectModal" :title="translate('Reject items')">
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
  </DxpModal>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList, IonRadio, IonRadioGroup } from '@ionic/vue';
import { computed, ref } from 'vue';
import { DxpModal, translate, useDxpModal } from '@common';
import { useSeedData } from '@common/db';

const seed = useSeedData();


const selectedReasonId = ref('');

// Save hands back the chosen reason; the screen that opened the modal rejects the items.
const rejectModal = useDxpModal({
  canConfirm: () => !!selectedReasonId.value,
  confirm: () => ({ rejectionReasonId: selectedReasonId.value }),
});

const rejectionReasons = computed(() => {
  const seen = new Set<string>();
  return [...seed.enumsByParentType('REPORT_AN_ISSUE'), ...seed.enumsByParentType('RPRT_NO_VAR_LOG')].filter((reason: any) => {
    if (seen.has(reason.enumId)) return false;
    seen.add(reason.enumId);

    return true;
  });
});
</script>

