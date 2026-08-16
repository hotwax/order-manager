<template>
  <ion-card>
    <ion-item lines="full">
      <ion-label>
        <h2>{{ order.name }}</h2>
        <p>{{ order.subtitle }}</p>
      </ion-label>
      <ion-note slot="end">{{ order.progressLabel }}</ion-note>
    </ion-item>

    <ion-progress-bar :value="order.progressValue" :color="order.progressColor" />

    <ion-item lines="full">
      <ion-label>
        <p class="overline">{{ translate('Order date') }}</p>
        {{ order.orderDate }}
      </ion-label>
    </ion-item>

    <ion-list lines="none">
      <ion-list-header>
        <ion-label>{{ translate('Items') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="(item, itemIndex) in order.items" :key="itemIndex">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="(productCache as any).getProduct(item.productId)?.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ item.name }}
          <p>{{ item.secondary }}</p>
        </ion-label>
      </ion-item>
    </ion-list>

    <div class="card-actions">
      <ion-button
        fill="clear"
        size="small"
        :router-link="order.id ? `/orders/${order.id}` : undefined"
        :disabled="!order.id"
      >
        {{ translate('View details') }}
      </ion-button>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { DxpShopifyImg, translate } from '@common';
import {
  IonButton,
  IonCard,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonProgressBar,
  IonThumbnail
} from '@ionic/vue';
import { useProductCacheStore } from '@/store/productCache';
import type { CustomerOrderCardData } from '@/types/customer';

defineProps<{
  order: CustomerOrderCardData;
}>();

const productCache = useProductCacheStore();
</script>

<style scoped>
.card-actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px 8px;
  border-top: 1px solid var(--ion-color-step-100);
}
</style>
