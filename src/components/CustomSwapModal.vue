<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Custom Swap') }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-segment v-model="selectedSegment">
        <ion-segment-button value="substitute">
          <ion-label>{{ translate('Substitute Products') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="search">
          <ion-label>{{ translate('Product Search') }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <!-- Substitute Products Segment -->
    <ion-list v-if="selectedSegment === 'substitute'">
      <div class="empty-state" v-if="!substituteProducts.length">
        <p>{{ translate('No substitute products configured for this item.') }}</p>
      </div>
      <ion-item v-for="product in substituteProducts" :key="product.productId"
        :button="hasSubstituteStock(product.productId)"
        :disabled="!hasSubstituteStock(product.productId)"
        @click="hasSubstituteStock(product.productId) && selectProduct(product)"
      >
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="getProduct(product.productId)?.mainImageUrl || product.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ getProduct(product.productId)?.productName || product.productName }}
          <p>{{ translate('SKU') }}: {{ getProduct(product.productId)?.internalName || product.internalName }}</p>
          <p>{{ money(product.price) }}</p>
        </ion-label>
        <ion-note slot="end">{{ getSubstituteStock(product.productId)?.computedAtp ?? 0 }}</ion-note>
        <ion-icon v-if="selectedProductId === product.productId" slot="end" :icon="checkmarkCircle" color="primary" />
      </ion-item>
    </ion-list>

    <!-- Product Search Segment -->
    <div v-if="selectedSegment === 'search'">
      <ion-searchbar
        v-model="searchKeyword"
        :placeholder="translate('Search products...')"
        :debounce="500"
        @ionInput="onSearch"
      />
      <ion-list>
        <div class="empty-state" v-if="isSearching">
          <ion-item lines="none">
            <ion-spinner color="secondary" name="crescent" slot="start" />
            {{ translate('Searching products') }}
          </ion-item>
        </div>
        <div class="empty-state" v-else-if="searchKeyword && !searchResults.length">
          <p>{{ translate('No products found.') }}</p>
        </div>
        <div class="empty-state" v-else-if="!searchKeyword">
          <p>{{ translate('Search for a product by name or SKU.') }}</p>
        </div>
        <template v-else>
          <ion-item v-for="product in searchResults" :key="product.productId"
            :button="hasSearchStock(product)"
            :disabled="!hasSearchStock(product)"
            @click="hasSearchStock(product) && selectProduct(toSubstituteShape(product))"
          >
            <ion-thumbnail slot="start">
              <DxpShopifyImg :src="product.mainImageUrl" size="small" />
            </ion-thumbnail>
            <ion-label>
              {{ product.parentProductName }}
              <p>{{ product.productName }}</p>
              <p>{{ translate('SKU') }}: {{ product.internalName || product.sku }}</p>
            </ion-label>
            <ion-note slot="end">{{ product.inventoryConfig?.computedLastInventoryCount ?? 0 }}</ion-note>
            <ion-icon v-if="selectedProductId === product.productId" slot="end" :icon="checkmarkCircle" color="primary" />
          </ion-item>
        </template>
      </ion-list>

      <ion-infinite-scroll
        @ionInfinite="loadMoreResults($event)"
        threshold="100px"
        v-if="isSearchScrollable"
      >
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading')" />
      </ion-infinite-scroll>
    </div>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedProductId" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonNote, IonSearchbar, IonSegment, IonSegmentButton, IonSpinner, IonThumbnail, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkCircle, closeOutline, saveOutline } from 'ionicons/icons';
import { api, DxpShopifyImg, translate } from '@common';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import { useStockStore } from '@/store/stock';

const props = defineProps<{
  substituteProducts: any[];
  facilityId: string;
}>();

const PAGE_SIZE = 20;

const selectedSegment = ref('substitute');
const selectedProductId = ref('');
const selectedProductData = ref<any>(null);

// Search state
const searchKeyword = ref('');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchPageIndex = ref(0);
const searchTotalCount = ref(0);

const isSearchScrollable = computed(() =>
  searchResults.value.length > 0 && searchResults.value.length < searchTotalCount.value
);

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function getSubstituteStock(productId: string) {
  return useStockStore().getProductStock(productId, props.facilityId);
}

function hasSubstituteStock(productId: string): boolean {
  return (getSubstituteStock(productId)?.computedAtp ?? 0) > 0;
}

function hasSearchStock(product: any): boolean {
  return (product.inventoryConfig?.computedLastInventoryCount ?? 0) > 0;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);
}

function toSubstituteShape(product: any) {
  return {
    productId: product.productId,
    productName: product.productName,
    internalName: product.internalName || product.sku,
    mainImageUrl: product.mainImageUrl,
    price: product.BASE_PRICE_PURCHASE_USD_STORE_GROUP_price ?? product.LIST_PRICE_PURCHASE_USD_STORE_GROUP_price,
    _isCustomSwap: true,
  };
}

function selectProduct(product: any) {
  selectedProductId.value = product.productId;
  selectedProductData.value = { ...product, _isCustomSwap: true };
}

async function searchProducts(pageIndex = 0, append = false) {
  if (!searchKeyword.value.trim()) {
    searchResults.value = [];
    searchTotalCount.value = 0;
    return;
  }
  isSearching.value = !append;
  try {
    const resp = await api({
      url: 'oms/productFacilities/search',
      method: 'GET',
      params: {
        facilityId: props.facilityId,
        keyword: searchKeyword.value.trim(),
        pageIndex,
        pageSize: PAGE_SIZE,
      },
    });
    const data = resp.data ?? {};
    const products = data.products ?? [];
    searchTotalCount.value = data.totalCount ?? 0;
    searchPageIndex.value = pageIndex;
    searchResults.value = append ? [...searchResults.value, ...products] : products;

    const productIds = products.map((p: any) => p.productId).filter(Boolean);
    if (productIds.length) {
      useProductMaster().init();
      await useProductMaster().prefetch(productIds);
    }
  } catch {
    if (!append) searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

function onSearch() {
  searchPageIndex.value = 0;
  searchResults.value = [];
  selectedProductId.value = '';
  selectedProductData.value = null;
  searchProducts(0, false);
}

async function loadMoreResults(event: any) {
  await searchProducts(searchPageIndex.value + 1, true);
  await event.target.complete();
}

function closeModal(data?: any) {
  modalController.dismiss(data);
}

function save() {
  if (!selectedProductId.value || !selectedProductData.value) return;
  closeModal(selectedProductData.value);
}

onMounted(async () => {
  const productIds = props.substituteProducts.map((p: any) => p.productId).filter(Boolean);
  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }
});
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px 16px;
  text-align: center;
  color: var(--ion-color-medium);
}
</style>
