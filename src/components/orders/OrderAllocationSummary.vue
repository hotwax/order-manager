<template>
  <template v-if="summary">
    <ion-chip outline>
      <ion-label>{{ facilityLabel }}</ion-label>
    </ion-chip>
    <p>{{ progressLabel }}</p>
  </template>
</template>

<script setup lang="ts">
import { IonChip, IonLabel } from '@ionic/vue';
import { computed } from 'vue';
import type { OrderAllocationSummaryModel } from '@/types/orderRow';

const props = defineProps<{
  summary?: OrderAllocationSummaryModel;
}>();

const facilityLabel = computed(() => {
  if (!props.summary) return '';
  return props.summary.additionalFacilityCount
    ? `${props.summary.facilityName} +${props.summary.additionalFacilityCount}`
    : props.summary.facilityName;
});
const progressLabel = computed(() => props.summary
  ? `${props.summary.brokeredItemCount}/${props.summary.totalItemCount} items brokered`
  : '');
</script>
