<template>
  <div>
    <div v-if="commEvents.length">
      <div class="list-item comm-event-row" v-for="ev in commEvents" :key="ev.communicationEventId">
        <ion-item lines="none">
          <ion-label>
            {{ ev.communicationEventId }}
            <p>{{ translate("ID") }}</p>
          </ion-label>
        </ion-item>
        <div class="tablet">
          <ion-label class="ion-text-center">
            {{ ev.partyIdFrom || translate('Not available') }}
            <p>{{ translate("From") }}</p>
          </ion-label>
        </div>
        <div class="tablet">
          <ion-label class="ion-text-center">
            {{ ev.partyIdTo || translate('Not available') }}
            <p>{{ translate("To") }}</p>
          </ion-label>
        </div>
        <div class="tablet">
          <ion-label class="ion-text-center">
            {{ ev.content || translate('Not available') }}
            <p>{{ translate("Content") }}</p>
          </ion-label>
        </div>
        <div class="tablet">
          <ion-label class="ion-text-center" v-if="ev.entryDate">
            {{ formatDateTime(ev.entryDate) }}
            <p>{{ translate("Entry date") }}</p>
          </ion-label>
          <ion-label v-else class="ion-text-center">
            {{ translate('Date not available') }}
            <p>{{ translate("Entry date") }}</p>
          </ion-label>
        </div>
      </div>
    </div>
    <ion-list v-else>
      <ion-item lines="none">
        <ion-label>{{ translate("No communication events for this order") }}</ion-label>
      </ion-item>
    </ion-list>
  </div>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList } from '@ionic/vue';
import { translate } from '@common';
import { formatDateTime } from '@/utils/format';

defineProps<{
  /** CommunicationEvent rows as the order store loads them. */
  commEvents: any[];
}>();
</script>

<style scoped>
.comm-event-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.comm-event-row>ion-item {
  width: 100%;
}

/* A communication row opens nothing, so it keeps the shared list-item hover off. */
.comm-event-row:hover {
  --list-item-bg-hover: initial;
  cursor: auto;
}
</style>
