<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
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
    <ion-toolbar v-if="selectedSegment === 'substitute'">
      <ion-searchbar
        v-model="substituteKeyword"
        :placeholder="translate('Search substitutes')"
      />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <!-- Substitute Products Segment -->
    <ion-list v-if="selectedSegment === 'substitute'">
      <div class="empty-state" v-if="!substituteProducts.length">
        <p>{{ translate('No substitute products configured for this item.') }}</p>
      </div>
      <div class="empty-state" v-else-if="!filteredSubstitutes.length">
        <p>{{ translate('No substitute products match your search.') }}</p>
      </div>
      <ion-radio-group v-else v-model="selectedProductId">
        <ion-list-header>
          <ion-label>{{ translate('Approved Swaps') }}</ion-label>
        </ion-list-header>
        <ion-item
          v-for="product in filteredSubstitutes"
          :key="product.productId"
          button
          :detail="false"
          :disabled="!hasSubstituteStock(product.productId)"
          @click="selectSubstituteProduct(product.productId)"
        >
          <ion-radio slot="start" :value="product.productId" :aria-label="getProduct(product.productId)?.productName || product.productName" />
          <ion-thumbnail slot="start">
            <DxpShopifyImg :src="getProduct(product.productId)?.mainImageUrl || product.mainImageUrl" size="small" />
          </ion-thumbnail>
          <ion-label>
            {{ getProduct(product.productId)?.productName || product.productName }}
            <p>{{ translate('SKU') }}: {{ getProduct(product.productId)?.internalName || product.internalName }}</p>
            <p>{{ money(product.price) }}</p>
          </ion-label>
          <ion-note class="facility-label ion-no-padding" slot="end">{{ facilityStockLabel(getSubstituteStock(product.productId)?.computedAtp) }}</ion-note>
        </ion-item>
      </ion-radio-group>
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
        <ion-radio-group v-else v-model="selectedProductId">
          <ion-item
            v-for="product in searchResults"
            :key="product.productId"
            button
            :detail="false"
            :disabled="!hasSearchStock(product)"
            @click="selectSearchProduct(product)"
          >
            <ion-radio slot="start" :value="product.productId" :aria-label="product.productName" />
            <ion-thumbnail slot="start">
              <DxpShopifyImg :src="product.mainImageUrl" size="small" />
            </ion-thumbnail>
            <ion-label>
              {{ product.parentProductName }}
              <p>{{ product.productName }}</p>
              <p>{{ translate('SKU') }}: {{ product.internalName || product.sku }}</p>
            </ion-label>
            <ion-note class="facility-label ion-no-padding" slot="end">{{ facilityStockLabel(product.inventoryConfig?.computedLastInventoryCount) }}</ion-note>
          </ion-item>
        </ion-radio-group>
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
      <ion-fab-button :disabled="!selectedProductId" @click="save" :aria-label="translate('Save')">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonRadio, IonRadioGroup, IonSearchbar, IonSegment, IonSegmentButton, IonSpinner, IonThumbnail, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { api, DxpShopifyImg, translate } from '@common';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import { useStockStore } from '@/store/stock';
import { useSeedStore } from '@/store/seed';

const props = defineProps<{
  substituteProducts: any[];
  facilityId: string;
  selectedProductId?: string;
  defaultSearchKeyword?: string;
}>();

const PAGE_SIZE = 20;

const selectedSegment = ref('search');
const selectedProductId = ref(props.selectedProductId ?? '');
const selectedProductData = ref<any>(
  props.substituteProducts.find((product: any) => product.productId === props.selectedProductId) ?? null
);

// Substitute list live filter
const substituteKeyword = ref('');
const filteredSubstitutes = computed(() => {
  const query = substituteKeyword.value.trim().toLowerCase();
  if (!query) return props.substituteProducts;
  return props.substituteProducts.filter((product: any) => {
    const cached = getProduct(product.productId);
    const name = cached?.productName || product.productName || '';
    const sku = cached?.internalName || product.internalName || '';
    return `${name} ${sku} ${product.productId}`.toLowerCase().includes(query);
  });
});

// Search state
const searchKeyword = ref((props.defaultSearchKeyword ?? '').trim());
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchPageIndex = ref(0);
const searchTotalCount = ref(0);
const seedStore = useSeedStore();

const isSearchScrollable = computed(() =>
  searchResults.value.length > 0 && searchResults.value.length < searchTotalCount.value
);

const facilityLabel = computed(() => seedStore.facilityName(props.facilityId) || props.facilityId);

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

function facilityStockLabel(count?: number | string | null) {
  const quantity = Number(count ?? 0);
  if (!facilityLabel.value) return translate('Available: {count}', { count: quantity });

  return translate('Available at {facility}: {count}', {
    facility: facilityLabel.value,
    count: quantity,
  });
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

function selectSubstituteProduct(productId: string) {
  const product = props.substituteProducts.find((item: any) => item.productId === productId);
  if (product) selectProduct(product);
}

function selectSearchProduct(product: any) {
  selectProduct(toSubstituteShape(product));
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
  await Promise.all([
    seedStore.loadFacilities(),
    productIds.length
      ? (async () => {
          useProductMaster().init();
          await useProductMaster().prefetch(productIds);
        })()
      : Promise.resolve()
  ]);

  if (searchKeyword.value.trim()) await searchProducts(0, false);
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

.facility-label {
  align-self: center;
}
</style>
