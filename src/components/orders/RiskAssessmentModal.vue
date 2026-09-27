<template>
  <DxpModal :title="translate('Risk assessment')">
    <template v-if="risks.length">
      <ion-list v-for="risk in risks" :key="risk.providerId" lines="none">
        <ion-item lines="none">
          <ion-icon slot="start" :icon="shieldOutline" :color="riskLevelColor(risk.riskLevelEnumId)" />
          <ion-label>
            {{ risk.providerName || risk.providerId || translate('Risk provider') }}
            <p>{{ translate('Risk level: {level}', { level: seedStore.enumDescription(risk.riskLevelEnumId) }) }}</p>
          </ion-label>
          <ion-note v-if="risk.createdDate" slot="end">{{ formatDateTime(risk.createdDate) }}</ion-note>
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
  </DxpModal>
</template>

<script setup lang="ts">
import { IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/vue';
import { shieldOutline } from 'ionicons/icons';
import { formatDateTime } from '@/utils/format';
import { DxpModal, translate } from '@common';
import { useSeedStore } from '@/store/seed';
import { factSentimentColor, factSentimentIcon, riskLevelColor, sortFactsBySentiment } from '@/utils';

withDefaults(defineProps<{ risks?: any[] }>(), {
  risks: () => [],
});

const seedStore = useSeedStore();
</script>
