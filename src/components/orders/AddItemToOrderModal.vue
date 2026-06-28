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
    <ion-item v-if="requiresFulfillmentReview" color="warning" lines="full">
      <ion-label>
        {{ translate('Adding to an in-progress ship group') }}
        <p>{{ translate('Added items will be approved for fulfillment and checked against the selected facility.') }}</p>
      </ion-label>
    </ion-item>

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
          <p v-if="facilityInventoryLabel(product.productId)">{{ facilityInventoryLabel(product.productId) }}</p>
        </ion-label>
        <!-- Show success check if already added, spinner while adding, Add button otherwise -->
        <ion-icon v-if="addedProductIds.has(product.productId)" slot="end" color="success" :icon="checkmarkCircle" />
        <ion-button
          v-else
          slot="end"
          fill="outline"
          :disabled="addingProductId === product.productId || isInventoryUnavailable(product.productId)"
          @click="addToOrder(product)"
        >
          <ion-spinner v-if="addingProductId === product.productId" name="crescent" slot="start" />
          {{ isInventoryUnavailable(product.productId) ? translate('Unavailable') : translate('Add') }}
        </ion-button>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonSpinner, IonThumbnail, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { checkmarkCircle, closeOutline } from 'ionicons/icons';
import { ref, computed } from 'vue';
import { api, commonUtil, DxpShopifyImg, translate } from '@common';
import { useSolrSearch } from '@common/composables/useSolrSearch';
import { showToast } from '@/utils';
import { useProductStore } from '@/store/productStore';
import { useSeedStore } from '@/store/seed';
import { normalizeFacilityRows, type FacilityInventoryRow } from '@/utils/facilityInventory';

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);
const seedStore = useSeedStore();

const props = defineProps<{
  orderId: string;
  shipGroupSeqId: string;
  productStoreId?: string;
  shipGroupFacilityId?: string;
  shipGroupFacilityName?: string;
  defaultItemStatusId?: string;
  requiresFulfillmentReview?: boolean;
  onItemAdded?: () => void;
}>();

const { searchProducts } = useSolrSearch();
const requiresFulfillmentReview = computed(() => Boolean(props.requiresFulfillmentReview));

const queryString = ref('');
const products = ref<any[]>([]);
const isLoading = ref(false);
const addingProductId = ref<string | null>(null);
const loadingInventoryProductIds = ref<Set<string>>(new Set());
const facilityInventoryByProductId = ref<Record<string, FacilityInventoryRow | null>>({});
// Tracks all successfully added productIds during this modal session
const addedProductIds = ref<Set<string>>(new Set());

async function onSearch() {
  const keyword = queryString.value.trim();
  if (!keyword) {
    products.value = [];
    facilityInventoryByProductId.value = {};
    return;
  }
  isLoading.value = true;
  try {
    const result = await searchProducts({ keyword, viewSize: 20 });
    products.value = result.products || [];
    void loadFacilityInventory(products.value);
  } catch {
    products.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function addToOrder(product: any) {
  addingProductId.value = product.productId;
  try {
    const data: Record<string, any> = {
      orderId: props.orderId,
      shipGroupSeqId: props.shipGroupSeqId,
      productId: product.productId,
      quantity: 1,
    };
    if (props.defaultItemStatusId) data.statusId = props.defaultItemStatusId;

    await api({
      url: `oms/orders/${props.orderId}/addItem`,
      method: 'POST',
      data,
    });
    // Mark as added and stay open for more additions
    addedProductIds.value = new Set([...addedProductIds.value, product.productId]);
    await showToast(translate(props.defaultItemStatusId === 'ITEM_APPROVED' ? 'Item added and approved for fulfillment.' : 'Item added to order successfully.'));
    props.onItemAdded?.();
  } catch (err: any) {
    await showToast(err?.response?.data?.errorMessage || translate('Failed to add item. Insufficient inventory or invalid product.'));
  } finally {
    addingProductId.value = null;
  }
}

function responseList(data: any) {
  return Array.isArray(data) ? data : data?.entityValueList ?? data?.docs ?? data?.list ?? data?.items ?? [];
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function facilityName() {
  return props.shipGroupFacilityName || props.shipGroupFacilityId || translate('selected facility');
}

function facilityInventoryLabel(productId: string) {
  if (!props.shipGroupFacilityId) return '';
  if (loadingInventoryProductIds.value.has(productId)) {
    return translate('Checking inventory at {facility}').replace('{facility}', facilityName());
  }
  if (!(productId in facilityInventoryByProductId.value)) return '';

  const row = facilityInventoryByProductId.value[productId];
  if (!row) {
    return translate('No inventory record at {facility}').replace('{facility}', facilityName());
  }

  return translate('{quantity} available at {facility}')
    .replace('{quantity}', formatQuantity(row.available))
    .replace('{facility}', facilityName());
}

function isInventoryUnavailable(productId: string) {
  if (!props.shipGroupFacilityId) return false;
  if (loadingInventoryProductIds.value.has(productId)) return true;
  if (!(productId in facilityInventoryByProductId.value)) return true;
  const row = facilityInventoryByProductId.value[productId];
  return !row || Number(row.available || 0) < 1;
}

function setInventoryLoading(productId: string, loading: boolean) {
  const next = new Set(loadingInventoryProductIds.value);
  loading ? next.add(productId) : next.delete(productId);
  loadingInventoryProductIds.value = next;
}

async function loadFacilityInventory(productList: any[]) {
  if (!props.shipGroupFacilityId || !productList.length) return;

  if (props.productStoreId) {
    await seedStore.loadProductStoreSeedData(props.productStoreId);
  }

  await Promise.all(productList.map(async (product) => {
    const productId = product.productId;
    if (!productId) return;
    setInventoryLoading(productId, true);
    try {
      const response = await api({
        url: 'oms/productFacilities',
        method: 'GET',
        params: { productId, pageSize: 500 }
      });
      const productFacilities = responseList(response.data);
      const productStoreFacilities = props.productStoreId
        ? seedStore.productStoreFacilitiesByStoreId[props.productStoreId]?.ids?.map((id: string) => seedStore.productStoreFacilitiesByStoreId[props.productStoreId].byId[id]) ?? []
        : [];
      const rows = normalizeFacilityRows({
        productFacilities,
        productStoreFacilities,
        facilityGroups: seedStore.facilityGroups.ids.map((id: string) => seedStore.facilityGroups.byId[id]),
        facilityGroupMembers: seedStore.facilityGroupMembers.ids.map((id: string) => seedStore.facilityGroupMembers.byId[id]),
        facilityName: (facilityId) => seedStore.facilityName(facilityId)
      });
      facilityInventoryByProductId.value = {
        ...facilityInventoryByProductId.value,
        [productId]: rows.find((row) => row.facilityId === props.shipGroupFacilityId) || null
      };
    } catch {
      facilityInventoryByProductId.value = {
        ...facilityInventoryByProductId.value,
        [productId]: null
      };
    } finally {
      setInventoryLoading(productId, false);
    }
  }));
}

function dismiss() {
  // Dismiss with confirm if any items were added so OrderDetail reloads, cancel otherwise
  const role = addedProductIds.value.size > 0 ? 'confirm' : 'cancel';
  modalController.dismiss({ added: addedProductIds.value.size > 0 }, role);
}
</script>
