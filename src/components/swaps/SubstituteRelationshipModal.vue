<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Link substitutes') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-searchbar
      v-model="queryString"
      :placeholder="translate('Search products')"
      :debounce="400"
      @ionInput="search()"
    />

    <ion-list v-if="selectedProducts.length">
      <ion-list-header>
        <ion-label>{{ translate('Selected substitutes') }}</ion-label>
      </ion-list-header>
      <ion-item lines="none">
        <ion-chip v-for="product in selectedProducts" :key="product.productId">
          <ion-label>{{ productLabel(product) }}</ion-label>
          <ion-icon :icon="closeCircle" @click="removeSelected(product.productId)" />
        </ion-chip>
      </ion-item>
    </ion-list>

    <div v-if="loading" class="ion-text-center ion-padding">
      <ion-spinner name="crescent" />
    </div>

    <ErrorState
      v-else-if="error"
      :title="translate('Could not load substitutes')"
      :message="error"
      retryable
      @retry="initialize()"
    />

    <ion-list v-else-if="products.length" lines="none">
      <ion-item v-for="product in products" :key="product.productId" button @click="toggleSelected(product)">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="product.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ productLabel(product) }}
          <p>{{ product.sku || product.productId }}</p>
        </ion-label>
        <ion-checkbox slot="end" :checked="selectedIds.has(product.productId)" />
      </ion-item>
    </ion-list>

    <EmptyState
      v-else-if="queryString"
      :title="translate('No products found')"
      :message="translate('Try another product name, SKU, or product ID.')"
    />

    <EmptyState
      v-else
      :title="translate('Search for substitutes')"
      :message="translate('Search and select one or more products that can replace this unfillable item.')"
    />

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!dirty || saving" @click="save()">
        <ion-spinner v-if="saving" name="crescent" />
        <ion-icon v-else :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSearchbar,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { closeCircle, closeOutline, saveOutline } from 'ionicons/icons';
import { computed, onMounted, ref } from 'vue';
import { DxpShopifyImg, translate } from '@common';
import { useSolrSearch } from '@common/composables/useSolrSearch';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { useProductMaster } from '@/composables/useProductMaster';
import {
  createSubstituteAssociation,
  expireSubstituteAssociation,
  fetchActiveSubstitutes,
  type SubstituteAssociation,
} from '@/services/productAssociations';
import { isSameProduct, type ProductIdentity } from '@/utils/productIdentity';

interface SelectableProduct {
  productId: string;
  productName?: string;
  parentProductName?: string;
  internalName?: string;
  sku?: string;
  mainImageUrl?: string;
}

const props = defineProps<{
  productId: string;
  sourceProduct?: ProductIdentity;
}>();
const { searchProducts } = useSolrSearch();
const productMaster = useProductMaster();

const queryString = ref('');
const products = ref<SelectableProduct[]>([]);
const selectedById = ref<Record<string, SelectableProduct>>({});
const existingById = ref<Record<string, SubstituteAssociation>>({});
const initialIds = ref<Set<string>>(new Set());
const loading = ref(false);
const saving = ref(false);
const error = ref('');

const sourceProduct = computed<ProductIdentity>(() => props.sourceProduct || { productId: props.productId });
const selectedProducts = computed(() => Object.values(selectedById.value));
const selectedIds = computed(() => new Set(Object.keys(selectedById.value)));
const dirty = computed(() => {
  const current = selectedIds.value;
  return current.size !== initialIds.value.size || [...current].some((id) => !initialIds.value.has(id));
});

function productLabel(product: SelectableProduct) {
  return product.productName || product.parentProductName || product.internalName || product.productId;
}

function normalizeProduct(product: any): SelectableProduct {
  return {
    productId: product.productId,
    productName: product.productName,
    parentProductName: product.parentProductName,
    internalName: product.internalName,
    sku: product.sku,
    mainImageUrl: product.mainImageUrl,
  };
}

async function initialize() {
  loading.value = true;
  error.value = '';
  try {
    const associations = await fetchActiveSubstitutes(props.productId);
    existingById.value = Object.fromEntries(associations.map((association) => [association.productIdTo, association]));
    initialIds.value = new Set(associations.map((association) => association.productIdTo));
    const enriched = await productMaster.getByIds([...initialIds.value]);
    const enrichedById = Object.fromEntries(enriched.map((product) => [product.productId, product]));
    selectedById.value = Object.fromEntries([...initialIds.value].map((productId) => [
      productId,
      normalizeProduct(enrichedById[productId] || { productId }),
    ]));
  } catch (cause) {
    error.value = translate('Failed to load existing substitute relationships. Please try again.');
  } finally {
    loading.value = false;
  }
}

async function search() {
  const keyword = queryString.value.trim();
  if (!keyword) {
    products.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const result = await searchProducts({ keyword, viewSize: 30 });
    products.value = (result.products || [])
      .filter((product: any) => product.productId && !isSameProduct(product, sourceProduct.value))
      .map(normalizeProduct);
  } catch (cause) {
    error.value = translate('Product search failed. Please try again.');
  } finally {
    loading.value = false;
  }
}

function toggleSelected(product: SelectableProduct) {
  if (isSameProduct(product, sourceProduct.value)) return;
  if (selectedById.value[product.productId]) {
    removeSelected(product.productId);
    return;
  }
  selectedById.value = { ...selectedById.value, [product.productId]: normalizeProduct(product) };
}

function removeSelected(productId: string) {
  const next = { ...selectedById.value };
  delete next[productId];
  selectedById.value = next;
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const currentIds = selectedIds.value;
    const additions = [...currentIds].filter((productId) => !initialIds.value.has(productId));
    const removals = [...initialIds.value].filter((productId) => !currentIds.has(productId));
    await Promise.all([
      ...additions.map((productId) => createSubstituteAssociation(props.productId, productId)),
      ...removals.map((productId) => expireSubstituteAssociation(props.productId, existingById.value[productId])),
    ]);
    modalController.dismiss({ hasSubstitutes: currentIds.size > 0, selectedProductIds: [...currentIds] }, 'confirm');
  } catch (cause) {
    error.value = translate('Failed to save substitute relationships. Please try again.');
  } finally {
    saving.value = false;
  }
}

function dismiss() {
  modalController.dismiss({ hasSubstitutes: initialIds.value.size > 0 }, 'cancel');
}

onMounted(initialize);
</script>
