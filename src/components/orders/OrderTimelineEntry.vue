<template>
  <ion-icon slot="start" :icon="ICONS[entry.kind]" />
  <ion-label>
    <p v-if="entry.elapsed" class="overline">{{ entry.elapsed }}</p>
    {{ entry.headline }}
    <p v-for="(line, index) in entry.details" :key="`detail-${index}`">{{ line }}</p>
    <p v-for="(note, index) in entry.notes" :key="`note-${index}`">{{ note }}</p>
    <p v-if="entry.reason">{{ entry.reason }}</p>
    <p v-if="entry.actor">{{ translate('By {actor}', { actor: entry.actor }) }}</p>
    <p v-if="entry.atKind === 'recorded'">{{ translate('Dated when the return was recorded') }}</p>
  </ion-label>
  <ion-note v-if="entry.time" slot="end">{{ entry.time }}</ion-note>
</template>

<script setup lang="ts">
import { IonIcon, IonLabel, IonNote } from '@ionic/vue';
import {
  addCircleOutline,
  alertCircleOutline,
  arrowForwardCircleOutline,
  arrowUndoOutline,
  cartOutline,
  checkmarkCircleOutline,
  checkmarkDoneOutline,
  closeCircleOutline,
  cloudDownloadOutline,
  compassOutline,
  cubeOutline,
  mailOutline,
  navigateOutline,
  pauseCircleOutline,
  pulseOutline,
  repeatOutline,
  sendOutline,
  storefrontOutline,
  swapHorizontalOutline,
  warningOutline,
} from 'ionicons/icons';
import { translate } from '@common';
import type { TimelineEntry, TransactionKind } from '@/utils/orderTimeline';

/** The content of one timeline row: rendered straight into its `ion-item`, so the slots apply. */
defineProps<{ entry: Pick<TimelineEntry, 'kind' | 'headline' | 'details' | 'notes' | 'reason' | 'actor' | 'atKind' | 'time' | 'elapsed'> }>();

// The ship-group strip uses the same compass, mail, cube and send icons for its four steps.
const ICONS: Record<TransactionKind, string> = {
  placed: cartOutline,
  imported: cloudDownloadOutline,
  approved: checkmarkCircleOutline,
  status: pulseOutline,
  cancelled: closeCircleOutline,
  shipped: sendOutline,
  packed: cubeOutline,
  picked: mailOutline,
  completed: checkmarkDoneOutline,
  sold: storefrontOutline,
  brokered: compassOutline,
  released: arrowForwardCircleOutline,
  rejected: alertCircleOutline,
  moved: navigateOutline,
  parked: pauseCircleOutline,
  unfillable: warningOutline,
  return: arrowUndoOutline,
  exchange: swapHorizontalOutline,
  items: addCircleOutline,
  run: repeatOutline,
};
</script>
