<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate("Create order") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content id="filter-content">
      <div class="find">
        <aside class="filters">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate("Assign") }}</ion-card-title>
            </ion-card-header>
            <ion-item>
              <ion-icon :icon="globeOutline" slot="start" />
              <ion-select v-model="orderForm.shopId" :label="translate('Shopify Shop')" :placeholder="translate('Select')" interface="popover">
                <ion-select-option v-for="shop in shopsList" :value="shop.shopId" :key="shop.shopId">{{ shop.name ? shop.name : shop.shopId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-icon :icon="storefrontOutline" slot="start" />
              <ion-select v-model="orderForm.facilityId" :label="translate('Facility')" :placeholder="translate('Select')" interface="popover">
                <ion-select-option v-for="facility in facilities" :value="facility.facilityId" :key="facility.facilityId">{{ facility.faciityName ? facility.faciityName : facility.facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-icon :icon="cashOutline" slot="start" />
              <ion-select v-model="orderForm.currencyCode" :label="translate('Currency')" :placeholder="translate('Select')" interface="popover">
                <ion-select-option v-for="currency in currencies" :value="currency.uomId" :key="currency.uomId">{{ currency.abbreviation ? currency.abbreviation : currency.uomId }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>
                {{ translate("Customer") }}
                <ion-button size="small" fill="outline" @click="openCustomerModal">
                  <ion-icon :icon="addCircleOutline" slot="start"/>
                  {{ orderForm.customer.id ? translate("Edit") : translate("Add") }}
                </ion-button>
              </ion-card-title>
            </ion-card-header>
            <ion-item v-if="orderForm.customer.id">
              <ion-label>
                <h3>{{ orderForm.customer.firstName }} {{ orderForm.customer.lastName }}</h3>
                <h3>{{ orderForm.customer.phone }}</h3>
                <h3>{{ orderForm.customer.email }}</h3>
              </ion-label>
            </ion-item>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate("Notes") }}</ion-card-title>
            </ion-card-header>
            <ion-item>
              <ion-textarea v-model="orderForm.note" :placeholder="translate('Add notes/instructions for the order')"></ion-textarea>
            </ion-item>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate("Tags") }}</ion-card-title>
            </ion-card-header>
            <ion-item>
              <ion-input v-model="orderForm.tags" :placeholder="translate('Add tags, comma separated')"></ion-input>
            </ion-item>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>
                {{ translate("Shipping Address") }}
                <ion-button size="small" fill="outline" @click="openShippingAddressModal">
                  <ion-icon :icon="addCircleOutline" slot="start"/>
                  {{ orderForm.shippingAddress.zip ? translate("Edit") : translate("Add") }}
                </ion-button>
              </ion-card-title>
            </ion-card-header>
            <ion-item v-if="orderForm.shippingAddress.zip">
              <ion-label>
                <p>{{ orderForm.shippingAddress.address1 }}</p>
                <p>{{ orderForm.shippingAddress.address2 }}</p>
                <p>{{ orderForm.shippingAddress.city }}</p>
                <p>{{ orderForm.shippingAddress.province }}</p>
                <p>{{ orderForm.shippingAddress.country }}</p>
                <p>{{ orderForm.shippingAddress.phone }}</p>
                <p>{{ orderForm.shippingAddress.zip }}</p>
              </ion-label>
            </ion-item>
          </ion-card>
        </aside>

        <main>
          <div>
            <ion-card class="add-items">
              <div class="mode">
                <div>
                  <h5 class="ion-margin-horizontal">{{ translate("Add items") }}</h5>
                  <ion-segment v-model="mode" @ionChange="segmentChange($event.target.value as string)">
                    <ion-segment-button value="scan" content-id="scan">
                      <ion-icon :icon="barcodeOutline" />
                    </ion-segment-button>
                    <ion-segment-button value="search" content-id="search">
                      <ion-icon :icon="searchOutline" />
                    </ion-segment-button>
                  </ion-segment>
                </div>
                <ion-button class="ion-margin" fill="outline" size="small" @click="openCustomLineModal">
                  <ion-icon slot="start" :icon="addOutline"></ion-icon>
                  {{ translate("Custom Line") }}
                </ion-button>
              </div>
              <div v-show="mode === 'scan'">
                <ion-item lines="full">
                  <ion-input ref="scanInput" v-model="queryString" :label="translate('Scan barcode')" :placeholder="barcodeIdentificationDesc[barcodeIdentifier] || barcodeIdentifier" @ionBlur="isScanningEnabled = false" @ionFocus="isScanningEnabled = true" @keyup.enter="queryString = $event.target.value; scanProduct()" />
                </ion-item>
                <ion-item lines="none" v-if="searchedProduct.productId">
                  <ion-thumbnail slot="start">
                    <DxpShopifyImg :src="getProduct(searchedProduct.productId)?.mainImageUrl || searchedProduct.mainImageUrl" :key="getProduct(searchedProduct.productId)?.mainImageUrl || searchedProduct.mainImageUrl" />
                  </ion-thumbnail>
                  <ion-label>
                    {{ commonUtil.getProductIdentificationValue(barcodeIdentifier, getProduct(searchedProduct.productId)) }}
                    <p>{{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(searchedProduct.productId)) ? commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(searchedProduct.productId)) : getProduct(searchedProduct.productId)?.internalName }}</p>
                    <p v-if="commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(searchedProduct.productId)) !== null">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(searchedProduct.productId)) }}</p>
                  </ion-label>
                  <ion-icon :icon="checkmarkDoneOutline" color="success" slot="end" />
                </ion-item>

                <ion-item lines="none" v-else-if="searchedProduct.scannedId && !searchedProduct.productId">
                  <ion-icon :icon="cloudOfflineOutline" slot="start" />
                  <ion-label>
                    {{ searchedProduct.scannedId }} {{ translate("not found") }}
                    <p>{{ translate("Try searching using a keyword instead") }}</p>
                  </ion-label>
                  <ion-button size="small" slot="end" color="primary" @click="openAddProductModal">
                    <ion-icon slot="start" :icon="searchOutline" />
                    {{ translate("Search") }}
                  </ion-button>
                </ion-item>

                <ion-item lines="none" v-else-if="!isScanningEnabled">
                  <ion-thumbnail slot="start">
                    <DxpShopifyImg />
                  </ion-thumbnail>
                  <ion-label>
                    {{ translate("Your scanner isn’t focused yet.") }}
                    <p>{{ translate("Scanning is set to") }} {{ barcodeIdentificationDesc[barcodeIdentifier] || barcodeIdentifier }}</p>
                    <p v-if="barcodeIdentifier !== 'SKU'">{{ translate("Swap to SKU from the settings page") }}</p>
                  </ion-label>
                  <ion-button slot="end" color="warning" size="small" @click="enableScan">
                    <ion-icon slot="start" :icon="locateOutline" />
                    {{ translate("Focus scanning") }}
                  </ion-button>
                </ion-item>

                <ion-item lines="none" v-else>
                  <ion-thumbnail slot="start">
                    <DxpShopifyImg />
                  </ion-thumbnail>
                  <ion-label>
                    {{ translate("Begin scanning products to add them to this order") }}
                    <p>{{ translate("Scanning is set to") }} {{ barcodeIdentificationDesc[barcodeIdentifier] || barcodeIdentifier }}</p>
                    <p v-if="barcodeIdentifier !== 'SKU'">{{ translate("Swap to SKU from the settings page") }}</p>
                  </ion-label>
                  <ion-badge slot="end" color="success">{{ translate("start scanning") }}</ion-badge>
                </ion-item>
              </div>
              <div v-show="mode === 'search'">
                <ion-searchbar data-testid="search-product-input" ref="searchInput" v-model="queryString" :placeholder="translate('Search')" @ionClear="clearSearch" />

                <ion-item lines="none" v-if="isSearchingProduct">
                  <ion-spinner name="crescent" />
                </ion-item>

                <ion-list lines="none" v-else-if="searchedProduct.productId">
                  <ion-item>
                    <ion-thumbnail slot="start">
                      <DxpShopifyImg :src="searchedProduct.mainImageUrl" :key="searchedProduct.mainImageUrl" />
                    </ion-thumbnail>
                    <ion-label>
                      {{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(searchedProduct.productId)) }}
                      <p v-if="commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(searchedProduct.productId)) !== 'null'">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(searchedProduct.productId)) }}</p>
                    </ion-label>
                    <template v-if="!isItemInOrder">
                      <ion-button slot="end" fill="outline" @click="addLineItem(searchedProduct)">
                        {{ translate("Add") }}
                      </ion-button>
                    </template>
                    <template v-else>
                      <ion-icon slot="end" :icon="checkmarkOutline" color="success" />
                    </template>
                  </ion-item>
                  <ion-item button v-if="productSearchCount > 1" data-testid="view-more-results" detail @click="openAddProductModal">
                    {{ translate("View more results", { count: productSearchCount - 1 }) }}
                  </ion-item>
                </ion-list>

                <ion-list lines="none" v-else-if="queryString">
                  <ion-item>
                    <ion-icon :icon="cloudOfflineOutline" slot="start" />
                    <ion-label>
                      {{ translate("No product found") }}
                      <p>{{ translate("Try a different keyword") }}</p>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <ion-item lines="none" v-else>
                  <ion-icon :icon="shirtOutline" slot="start" />
                  {{ translate("Search for products by their Parent name, SKU or UPC") }}
                </ion-item>
              </div>
            </ion-card>
          </div>

          <template v-if="orderForm.lineItems.length">
            <div class="list-item ion-margin-horizontal" v-for="(lineItem, index) in orderForm.lineItems" :key="lineItem.productId">
              <ion-item lines="none">
                <ion-thumbnail slot="start">
                  <DxpShopifyImg :src="lineItem.mainImageUrl" :key="lineItem.mainImageUrl"/>
                </ion-thumbnail>
                <ion-label>
                  {{ getProduct(lineItem.productId)?.productId ? commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(lineItem.productId)) : lineItem.title }}
                  <p v-if="commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(lineItem.productId)) !== 'null'">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(lineItem.productId)) }}</p>
                </ion-label>
              </ion-item>
              <div class="tablet">
                <ion-label>{{ formatMoney(lineItem.price) }}</ion-label>
              </div>
              <ion-item>
                <ion-input v-model="lineItem.quantity" type="number" :label="translate('Qty')" label-placement="floating" min="0"/>
              </ion-item>
              <ion-button color="danger" fill="clear" @click="removeLineItem(index)">
                <ion-icon slot="icon-only" :icon="trashOutline"/>
              </ion-button>
            </div>

            <ion-card>
              <ion-card-header>
                <ion-title>{{ translate("Payment") }}</ion-title>
              </ion-card-header>
              <ion-card-content>
                <ion-item>
                  <ion-label>{{ translate("Subtotal") }}</ion-label>
                  <ion-label slot="end">{{ formatMoney(totals.subtotal) }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Shipping") }}</ion-label>
                  <ion-label slot="end">{{ formatMoney(totals.shipping) }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Tax") }}</ion-label>
                  <ion-label slot="end">{{ translate("Not calculated") }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Total") }}</ion-label>
                  <ion-label slot="end">{{ formatMoney(totals.total) }}</ion-label>
                </ion-item>
              </ion-card-content>
            </ion-card>
          </template>
          <div v-else class="empty-state">
            <p>{{ translate("Add items to this order by scanning or searching for products using keywords") }}</p>
          </div>
        </main>
      </div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button data-testid="create-order-submit-btn" @click="submitOrder">
          <ion-icon :icon="checkmarkDoneOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue';
import { IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonMenuButton, IonPage, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTextarea, IonThumbnail, IonTitle, IonToolbar, IonSpinner, modalController } from '@ionic/vue';
import { addOutline, storefrontOutline, searchOutline, checkmarkDoneOutline, barcodeOutline, cloudOfflineOutline, shirtOutline, checkmarkOutline, locateOutline, addCircleOutline, trashOutline, cashOutline, globeOutline } from 'ionicons/icons';
import { api, commonUtil, DxpShopifyImg, logger, translate, useSolrSearch } from '@common';
import emitter from '@/event-bus';
import { getShopifyShops } from '@/services/customer';
import { useProductStore } from '@/store/productStore';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import AddressModal from '@/components/AddressModal.vue';
import AddCustomerModal from '@/components/AddCustomerModal.vue';
import AddProductModal from '@/components/AddProductModal.vue';
import AddCustomLineModal from '@/components/AddCustomLineModal.vue';
import { useSeedStore } from '@/store/seed';

const currencies = ref([]) as any;
const shopsList = ref<any[]>([]);
const mode = ref("scan");
const queryString = ref("");
const isSearchingProduct = ref(false);
const searchedProduct = ref({}) as any;
const isScanningEnabled = ref(false);

const barcodeIdentifier = computed(() => useProductStore().getBarcodeIdentifierPref);
const barcodeIdentificationDesc = computed(() => useProductStore().getBarcodeIdentifierOptions);
const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);
const isItemInOrder = computed(() => orderForm.value.lineItems.some((lineItem: any) => lineItem.productId === searchedProduct.value.productId))

let timeoutId: any = null;
const productSearchCount = ref(0);
const facilities = ref([]) as any

const getProduct = (productId: string) => useProductCacheStore().getProduct(productId);

const scanInput = ref("") as any;
const searchInput = ref("") as any;

const orderForm = ref({
  shopId: '',
  productStoreId: '',
  currencyCode: 'USD',
  facilityId: '',
  customer: {
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  },
  shippingAddress: {
    address1: '',
    address2: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    phone: ''
  },
  lineItems: [] as Array<{
    productId?: string;
    sku: string;
    title: string;
    quantity: number;
    price: number;
    mainImageUrl: string;
  }>,
  note: '',
  tags: ""
});

watch(queryString, (value) => {
  if (mode.value === "scan") return;
  const searchedString = value?.trim();

  if (timeoutId) clearTimeout(timeoutId);
  if (!searchedString) {
    isSearchingProduct.value = false;
    searchedProduct.value = {};
    return;
  }

  isSearchingProduct.value = true;
  timeoutId = setTimeout(() => {
    findProduct(searchedString);
  }, 800);
}, { deep: true });

onMounted(async () => {
  fetchCurrencies();
  try {
    const productStoreId = useProductStore().getCurrentProductStore.productStoreId
    shopsList.value = await getShopifyShops({
      productStoreId
    });
    facilities.value = Object.values(useSeedStore().productStoreFacilitiesByStoreId[productStoreId].byId)
  } catch (err: any) {
    commonUtil.showToast(translate("Failed to load Shopify shops: " + (err.message || err)));
  }
});

async function findProduct(value: string) {
  if (!value) {
    isSearchingProduct.value = false;
    return null;
  }

  try {
    const payload: any = {
      filters: {
        productStoreIds_s: { value: useProductStore().getCurrentProductStore.productStoreId }
      },
      viewSize: 1
    };

    if (mode.value === "scan") {
      payload.filters["goodIdentifications"] = { value: `${barcodeIdentifier.value}/${value}` };
    } else {
      payload.keyword = value;
    }

    const resp = await useSolrSearch().searchProducts(payload);

    if (resp.total) {
      productSearchCount.value = resp.total;
      const item = resp.products[0];
      useProductMaster().upsertFromApi([item]);
      searchedProduct.value = item;
      isSearchingProduct.value = false;
      return item;
    } else {
      searchedProduct.value = { scannedId: value };
      isSearchingProduct.value = false;
      return null;
    }
  } catch (err) {
    logger.error(err);
    searchedProduct.value = {};
    isSearchingProduct.value = false;
  }
}

function removeLineItem(index: number) {
  orderForm.value.lineItems.splice(index, 1);
}

async function scanProduct() {
  const scannedId = queryString.value?.trim();
  if (!scannedId) return;
  queryString.value = "";

  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  isSearchingProduct.value = true;
  const productFound: any = await findProduct(scannedId);
  if (productFound && !orderForm.value.lineItems.some((item: any) => item.productId === productFound.productId)) {
    addLineItem(productFound);
  }
}

async function openAddProductModal() {
  const modal = await modalController.create({
    component: AddProductModal,
    componentProps: {
      query: searchedProduct.value.scannedId || queryString.value,
      addProductToQueue: addLineItem,
      isProductInOrder: (productId: string) => orderForm.value.lineItems.some((item: any) => item.productId === productId),
      pendingProductIds: new Set()
    }
  });
  await modal.present();
}

function clearSearch() {
  queryString.value = "";
  searchedProduct.value = {};
}

async function enableScan() {
  mode.value = "scan";
  isScanningEnabled.value = true;
  setTimeout(() => {
    scanInput.value?.$el.setFocus?.();
  }, 0);
}

async function enableSearch() {
  mode.value = "search";
  await nextTick();
  searchInput.value?.$el.setFocus?.();
  isScanningEnabled.value = false;
}

function segmentChange(modeValue: string) {
  clearSearch();
  modeValue === "search" ? enableSearch() : isScanningEnabled.value = false;
}

// Modal state
const isModalOpen = ref(false);
const orderResponseData = ref({
  shopifyOrderId: '',
  shopifyOrderName: ''
});

async function openShippingAddressModal() {
  const addressModal = await modalController.create({
    component: AddressModal,
    componentProps: orderForm.value.shippingAddress
  })

  await addressModal.present()
}

async function openCustomLineModal() {
  const modal = await modalController.create({
    component: AddCustomLineModal
  });
  modal.onDidDismiss().then(({ data }) => {
    if(data) {
      orderForm.value.lineItems.push({
        productId: "",
        sku: "",
        title: data.productName,
        quantity: data.quantity,
        price: data.price,
        mainImageUrl: ""
      });
    }
  });
  await modal.present();
}

// Line Items management
function addLineItem(item: any) {
  orderForm.value.lineItems.push({
    productId: item.productId,
    sku: item.sku,
    title: item.title,
    quantity: 1,
    price: getProductPrice(item),
    mainImageUrl: item.mainImageUrl
  });
}

function getProductPrice(product: any): number {
  // Look for any key containing '_price' in product doc
  const priceKey = Object.keys(product).find(key => key.endsWith('_price') || key.toLowerCase().includes('price'));
  if (priceKey && product[priceKey]) {
    const val = parseFloat(product[priceKey]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

// Pricing calculations
const totals = computed(() => {
  const subtotal = orderForm.value.lineItems.reduce((acc, item) => {
    return acc + (item.quantity * item.price);
  }, 0);
  
  // Free shipping above $150
  let shipping = 0;
  if (subtotal > 0) {
    shipping = subtotal >= 150 ? 0 : 10;
  }

  const total = Math.round((subtotal + shipping) * 100) / 100;

  return { subtotal, shipping, total };
});

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function resetForm() {
  orderForm.value = {
    currencyCode: 'USD',
    shopId: orderForm.value.shopId || '',
    productStoreId: orderForm.value.productStoreId || '',
    facilityId: '',
    customer: {
      id: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    },
    shippingAddress: {
      address1: '',
      address2: '',
      city: '',
      province: '',
      zip: '',
      country: '',
      phone: ''
    },
    lineItems: [],
    note: '',
    tags: ""
  };
  clearSearch();
}

// Validation & API Submission
async function submitOrder() {
  const form = orderForm.value;

  // 1. Config Validation
  if (!form.shopId) {
    commonUtil.showToast(translate("Please select a Shop."));
    return;
  }

  // 2. Customer Validation
  if (!form.customer.id || !form.customer.email || !form.customer.firstName || !form.customer.lastName) {
    commonUtil.showToast(translate("Please complete all required customer information fields."));
    return;
  }

  // 3. Shipping Address Validation
  const addr = form.shippingAddress;
  if (!addr.address1 || !addr.city || !addr.province || !addr.zip || !addr.country) {
    commonUtil.showToast(translate("Please fill in all shipping address fields."));
    return;
  }

  // 4. Line Items Validation
  if(!form.lineItems.length) {
    commonUtil.showToast(translate("Please add at least one line item to the order."));
    return;
  }

  for (let i = 0; i < form.lineItems.length; i++) {
    const item = form.lineItems[i];
    if (!item.sku || !item.title) {
      commonUtil.showToast(translate(`Line item ${i + 1} has missing SKU or Title.`));
      return;
    }
    if (item.quantity <= 0) {
      commonUtil.showToast(translate(`Line item ${i + 1} must have a quantity greater than 0.`));
      return;
    }
    if (item.price < 0) {
      commonUtil.showToast(translate(`Line item ${i + 1} cannot have a negative price.`));
      return;
    }
  }

  // 5. Build API Payload
  const payload = {
    shopId: form.shopId,
    shopifyCustomerId: form.customer.id,
    currencyCode: form.currencyCode,
    facilityId: form.facilityId,
    customer: {
      firstName: form.customer.firstName,
      lastName: form.customer.lastName,
      email: form.customer.email,
      phone: form.customer.phone
    },
    shippingAddress: {
      address1: form.shippingAddress.address1,
      address2: form.shippingAddress.address2,
      city: form.shippingAddress.city,
      province: form.shippingAddress.province,
      zip: form.shippingAddress.zip,
      country: form.shippingAddress.country,
      phone: form.shippingAddress.phone
    },
    items: form.lineItems.map(item => ({
      productId: item.productId,
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      price: item.price
    })),
    note: form.note,
    tags: form.tags
  };

  emitter.emit('presentLoader', { message: 'Submitting Shopify Order...' });

  try {
    const response = await api({
      url: 'oms/orders/shopify',
      method: 'post',
      data: payload
    });

    emitter.emit('dismissLoader');

    if (response?.data?.shopifyOrderName) {
      orderResponseData.value = {
        shopifyOrderId: response.data.shopifyOrderId || 'Unknown ID',
        shopifyOrderName: response.data.shopifyOrderName
      };
      
      // Present success feedback
      await commonUtil.showToast(translate("Shopify Order Created Successfully!"));
      resetForm();
    } else {
      throw new Error("Invalid response schema from order API");
    }
  } catch (err: any) {
    emitter.emit('dismissLoader');
    const errMsg = err?.message || 'Error occurred while creating Shopify order.';
    await commonUtil.showToast(translate(errMsg));
  }
}

async function openCustomerModal() {
  const addCustomerModal = await modalController.create({
    component: AddCustomerModal,
    componentProps: {
      shopId: orderForm.value.shopId
    }
  })

  addCustomerModal.onDidDismiss().then((data) => {
    if(data?.data?.customer) {
      orderForm.value.customer["id"] = data.data.customer["id"]
      orderForm.value.customer["firstName"] = data.data.customer["firstName"]
      orderForm.value.customer["lastName"] = data.data.customer["lastName"]
      orderForm.value.customer["phone"] = data.data.customer["phone"]
      orderForm.value.customer["email"] = data.data.customer["email"]
      orderForm.value.shippingAddress = data.data.customer.address
    }
  })

  await addCustomerModal.present();
}

async function fetchCurrencies() {
  try {
    const resp = await api({
      url: "admin/uoms",
      method: "get",
      params: { uomTypeEnumId: 'UT_CURRENCY_MEASURE', pageSize: 250 }
    });
    currencies.value = resp.data;
  } catch(err) {
    logger.error("Failed to fetch currencies", err)
  }
}
</script>

<style scoped>
ion-card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-item {
  --columns-desktop: 4;
  border-bottom: var(--border-medium);
}

/* Added width property as after updating to ionic7 min-width is getting applied on ion-label inside ion-item
which results in distorted label text and thus reduced ion-item width */
.list-item > ion-item {
  width: 100%;
}

.find {
  display: grid;
  grid-template-areas: "search"
                       "filters"
                       "main";
  align-items: start;
}

.find > .filters {
  display: none;
}

.find > main {
  grid-area: main;
}

.filters {
  grid-area: filters;
}

p:has(a) {
  cursor: pointer;
}

.add-items {
  flex: 3 1 375px;
}

.add-items .mode {
  display: flex;
  justify-content: space-between;
}

.add-items .mode div {
  display: flex;
}

.add-items .mode ion-segment {
  grid-auto-columns: minmax(auto, 150px);
  justify-content: start;
  flex: 0 1 max-content;
}

@media (min-width: 991px) {
  .find {
    grid: "main filters" 1fr
          "main filters" min-content
          / 750px;
    margin: var(--spacer-lg);
    margin-right: 0;
  }

  .find > .filters {
    display: unset;
  }
}
</style>
