<template>
  <DxpModal :state="rejectModal" :title="translate('Reject items')">
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
  </DxpModal>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSpinner } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { DxpModal, translate, useDxpModal } from '@common';
import { useSeedStore } from '@/store/seed';

const seed = useSeedStore();

const isLoading = ref(false);
const rejectionReasons = ref<any[]>([]);
const selectedReasonId = ref('');

// Save hands back the chosen reason; the screen that opened the modal rejects the items.
const rejectModal = useDxpModal({
  canConfirm: () => !!selectedReasonId.value,
  confirm: () => ({ rejectionReasonId: selectedReasonId.value }),
});

async function loadRejectionReasons() {
  const cachedReasons = [
    ...seed.getEnumsByParentType('REPORT_AN_ISSUE'),
    ...seed.getEnumsByParentType('RPRT_NO_VAR_LOG'),
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
      await Promise.all([
        seed.loadEnumsByParentType('REPORT_AN_ISSUE'),
        seed.loadEnumsByParentType('RPRT_NO_VAR_LOG'),
      ]);
      const reasons = [
        ...seed.getEnumsByParentType('REPORT_AN_ISSUE'),
        ...seed.getEnumsByParentType('RPRT_NO_VAR_LOG'),
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

