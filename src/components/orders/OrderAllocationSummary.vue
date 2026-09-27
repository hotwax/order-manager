<template>
  <template v-if="summary">
    <ion-chip outline>
      <ion-label>{{ facilityLabel }}</ion-label>
    </ion-chip>
    <p>{{ progressLabel }}</p>
  </template>
</template>

<script setup lang="ts">
import { translate } from '@common';
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
  ? translate('{shown}/{count} items brokered', { shown: props.summary.brokeredItemCount, count: props.summary.totalItemCount })
  : '');
</script>
