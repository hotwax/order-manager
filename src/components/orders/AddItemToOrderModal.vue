<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Add Item') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-searchbar
      :placeholder="translate('Search products')"
      v-model="queryString"
      @ionInput="onSearch"
      debounce="400"
    />

    <div v-if="isLoading" class="empty-state">
      <ion-spinner name="crescent" />
    </div>

    <div v-else-if="!queryString">
      <ion-item lines="none">
        <ion-label class="ion-text-center ion-padding">{{ translate('Search for a product to add') }}</ion-label>
      </ion-item>
    </div>

    <div v-else-if="!products.length" class="empty-state">
      <p>{{ translate('No products found') }}</p>
    </div>

    <ion-list v-else lines="none">
      <ion-item v-for="product in products" :key="product.productId">
        <ion-thumbnail slot="start" v-image-preview="product" :key="product?.mainImageUrl">
          <DxpShopifyImg :src="product.mainImageUrl" :key="product.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          <p class="overline">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, product) }}</p>
          {{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, product) ? commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, product) : product.productId }}
        </ion-label>
        <!-- Show success check if already added, spinner while adding, Add button otherwise -->
        <ion-icon v-if="addedProductIds.has(product.productId)" slot="end" color="success" :icon="checkmarkCircle" />
        <ion-button
          v-else
          slot="end"
          fill="outline"
          :disabled="addingProductId === product.productId"
          @click="addToOrder(product)"
        >
          <ion-spinner v-if="addingProductId === product.productId" name="crescent" slot="start" />
          {{ translate('Add') }}
        </ion-button>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonSpinner, IonThumbnail, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkCircle, closeOutline, imageOutline } from 'ionicons/icons';
import { ref, computed } from 'vue';
import { api, commonUtil, DxpShopifyImg, translate } from '@common';
import { useSolrSearch } from '@common/composables/useSolrSearch';
import { showToast } from '@/utils';
import { useProductStore } from '@/store/productStore';

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);

const props = defineProps<{
  orderId: string;
  shipGroupSeqId: string;
  onItemAdded?: () => void;
}>();

const { searchProducts } = useSolrSearch();

const queryString = ref('');
const products = ref<any[]>([]);
const isLoading = ref(false);
const addingProductId = ref<string | null>(null);
// Tracks all successfully added productIds during this modal session
const addedProductIds = ref<Set<string>>(new Set());

async function onSearch() {
  const keyword = queryString.value.trim();
  if (!keyword) {
    products.value = [];
    return;
  }
  isLoading.value = true;
  try {
    const result = await searchProducts({ keyword, viewSize: 20 });
    products.value = result.products || [];
  } catch {
    products.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function addToOrder(product: any) {
  addingProductId.value = product.productId;
  try {
    await api({
      url: `oms/orders/${props.orderId}/addItem`,
      method: 'POST',
      data: {
        orderId: props.orderId,
        shipGroupSeqId: props.shipGroupSeqId,
        productId: product.productId,
        quantity: 1,
      },
    });
    // Mark as added and stay open for more additions
    addedProductIds.value = new Set([...addedProductIds.value, product.productId]);
    await showToast(translate('Item added to order successfully.'));
    props.onItemAdded?.();
  } catch (err: any) {
    await showToast(err?.response?.data?.errorMessage || translate('Failed to add item. Insufficient inventory or invalid product.'));
  } finally {
    addingProductId.value = null;
  }
}

function dismiss() {
  // Dismiss with confirm if any items were added so OrderDetail reloads, cancel otherwise
  const role = addedProductIds.value.size > 0 ? 'confirm' : 'cancel';
  modalController.dismiss({ added: addedProductIds.value.size > 0 }, role);
}
</script>
