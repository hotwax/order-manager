<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button data-testid="viewmore-close-modal" @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Add product") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-searchbar data-testid="viewmore-search-products-input" :value="queryString" :placeholder="translate('Search products')" @keyup.enter="queryString = $event.target.value; getProducts()"/>

    <!-- Loading state -->
    <div v-if="isLoading && !products.length" class="empty-state">
      <ion-spinner name="crescent" />
      <ion-label>{{ translate("Loading...") }}</ion-label>
    </div>

    <!-- Product list -->
    <template v-if="products.length">
      <ion-item v-for="product in products" :key="product.productId">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="product.mainImageUrl" />
        </ion-thumbnail>
        <ion-label>
          <h2>{{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, product) ? commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, product) : product?.internalName }}</h2>
          <p v-if="commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, product) !== 'null'">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, product) }}</p>
        </ion-label>

        <!-- Show Add button if product is NOT in order -->
        <ion-button data-testid="viewmore-add-to-order-btn" v-if="!isProductInOrder(product.productId)" slot="end" fill="outline" @click="addOrderItem(product)" :disabled="pendingProductIds.has(product.productId)">
          {{ pendingProductIds.has(product.productId) ? translate("Adding...") : translate("Add to Order") }}
        </ion-button>

        <!-- Display checkmark only when product is actually in order -->
        <ion-icon v-else slot="end" :icon="checkmarkCircle" color="success" />
      </ion-item>

      <ion-infinite-scroll @ionInfinite="loadMoreProducts($event)" threshold="100px" :disabled="!isScrollable()">
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading')" />
      </ion-infinite-scroll>
    </template>

    <!-- Empty state -->
    <div class="empty-state" v-else-if="!isLoading && queryString">
      <ion-text>{{ translate("No products found") }}</ion-text>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonSearchbar, IonSpinner, IonText, IonThumbnail, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkCircle, closeOutline } from "ionicons/icons";
import { computed, onMounted, ref } from 'vue';
import { translate, logger, commonUtil, useSolrSearch } from "@common";
import { useProductStore } from '@/store/productStore';
import { useProductMaster } from '@/composables/useProductMaster';
import { DxpShopifyImg } from '@common';

const props = defineProps(["query", "addProductToQueue", "isProductInOrder", "pendingProductIds"]);
const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);

const queryString = ref(props.query);
const products = ref([]) as any;
const total = ref(0) as any;
const isLoading = ref(false);

onMounted(() => {
  if (queryString.value) {
    getProducts();
  }
});

function closeModal() {
  modalController.dismiss();
}

function addOrderItem(product: any) {
  props.addProductToQueue(product);
}

function isScrollable() {
  return products.value.length < total.value;
}

async function loadMoreProducts(event: any) {
  await getProducts(
    undefined,
    Math.ceil(products.value.length / Number(import.meta.env.VITE_VIEW_SIZE || 20)).toString()
  );
  event.target.complete();
}

async function getProducts(vSize?: any, vIndex?: any) {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  isLoading.value = true;

  try {
    const resp = await useSolrSearch().searchProducts({
      keyword: queryString.value.trim(),
      viewSize,
      viewIndex,
      filters: {
        productStoreIds_s: { value: useProductStore().getCurrentProductStore.productStoreId }
      }
    });

    if (resp.total) {
      const productsList = resp.products;
      useProductMaster().upsertFromApi(productsList);
      if (viewIndex) {
        products.value = products.value.concat(productsList);
      } else {
        products.value = productsList;
        total.value = resp.total;
      }
    } else {
      products.value = viewIndex ? products.value : [];
    }
  } catch (err) {
    logger.error("Failed to fetch products", err);
  }
  isLoading.value = false;
}
</script>
