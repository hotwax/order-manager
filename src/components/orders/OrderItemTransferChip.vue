<template>
  <ion-chip v-if="label" outline @click.stop="emit('click')">
    <ion-icon :icon="swapHorizontalOutline" />
    <ion-label>{{ label }}</ion-label>
  </ion-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonChip, IonIcon, IonLabel } from '@ionic/vue';
import { swapHorizontalOutline } from 'ionicons/icons';
import { translate } from '@common';
import type { EnrichedTransfer } from '@/types/orderDetail';

const props = defineProps<{ transfers: EnrichedTransfer[] }>();
const emit = defineEmits<{ (event: 'click'): void }>();

/** The item's transfer that matters most right now: one still under way, else the last one that arrived. */
const label = computed(() => {
  const open = props.transfers.find((transfer) => transfer.isOpen);
  if (open) return translate('Transfer from {facility}', { facility: open.fromFacilityName });
  const complete = props.transfers.find((transfer) => transfer.statusId === 'IXF_COMPLETE');
  if (complete) return translate('Transferred from {facility}', { facility: complete.fromFacilityName });
  return props.transfers.length ? translate('Transfer cancelled') : '';
});
</script>
