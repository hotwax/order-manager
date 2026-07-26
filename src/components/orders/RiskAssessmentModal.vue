<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Risk assessment') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <template v-if="risks.length">
      <ion-list v-for="risk in risks" :key="risk.providerId" lines="none">
        <ion-item lines="none">
          <ion-icon slot="start" :icon="shieldOutline" :color="riskLevelColor(risk.riskLevelEnumId)" />
          <ion-label>
            {{ risk.providerName || risk.providerId || translate('Risk provider') }}
            <p>{{ translate('Risk level') }}: {{ seedStore.enumDescription(risk.riskLevelEnumId) }}</p>
          </ion-label>
          <ion-note v-if="risk.createdDate" slot="end">{{ formatDate(risk.createdDate) }}</ion-note>
        </ion-item>
        <ion-item v-for="fact in sortFactsBySentiment(risk.facts || [])" :key="fact.factSeqId" lines="none">
          <ion-icon slot="start" :icon="factSentimentIcon(fact.sentimentEnumId)" :color="factSentimentColor(fact.sentimentEnumId)" />
          <ion-label class="ion-text-wrap">
            {{ fact.description }}
            <p>{{ seedStore.enumDescription(fact.sentimentEnumId) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </template>
    <ion-list v-else lines="none">
      <ion-item lines="none">
        <ion-label>{{ translate('No risk assessments for this order') }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, shieldOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { factSentimentColor, factSentimentIcon, riskLevelColor, sortFactsBySentiment } from '@/utils';

withDefaults(defineProps<{ risks?: any[] }>(), {
  risks: () => [],
});

const seedStore = useSeedStore();

function dismiss() {
  modalController.dismiss();
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const parsed = typeof value === 'number' ? DateTime.fromMillis(value) : DateTime.fromISO(String(value));
  return parsed.isValid ? parsed.toLocaleString(DateTime.DATETIME_MED) : String(value);
}
</script>
