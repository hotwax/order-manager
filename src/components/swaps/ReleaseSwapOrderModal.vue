<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal(false)" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Release updated order') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list lines="full" v-if="cancelledItems.length">
      <ion-list-header>
        <ion-label>
          <ion-text color="danger">{{ translate('Items to cancel') }}</ion-text>
        </ion-label>
      </ion-list-header>
      <ion-item v-for="(item, index) in cancelledItems" :key="`cancelled-${item.orderItemSeqId || index}`">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="productImageUrl(item.productId)" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ productPrimary(item) }}
          <p>{{ productSecondary(item) }}</p>
          <p v-if="item.quantity">{{ translate('Qty') }}: {{ item.quantity }}</p>
        </ion-label>
        <ion-note slot="end" color="danger">
          <p>{{ money(itemPrice(item)) }}</p>
          <ion-badge color="danger">{{ translate('Cancel') }}</ion-badge>
        </ion-note>
      </ion-item>
    </ion-list>

    <ion-list lines="full" v-if="substitutedItems.length">
      <ion-list-header>
        <ion-label>
          <ion-text color="success">{{ translate('Substituted items') }}</ion-text>
        </ion-label>
      </ion-list-header>
      <ion-item v-for="(item, index) in substitutedItems" :key="`sub-${item.orderItemSeqId || index}`">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="productImageUrl(item.productId)" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ productPrimary(item) }}
          <p>{{ productSecondary(item) }}</p>
          <p v-if="item.quantity">{{ translate('Qty') }}: {{ item.quantity }}</p>
        </ion-label>
        <ion-note slot="end" color="success">
          <p>{{ money(itemPrice(item)) }}</p>
          <ion-badge color="success">{{ translate('Swap') }}</ion-badge>
        </ion-note>
      </ion-item>
    </ion-list>

    <ion-list lines="full">
      <ion-list-header>
        <ion-label>{{ translate('Summary') }}</ion-label>
      </ion-list-header>
      <ion-item>
        <ion-label>{{ translate('Original total') }}</ion-label>
        <ion-label slot="end">{{ money(grandTotal) }}</ion-label>
      </ion-item>
      <ion-item>
        <ion-label>
          {{ translate('New total') }}
        </ion-label>
        <ion-label slot="end" color="dark">
          {{ money(newTotal) }}
        </ion-label>
      </ion-item>
      <ion-item v-if="refundAmount > 0">
        <ion-label>
          <ion-text color="primary">
            {{ translate('Refund to customer') }}
          </ion-text>
        </ion-label>
        <ion-label slot="end" color="primary">
          {{ money(refundAmount) }}
        </ion-label>
      </ion-item>
    </ion-list>
  </ion-content>

  <ion-footer>
    <ion-toolbar>
      <ion-buttons slot="end">
        <ion-button fill="clear" color="medium" @click="closeModal(false)">
          {{ translate('Cancel') }}
        </ion-button>
        <ion-button fill="solid" color="primary" @click="closeModal(true)">
          {{ translate('Confirm and release') }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonText,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { useProductCacheStore } from '@/store/productCache';
import { useProductStore } from '@/store/productStore';

const props = withDefaults(defineProps<{
  grandTotal?: number;
  newTotal?: number;
  refundAmount?: number;
  cancelledItems?: any[];
  substitutedItems?: any[];
}>(), {
  grandTotal: 0,
  newTotal: 0,
  refundAmount: 0,
  cancelledItems: () => [],
  substitutedItems: () => [],
});

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function productImageUrl(productId: string): string {
  return getProduct(productId)?.mainImageUrl || '';
}

function productPrimary(item: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.primaryId, getProduct(item.productId) || {})
    || item.productId;
}

function productSecondary(item: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.secondaryId, getProduct(item.productId) || {})
    || item.internalName
    || item.itemDescription
    || '';
}

function itemPrice(item: any): number {
  const unit = Number(item.price ?? item.unitPrice ?? 0);
  const qty = Number(item.quantity ?? 1);
  return unit * qty;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function closeModal(confirmed = false) {
  modalController.dismiss({ confirmed });
}
</script>
