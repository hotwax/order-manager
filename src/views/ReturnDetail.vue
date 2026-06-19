<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/customers" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Return Detail</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="loading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="returnRecord">
      <ion-card>
        <ion-item lines="full">
          <ion-label class="ion-text-wrap">
            <p class="overline">RMA</p>
            <h1>{{ returnRecord.externalId || returnRecord.returnId }}</h1>
            <p>{{ itemCountLabel }} · {{ money(returnRecord.returnTotal, returnRecord.currencyUomId) }}</p>
            <p>Status: {{ describe(returnRecord.statusId) }}</p>
          </ion-label>
        </ion-item>

        <ion-list lines="full">
          <ion-item>
            <ion-label>
              <p class="overline">Requested</p>
              {{ formatLongDate(returnRecord.entryDate) }}
            </ion-label>
            <ion-label v-if="returnRecord.destinationFacilityId" slot="end">
              <p class="overline">Facility</p>
              {{ returnRecord.destinationFacilityId }}
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <p class="overline">Order</p>
              {{ orderId || 'Not linked' }}
            </ion-label>
            <ion-button v-if="orderId" slot="end" fill="clear" :router-link="`/orders/${orderId}`">
              View order
              <ion-icon slot="end" :icon="openOutline" />
            </ion-button>
          </ion-item>
          <ion-item v-if="returnRecord.returnChannelEnumId">
            <ion-label>
              <p class="overline">Channel</p>
              {{ describe(returnRecord.returnChannelEnumId) }}
            </ion-label>
          </ion-item>
        </ion-list>
      </ion-card>

      <ion-list lines="full">
        <ion-list-header>
          <ion-label>Items</ion-label>
        </ion-list-header>
        <ion-item v-for="item in returnRecord.items" :key="item.returnItemSeqId">
          <ion-thumbnail v-if="item.productId" slot="start">
            <DxpShopifyImg :src="(productCache as any).getProduct(item.productId)?.mainImageUrl" size="small" />
          </ion-thumbnail>
          <ion-label class="ion-text-wrap">
            <h2>{{ item.description || item.productId || 'Return item' }}</h2>
            <p>{{ item.productId || 'No product ID' }}</p>
            <p>Qty {{ item.returnQuantity }}{{ item.receivedQuantity != null ? ` · Received ${item.receivedQuantity}` : '' }} · {{ money(item.returnPrice * item.returnQuantity, returnRecord.currencyUomId) }}</p>
            <p>Reason: {{ describe(item.returnReasonId) }} · Type: {{ describe(item.returnTypeId) }}</p>
            <p>Status: {{ describe(item.statusId) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="loading">
      <ion-list>
        <ion-item lines="none">
          <ion-label>Loading return...</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="error">
      <ErrorState title="Return failed to load" :message="error" />
    </ion-content>

    <ion-content v-else>
      <EmptyState title="Return not found" message="The selected return is not available in this workspace." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonPage,
  IonProgressBar,
  IonThumbnail,
  IonTitle,
  IonToolbar
} from '@ionic/vue';
import { DateTime } from 'luxon';
import { openOutline } from 'ionicons/icons';
import { DxpShopifyImg } from '@common';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import { getCustomerReturn } from '@/services/customer';
import { useProductCacheStore } from '@/store/productCache';
import { useSeedStore } from '@/store/seed';
import type { CustomerReturnSummary } from '@/types/customer';

const props = defineProps<{
  returnId: string;
}>();

const seed = useSeedStore();
const productCache = useProductCacheStore();
const returnRecord = ref<CustomerReturnSummary>();
const loading = ref(false);
const error = ref('');

const orderId = computed(() => returnRecord.value?.items.find((item) => item.orderId)?.orderId || '');
const itemCountLabel = computed(() => {
  const itemCount = returnRecord.value?.itemCount || 0;
  return `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
});

onMounted(loadReturn);
watch(() => props.returnId, loadReturn);

async function loadReturn() {
  loading.value = true;
  error.value = '';
  try {
    returnRecord.value = await getCustomerReturn(props.returnId);
  } catch (returnError: any) {
    error.value = returnError?.message || 'Failed to load return';
    returnRecord.value = undefined;
  } finally {
    loading.value = false;
  }
}

function describe(value?: string) {
  return value ? seed.describe(value) || value : 'Not specified';
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0));
}

function parseDate(value?: string | number) {
  if (!value) return undefined;
  const stringValue = String(value);
  const numeric = Number(value);
  if (/^\d+$/.test(stringValue)) {
    return DateTime.fromMillis(stringValue.length <= 10 ? numeric * 1000 : numeric);
  }
  const isoDate = DateTime.fromISO(stringValue);
  return isoDate.isValid ? isoDate : DateTime.fromSQL(stringValue);
}

function formatLongDate(value?: string | number) {
  const date = parseDate(value);
  return date?.isValid ? date.toLocaleString(DateTime.DATE_MED) : String(value ?? '');
}
</script>
