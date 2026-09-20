<template>
  <div class="order-comms-segment">
    <div v-if="commEvents.length">
      <div class="list-item comm-event-row" v-for="ev in commEvents" :key="ev.id">
        <ion-item lines="none">
          <ion-label>
            {{ ev.id }}
            <p>{{ translate("ID") }}</p>
          </ion-label>
        </ion-item>
        <div class="tablet">
          <ion-label class="ion-text-center">
            {{ ev.partyIdFrom || '-' }}
            <p>{{ translate("from") }}</p>
          </ion-label>
        </div>
        <div class="tablet">
          <ion-label class="ion-text-center">
            {{ ev.partyIdTo || '-' }}
            <p>{{ translate("to") }}</p>
          </ion-label>
        </div>
        <div class="tablet">
          <ion-label class="ion-text-center">
            {{ ev.content || '-' }}
            <p>{{ translate("content") }}</p>
          </ion-label>
        </div>
        <div class="tablet">
          <ion-label class="ion-text-center" v-if="ev.entryDate">
            {{ formatDate(ev.entryDate) }}
            <p>{{ translate("entry date") }}</p>
          </ion-label>
          <ion-label v-else>-</ion-label>
        </div>
      </div>
    </div>
    <ion-list v-if="!commEvents.length">
      <ion-item lines="none">
        <ion-label>{{ translate("No communication events for this order") }}</ion-label>
      </ion-item>
    </ion-list>
  </div>
</template>

<script setup lang="ts">
import {
  IonItem,
  IonLabel,
  IonList,
} from '@ionic/vue';

defineProps<{
  commEvents: any[];
  formatDate: (date: any) => string;
  translate: (key: string) => string;
}>();
</script>

<style scoped>
.comm-event-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.comm-event-row > ion-item {
  width: 100%;
}
</style>
