<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>{{ translate('Set up substitutes for unfillable products') }}</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      {{ translate('Link replacement products, then rebroker the affected orders. Orders that still cannot reserve inventory will appear here as swap tasks.') }}
    </ion-card-content>
  </ion-card>

  <div v-if="loading" class="ion-text-center ion-padding">
    <ion-spinner name="crescent" />
  </div>

  <ErrorState
    v-else-if="error"
    :title="translate('Could not load unfillable products')"
    :message="error"
    retryable
    @retry="emit('retry')"
  />

  <EmptyState
    v-else-if="!candidates.length"
    :title="translate('No approved unfillable items')"
    :message="translate('There are no approved unfillable order items that need substitute setup for this product store.')"
  />

  <ion-list v-else lines="none">
    <ion-list-header>
      <ion-label>{{ translate('Products in Unfillable') }}</ion-label>
    </ion-list-header>
    <ion-item v-for="candidate in candidates" :key="candidate.productId">
      <ion-thumbnail slot="start">
        <DxpShopifyImg :src="candidate.mainImageUrl" size="small" />
      </ion-thumbnail>
      <ion-label>
        {{ candidate.productName || candidate.parentProductName || candidate.internalName || candidate.productId }}
        <p>{{ candidate.sku || candidate.productId }}</p>
        <p>{{ translate('{count} unfillable order item(s)', { count: candidate.itemCount }) }}</p>
      </ion-label>
      <ion-buttons slot="end">
        <ion-button
          v-if="canManageSubstitutes"
          fill="outline"
          @click="emit('manage', candidate)"
        >
          {{ translate(configuredProductIds.includes(candidate.productId) ? 'Manage substitutes' : 'Link substitutes') }}
        </ion-button>
        <ion-button
          v-else-if="productUrl(candidate.productId)"
          fill="outline"
          :href="productUrl(candidate.productId) || undefined"
        >
          {{ translate('Open in Products') }}
        </ion-button>
        <ion-button
          v-if="configuredProductIds.includes(candidate.productId)"
          @click="emit('rebroker', candidate)"
        >
          {{ translate('Rebroker orders') }}
        </ion-button>
      </ion-buttons>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSpinner,
  IonThumbnail,
} from '@ionic/vue';
import { DxpShopifyImg, buildAppUrl, translate } from '@common';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';

export interface SwapSetupCandidate {
  productId: string;
  itemCount: number;
  productName?: string;
  parentProductName?: string;
  internalName?: string;
  sku?: string;
  mainImageUrl?: string;
}

defineProps<{
  candidates: SwapSetupCandidate[];
  loading: boolean;
  error: string;
  canManageSubstitutes: boolean;
  configuredProductIds: string[];
}>();

const emit = defineEmits<{
  (event: 'manage', candidate: SwapSetupCandidate): void;
  (event: 'rebroker', candidate: SwapSetupCandidate): void;
  (event: 'retry'): void;
}>();

function productUrl(productId: string) {
  return buildAppUrl('products', `/products/${encodeURIComponent(productId)}`);
}
</script>
