<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Clone order') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <p class="explainer">{{ translate('Creates a brand-new order from the items, customer, and shipping address of this order. Taxes, discounts, shipping, payment, and holds are not copied — they are recalculated on the new order.') }}</p>

    <ion-list>
      <ion-list-header>{{ translate('Summary') }}</ion-list-header>
      <ion-item>
        <ion-label>{{ translate('Items') }}</ion-label>
        <ion-note slot="end">{{ itemCount }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>{{ translate('Currency') }}</ion-label>
        <ion-note slot="end">{{ currency }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>{{ translate('Ship to') }}</ion-label>
        <ion-note slot="end">{{ shipToCity || '-' }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-list>
      <ion-list-header>{{ translate('Item prices') }}</ion-list-header>
      <ion-radio-group v-model="priceMode">
        <ion-item>
          <ion-radio label-placement="end" justify="start" value="CARRY">
            <ion-label>{{ translate('Carry over original prices') }}</ion-label>
          </ion-radio>
        </ion-item>
        <ion-item>
          <ion-radio label-placement="end" justify="start" value="CURRENT">
            <ion-label>{{ translate('Use current product prices') }}</ion-label>
          </ion-radio>
        </ion-item>
        <ion-item>
          <ion-radio label-placement="end" justify="start" value="FREE">
            <ion-label>{{ translate('Free') }}</ion-label>
          </ion-radio>
        </ion-item>
      </ion-radio-group>
    </ion-list>

    <ion-list>
      <ion-item>
        <ion-textarea
          :label="translate('Note')"
          label-placement="stacked"
          :rows="2"
          v-model="note"
        />
      </ion-item>
    </ion-list>

    <ion-list>
      <ion-list-header>{{ translate('Shopify shop') }}</ion-list-header>
      <ion-item v-if="shopStatus === 'resolving'">
        <ion-spinner slot="start" name="crescent" />
        <ion-label>{{ translate('Resolving shop...') }}</ion-label>
      </ion-item>
      <ion-item v-else-if="shopStatus === 'resolved'">
        <ion-label>{{ shopLabel }}</ion-label>
        <ion-note slot="end" color="success">{{ translate('Resolved') }}</ion-note>
      </ion-item>
      <ion-item v-else>
        <ion-select
          :label="translate('Shop')"
          label-placement="stacked"
          interface="popover"
          :placeholder="translate('Select shop')"
          v-model="shopId"
        >
          <ion-select-option v-for="shop in shops" :key="shop.shopId" :value="shop.shopId">
            {{ shop.name || shop.shopId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
    </ion-list>

    <ion-list>
      <ion-list-header>{{ translate('Shopify customer') }}</ion-list-header>
      <ion-item v-if="customerStatus === 'resolving'">
        <ion-spinner slot="start" name="crescent" />
        <ion-label>{{ translate('Resolving customer...') }}</ion-label>
      </ion-item>
      <ion-item v-else-if="customerStatus === 'resolved'">
        <ion-label>
          {{ customerLabel }}
          <p>{{ customerSourceLabel }}</p>
        </ion-label>
        <ion-note slot="end" color="success">{{ translate('Resolved') }}</ion-note>
      </ion-item>
      <ion-item v-else>
        <ion-label color="danger" class="ion-text-wrap">{{ customerError }}</ion-label>
      </ion-item>
    </ion-list>

    <ion-item lines="none" v-if="submitError">
      <ion-label color="danger" class="ion-text-wrap">{{ submitError }}</ion-label>
    </ion-item>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!isValid" @click="confirm()">
        <ion-icon :icon="checkmarkOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import { computed, onMounted, ref, watch } from 'vue';
import { api, emitter, logger, translate } from '@common';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { createShopifyCustomer, searchShopifyCustomers } from '@/services/customer';
import { showToast } from '@/utils';
import { buildClonePayload, cloneCustomerName, cloneEmail, clonePhone, defaultCloneNote, type ClonePriceMode } from '@/utils/cloneOrder';

/** PartyIdentification type carrying the numeric Shopify customer id (ShopifySeedData.xml). */
const SHOPIFY_CUSTOMER_ID_TYPE = 'SHOPIFY_CUST_ID';

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();
const productCache = useProductCacheStore();

const raw = computed(() => orderDetailStore.current);

const priceMode = ref<ClonePriceMode>('CARRY');
const note = ref(defaultCloneNote(raw.value));

const currency = computed(() => raw.value?.currencyUom || 'USD');
const itemCount = computed(() =>
  (raw.value?.shipGroups || []).reduce((count: number, shipGroup: any) => count + (shipGroup.items || []).length, 0)
);
const shipToCity = computed(() => orderDetailStore.contactMechsByPurpose['SHIPPING_LOCATION']?.postalAddress?.city || '');
const email = computed(() => cloneEmail(raw.value));

// ── Shop resolution: ShopifyShopOrder mapping first, manual pick from seed shops as fallback.
const shopStatus = ref<'resolving' | 'resolved' | 'manual'>('resolving');
const shopId = ref('');
const shops = computed(() => seed.shopifyShops.ids.map((id: string) => seed.shopifyShops.byId[id]));
const shopLabel = computed(() => seed.shopifyShops.byId[shopId.value]?.name || shopId.value);

// ── Customer resolution: PartyIdentification → Shopify email search → create at submit.
const customerStatus = ref<'resolving' | 'resolved' | 'error'>('resolving');
const customerSource = ref<'identification' | 'search' | 'create' | ''>('');
const shopifyCustomerId = ref('');
const customerError = ref('');

const customerLabel = computed(() =>
  shopifyCustomerId.value ? `${email.value || orderDetailStore.customerName} (#${shopifyCustomerId.value})` : email.value
);
const customerSourceLabel = computed(() => {
  if (customerSource.value === 'identification') return translate('Matched by OMS party identification');
  if (customerSource.value === 'search') return translate('Matched by email on Shopify');
  if (customerSource.value === 'create') return translate('Will be created on Shopify when the clone is submitted');
  return '';
});

const submitError = ref('');
const isSubmitting = ref(false);

const isValid = computed(() =>
  !!shopId.value && customerStatus.value === 'resolved' && !isSubmitting.value
);

async function resolveShop() {
  shopStatus.value = 'resolving';
  if (!raw.value?.orderId) {
    shopStatus.value = 'manual';
    return;
  }
  try {
    const resp = await api({ url: `oms/orders/${raw.value?.orderId}/shopifyShopOrder`, method: 'GET' });
    const rows: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs ?? []);
    const resolvedShopId = rows.find((row: any) => row.shopId)?.shopId || '';
    if (resolvedShopId) {
      shopId.value = resolvedShopId;
      shopStatus.value = 'resolved';
      return;
    }
    shopStatus.value = 'manual';
  } catch (error) {
    logger.error('Failed to resolve the Shopify shop for the order', error);
    shopStatus.value = 'manual';
  }
}

async function resolveCustomer() {
  customerStatus.value = 'resolving';
  customerError.value = '';

  // 1. The OMS may already hold the Shopify customer id as a party identification.
  const partyId = orderDetailStore.customerPartyId;
  if (partyId) {
    try {
      const resp = await api({ url: `oms/parties/${partyId}/identifications`, method: 'GET' });
      const rows: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs ?? []);
      const match = rows.find((row: any) => row.partyIdentificationTypeId === SHOPIFY_CUSTOMER_ID_TYPE && row.idValue);
      if (match) {
        shopifyCustomerId.value = String(match.idValue);
        customerSource.value = 'identification';
        customerStatus.value = 'resolved';
        return;
      }
    } catch (error) {
      logger.error('Failed to load party identifications', error);
    }
  }

  // 2. Search Shopify by the order email (needs a shop to search against).
  if (email.value && shopId.value) {
    try {
      const customers: any[] = await searchShopifyCustomers(shopId.value, email.value);
      const match = customers.find((customer: any) => (customer.email || '').toLowerCase() === email.value.toLowerCase());
      if (match?.id) {
        shopifyCustomerId.value = String(match.id);
        customerSource.value = 'search';
        customerStatus.value = 'resolved';
        return;
      }
    } catch (error) {
      logger.error('Failed to search Shopify customers', error);
    }
  }

  // 3. Create — deferred to submit so cancelling the modal has no side effects.
  if (email.value) {
    customerSource.value = 'create';
    customerStatus.value = 'resolved';
    return;
  }

  customerStatus.value = 'error';
  customerError.value = translate('No Shopify customer could be resolved — the order has no customer email to search or create with.');
}

onMounted(async () => {
  seed.loadShopifyShops();
  await resolveShop();
  await resolveCustomer();
});

// A manual shop pick unlocks the email-search step the initial pass skipped.
watch(shopId, () => {
  if (shopStatus.value === 'manual' && shopId.value && customerSource.value !== 'identification' && !isSubmitting.value) {
    resolveCustomer();
  }
});

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  const message = data?.errors || data?.errorMessage || data?._ERROR_MESSAGE_
    || (Array.isArray(data?._ERROR_MESSAGE_LIST_) ? data._ERROR_MESSAGE_LIST_.join(' ') : '')
    || err?.message || '';
  return Array.isArray(message) ? message.join(' ') : String(message);
}

async function confirm() {
  if (!isValid.value || !raw.value) return;
  submitError.value = '';
  isSubmitting.value = true;

  try {
    // Final customer fallback: create on Shopify, like CreateOrder's "new" mode.
    let customerId = shopifyCustomerId.value;
    if (!customerId && customerSource.value === 'create') {
      const { firstName, lastName } = cloneCustomerName(raw.value);
      emitter.emit('presentLoader', { message: 'Creating customer on Shopify...' });
      let res: any;
      try {
        res = await createShopifyCustomer(shopId.value, {
          email: email.value,
          phoneNumber: clonePhone(raw.value) || undefined,
          firstName: firstName || email.value,
          lastName: lastName || undefined,
        });
      } finally {
        emitter.emit('dismissLoader');
      }
      if (res?.hasShopifyError === 'Y') {
        throw new Error(translate('Shopify Error: ') + res.shopifyErrorMessage);
      }
      if (!res?.customerId) {
        throw new Error(translate('Failed to create customer on Shopify: no customerId returned.'));
      }
      customerId = res.customerId;
      shopifyCustomerId.value = customerId;
    }

    const payload = buildClonePayload(raw.value, {
      priceMode: priceMode.value,
      note: note.value,
      shopId: shopId.value,
      shopifyCustomerId: customerId,
      geoName: seed.geoName,
      getProduct: productCache.getProduct,
    });

    emitter.emit('presentLoader', { message: 'Cloning order...' });
    let response: any;
    try {
      response = await api({ url: 'oms/orders/shopify', method: 'post', data: payload });
    } finally {
      emitter.emit('dismissLoader');
    }

    if (!response?.data?.shopifyOrderName) {
      throw new Error('Invalid response schema from order API');
    }

    await showToast(translate('Order cloned successfully as {orderName}.', { orderName: response.data.shopifyOrderName }));
    modalController.dismiss({
      shopifyOrderId: response.data.shopifyOrderId || 'Unknown ID',
      shopifyOrderName: response.data.shopifyOrderName,
    }, 'confirm');
  } catch (err: any) {
    const message = extractErrorMessage(err);
    submitError.value = message || translate('Failed to clone the order. Please try again.');
    await showToast(submitError.value);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.explainer {
  margin: 16px;
  color: var(--ion-color-medium);
  font-size: 14px;
}
</style>
