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

    <ion-content class="ion-padding">
      <!-- Step 1: Select Shop -->
      <div v-if="!isBrandSelected" class="brand-select-container">
        <div class="brand-select-header ion-text-center ion-padding-bottom">
          <h1>{{ translate("Select a Shop") }}</h1>
          <p>{{ translate("Choose a Shopify Shop to begin creating the sales order") }}</p>
        </div>
        <ion-grid>
          <ion-row class="ion-justify-content-center">
            <ion-col size="12" size-md="6" size-lg="4" v-for="shop in shopsList" :key="shop.shopId">
              <ion-card button class="brand-card ion-activatable ripple-parent" @click="selectShop(shop.shopId, shop.productStoreId)">
                <ion-ripple-effect></ion-ripple-effect>
                <ion-card-content class="ion-text-center ion-padding-vertical">
                  <ion-icon :icon="storefrontOutline" class="brand-card-icon" />
                  <h2><strong>{{ shop.name || shop.shopId }}</strong></h2>
                  <p class="overline">{{ shop.shopId }}</p>
                </ion-card-content>
              </ion-card>
            </ion-col>
          </ion-row>
        </ion-grid>
      </div>

      <!-- Step 2: Create Order Form (shown only after shop selection) -->
      <ion-grid v-else>
        <ion-row>
          <!-- Left Column: Form Inputs -->
          <ion-col size="12" size-lg="8">
            <!-- Active Shop Header -->
            <ion-card class="active-brand-card">
              <ion-card-content class="active-brand-content">
                <div class="brand-info-wrapper">
                  <ion-icon :icon="storefrontOutline" class="active-brand-icon" />
                  <div class="brand-text">
                    <p class="overline ion-no-margin">{{ translate("Active Shop") }}</p>
                    <h3><strong>{{ getActiveShopName(orderForm.shopId) }}</strong></h3>
                  </div>
                </div>
                <ion-button fill="outline" size="small" color="medium" @click="changeBrand">
                  {{ translate("Change Shop") }}
                </ion-button>
              </ion-card-content>
            </ion-card>

            <!-- Customer Details Section -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="personOutline" class="card-icon" />
                  {{ translate("Customer Information") }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-segment v-model="customerMode" class="ion-margin-bottom" @ionChange="handleCustomerModeChange">
                  <ion-segment-button value="existing">
                    <ion-label>{{ translate("Existing Customer") }}</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="new">
                    <ion-label>{{ translate("Create New") }}</ion-label>
                  </ion-segment-button>
                </ion-segment>

                <div v-if="customerMode === 'existing'" class="ion-margin-bottom">
                  <ion-item lines="none" class="input-item ion-margin-bottom">
                    <ion-input
                      label="Search Customer"
                      label-placement="stacked"
                      placeholder="Type email, phone, or name and press Enter"
                      v-model="customerSearchQuery"
                      @keyup.enter="searchCustomers"
                    >
                      <ion-button slot="end" fill="clear" @click="searchCustomers">
                        <ion-icon :icon="searchOutline" />
                      </ion-button>
                    </ion-input>
                  </ion-item>

                  <div v-if="isSearching" class="ion-text-center ion-padding">
                    <ion-spinner name="crescent" />
                    <p>{{ translate("Searching Shopify customers...") }}</p>
                  </div>

                  <ion-item v-else lines="none" class="input-item">
                    <ion-select
                      label="Select Customer"
                      label-placement="stacked"
                      v-model="selectedCustomerId"
                      :placeholder="customersList.length > 0 ? 'Choose from search results' : 'Search for a customer first'"
                      :disabled="customersList.length === 0"
                      @ionChange="handleCustomerSelection"
                    >
                      <ion-select-option v-for="cust in customersList" :key="cust.id" :value="cust.id">
                        {{ cust.firstName || '' }} {{ cust.lastName || '' }} ({{ cust.email || 'No email' }})
                      </ion-select-option>
                    </ion-select>
                  </ion-item>

                  <!-- Selected Customer Details Summary -->
                  <div v-if="selectedCustomerId" class="selected-customer-summary ion-padding-top ion-margin-top">
                    <div class="summary-details">
                      <p><strong>{{ translate("Name") }}:</strong> {{ orderForm.customer.firstName }} {{ orderForm.customer.lastName }}</p>
                      <p><strong>{{ translate("Email") }}:</strong> {{ orderForm.customer.email }}</p>
                      <p v-if="orderForm.customer.phone"><strong>{{ translate("Phone") }}:</strong> {{ orderForm.customer.phone }}</p>
                    </div>
                  </div>
                </div>

                <ion-row v-if="customerMode === 'new'">
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="First Name"
                        label-placement="stacked"
                        v-model="orderForm.customer.firstName"
                        placeholder="First Name"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Last Name"
                        label-placement="stacked"
                        v-model="orderForm.customer.lastName"
                        placeholder="Last Name"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Email"
                        label-placement="stacked"
                        type="email"
                        v-model="orderForm.customer.email"
                        placeholder="customer@example.com"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Phone"
                        label-placement="stacked"
                        type="tel"
                        v-model="orderForm.customer.phone"
                        placeholder="Phone Number"
                      />
                    </ion-item>
                  </ion-col>

                  <ion-col size="12" class="ion-text-right ion-padding-top">
                    <ion-button color="primary" @click="handleCreateCustomer">
                      {{ translate("Create Customer") }}
                    </ion-button>
                  </ion-col>
                </ion-row>
              </ion-card-content>
            </ion-card>

            <!-- Shipping Address Section -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="locationOutline" class="card-icon" />
                  {{ translate("Shipping Address") }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-row>
                  <ion-col size="12">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Address Line 1"
                        label-placement="stacked"
                        v-model="orderForm.shippingAddress.address1"
                        placeholder="123 Main St"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Address Line 2"
                        label-placement="stacked"
                        v-model="orderForm.shippingAddress.address2"
                        placeholder="Apartment, suite, unit, etc. (optional)"
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="City"
                        label-placement="stacked"
                        v-model="orderForm.shippingAddress.city"
                        placeholder="City"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="State / Province"
                        label-placement="stacked"
                        v-model="orderForm.shippingAddress.province"
                        placeholder="State or Province"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Zip / Postal Code"
                        label-placement="stacked"
                        v-model="orderForm.shippingAddress.zip"
                        placeholder="Zip Code"
                        required
                      />
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-select
                        label="Country"
                        label-placement="stacked"
                        v-model="orderForm.shippingAddress.country"
                        placeholder="Select Country"
                      >
                        <ion-select-option value="United States">United States</ion-select-option>
                        <ion-select-option value="Canada">Canada</ion-select-option>
                        <ion-select-option value="United Kingdom">United Kingdom</ion-select-option>
                        <ion-select-option value="Mexico">Mexico</ion-select-option>
                      </ion-select>
                    </ion-item>
                  </ion-col>
                  <ion-col size="12" size-md="6">
                    <ion-item lines="none" class="input-item">
                      <ion-input
                        label="Shipping Phone"
                        label-placement="stacked"
                        type="tel"
                        v-model="orderForm.shippingAddress.phone"
                        placeholder="Shipping Phone"
                      />
                    </ion-item>
                  </ion-col>
                </ion-row>
              </ion-card-content>
            </ion-card>

            <!-- Line Items Section -->
            <ion-card>
              <ion-card-header class="line-items-header">
                <ion-card-title>
                  <ion-icon :icon="cubeOutline" class="card-icon" />
                  {{ translate("Line Items") }}
                </ion-card-title>
                <ion-button fill="outline" size="small" @click="addLineItem">
                  <ion-icon slot="start" :icon="addOutline" />
                  {{ translate("Add Item") }}
                </ion-button>
              </ion-card-header>
              <ion-card-content>
                <div v-if="orderForm.lineItems.length === 0" class="empty-items-state ion-text-center ion-padding">
                  <p>{{ translate("No products added to this order yet.") }}</p>
                  <ion-button fill="clear" @click="addLineItem">
                    {{ translate("Add your first product") }}
                  </ion-button>
                </div>
                <div v-else>
                  <div v-for="(item, index) in orderForm.lineItems" :key="index" class="item-row ion-margin-bottom">
                    <ion-row class="align-items-center">
                      <ion-col size="12" size-md="3">
                        <ion-item lines="none" class="input-item">
                          <ion-input
                            label="Search Product"
                            label-placement="stacked"
                            placeholder="SKU/Name & Enter"
                            v-model="item.searchQuery"
                            @keyup.enter="searchRowProducts(index)"
                          >
                            <ion-button slot="end" fill="clear" @click="searchRowProducts(index)">
                              <ion-icon :icon="searchOutline" />
                            </ion-button>
                          </ion-input>
                        </ion-item>
                      </ion-col>
                      <ion-col size="12" size-md="3">
                        <ion-item lines="none" class="input-item">
                          <ion-select
                            label="Select Product"
                            label-placement="stacked"
                            v-model="item.selectedProductIndex"
                            :placeholder="item.isSearching ? 'Searching...' : (item.searchResults.length > 0 ? 'Choose product' : 'Search first')"
                            :disabled="item.isSearching || (item.searchResults.length === 0 && item.selectedProductIndex !== 'custom')"
                            @ionChange="handleProductSelection(index, $event.detail.value)"
                          >
                            <ion-select-option value="custom">-- Custom Product --</ion-select-option>
                            <ion-select-option v-for="(prod, pIdx) in item.searchResults" :key="pIdx" :value="pIdx">
                              {{ prod.productName }} ({{ prod.internalName || prod.productId }})
                            </ion-select-option>
                          </ion-select>
                        </ion-item>
                      </ion-col>
                      <ion-col size="12" size-md="3" v-if="item.selectedProductIndex === 'custom'">
                        <ion-row>
                          <ion-col size="6">
                            <ion-item lines="none" class="input-item">
                              <ion-input
                                label="Custom SKU"
                                label-placement="stacked"
                                v-model="item.sku"
                                placeholder="SKU"
                                required
                              />
                            </ion-item>
                          </ion-col>
                          <ion-col size="6">
                            <ion-item lines="none" class="input-item">
                              <ion-input
                                label="Custom Title"
                                label-placement="stacked"
                                v-model="item.title"
                                placeholder="Title"
                                required
                              />
                            </ion-item>
                          </ion-col>
                        </ion-row>
                      </ion-col>
                      <ion-col size="4" size-md="1">
                        <ion-item lines="none" class="input-item">
                          <ion-input
                            label="Qty"
                            label-placement="stacked"
                            type="number"
                            min="1"
                            v-model.number="item.quantity"
                            required
                          />
                        </ion-item>
                      </ion-col>
                      <ion-col size="5" size-md="2">
                        <ion-item lines="none" class="input-item">
                          <ion-input
                            label="Price"
                            label-placement="stacked"
                            type="number"
                            min="0"
                            step="0.01"
                            v-model.number="item.price"
                            required
                          />
                        </ion-item>
                      </ion-col>
                      <ion-col size="3" size-md="3" class="ion-text-end action-col">
                        <div class="item-subtotal-text">
                          {{ formatMoney(item.quantity * item.price) }}
                        </div>
                        <ion-button fill="clear" color="danger" @click="removeLineItem(index)">
                          <ion-icon slot="icon-only" :icon="trashOutline" />
                        </ion-button>
                      </ion-col>
                    </ion-row>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Order Notes Section -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  <ion-icon :icon="createOutline" class="card-icon" />
                  {{ translate("Order Notes") }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-item lines="none" class="input-item">
                  <ion-textarea
                    label="Customer Note / Comments"
                    label-placement="stacked"
                    v-model="orderForm.note"
                    placeholder="Enter any instructions or details about the order..."
                    rows="3"
                  />
                </ion-item>
              </ion-card-content>
            </ion-card>
          </ion-col>

          <!-- Right Column: Order Summary & Action -->
          <ion-col size="12" size-lg="4">
            <div class="summary-sticky">
              <ion-card class="summary-card">
                <ion-card-header>
                  <ion-card-title>{{ translate("Order Summary") }}</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <ion-list lines="none">
                    <ion-item>
                      <ion-label>{{ translate("Subtotal") }}</ion-label>
                      <ion-note slot="end">{{ formatMoney(totals.subtotal) }}</ion-note>
                    </ion-item>
                    <ion-item>
                      <ion-label>
                        {{ translate("Estimated Tax") }}
                        <p class="small-text">(8.0%)</p>
                      </ion-label>
                      <ion-note slot="end">{{ formatMoney(totals.tax) }}</ion-note>
                    </ion-item>
                    <ion-item>
                      <ion-label>
                        {{ translate("Shipping") }}
                        <p v-if="totals.subtotal >= 150" class="free-shipping-note">Free shipping applied!</p>
                      </ion-label>
                      <ion-note slot="end">{{ formatMoney(totals.shipping) }}</ion-note>
                    </ion-item>
                    <div class="divider"></div>
                    <ion-item class="total-row">
                      <ion-label><strong>{{ translate("Total") }}</strong></ion-label>
                      <ion-note slot="end" color="dark"><strong>{{ formatMoney(totals.total) }}</strong></ion-note>
                    </ion-item>
                  </ion-list>

                  <div class="ion-padding-top">
                    <ion-button expand="block" color="primary" @click="submitOrder">
                      <ion-icon slot="start" :icon="checkmarkCircleOutline" />
                      {{ translate("Submit Order") }}
                    </ion-button>
                    <ion-button expand="block" fill="clear" color="medium" @click="resetForm">
                      {{ translate("Reset Form") }}
                    </ion-button>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Shopify Result Preview Modal -->
      <ion-modal ref="payloadModal" :is-open="isModalOpen" @didDismiss="isModalOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="isModalOpen = false">
                <ion-icon :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
            <ion-title>{{ translate("Shopify Order Created") }}</ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <ion-card class="payload-preview-card">
            <ion-card-header>
              <ion-card-subtitle>{{ translate("Shopify API Response Status") }}</ion-card-subtitle>
              <ion-card-title>{{ translate("Order Confirmation") }}</ion-card-title>
            </ion-card-header>
            <ion-card-content class="ion-text-center">
              <ion-icon :icon="checkmarkCircleOutline" color="success" style="font-size: 64px; margin-bottom: 16px;" />
              <h2><strong>Order: {{ orderResponseData.shopifyOrderName }}</strong></h2>
              <p class="ion-margin-bottom">
                {{ translate("Shopify GID:") }} <code>{{ orderResponseData.shopifyOrderId }}</code>
              </p>
              <p>
                {{ translate("The sales order has been successfully transmitted and registered on Shopify.") }}
              </p>
            </ion-card-content>
          </ion-card>
          <div class="ion-padding">
            <ion-button expand="block" color="success" @click="isModalOpen = false">
              {{ translate("Done") }}
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonModal,
  IonNote,
  IonPage,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  IonRippleEffect,
  IonSpinner,
  toastController
} from '@ionic/vue';
import {
  addOutline,
  checkmarkCircleOutline,
  closeOutline,
  createOutline,
  cubeOutline,
  locationOutline,
  personOutline,
  storefrontOutline,
  trashOutline,
  searchOutline
} from 'ionicons/icons';
import { api, translate, useSolrSearch } from '@common';
import { useUserStore } from '@/store/user';
import emitter from '@/event-bus';
import { searchShopifyCustomers, createShopifyCustomer, getShopifyShops } from '@/services/customer';

const { searchProducts } = useSolrSearch();

const userStore = useUserStore();


// Navigation Wizard Flow state
const isBrandSelected = ref(false);

// Product Store options populated from User Store with fallback
const productStoresList = computed(() => {
  const stores = userStore.getUserProfile?.stores || [];
  if (stores.length > 0) return stores;
  return [
    { productStoreId: 'SM_STORE', storeName: 'Steve Madden Retail' },
    { productStoreId: 'DV_STORE', storeName: 'Dolce Vita Store' },
    { productStoreId: 'SP_STORE', storeName: 'Superga Ecom' }
  ];
});

// Mock Customer list with brand specific store mapping
const mockCustomers = [
  {
    id: 'cust-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 555-0101',
    productStoreId: 'SM_STORE',
    address: {
      address1: '123 Fashion Ave',
      address2: 'Suite 4B',
      city: 'New York',
      province: 'NY',
      zip: '10001',
      country: 'United States'
    }
  },
  {
    id: 'cust-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1 555-0102',
    productStoreId: 'SM_STORE',
    address: {
      address1: '456 Broadway',
      address2: '',
      city: 'Los Angeles',
      province: 'CA',
      zip: '90012',
      country: 'United States'
    }
  },
  {
    id: 'cust-3',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@example.com',
    phone: '+1 555-0103',
    productStoreId: 'DV_STORE',
    address: {
      address1: '789 Oak Lane',
      address2: 'Apt 12',
      city: 'Miami',
      province: 'FL',
      zip: '33101',
      country: 'United States'
    }
  },
  {
    id: 'cust-4',
    firstName: 'Alice',
    lastName: 'Williams',
    email: 'alice.williams@example.com',
    phone: '+1 555-0104',
    productStoreId: 'SP_STORE',
    address: {
      address1: '321 Maple Rd',
      address2: '',
      city: 'Chicago',
      province: 'IL',
      zip: '60601',
      country: 'United States'
    }
  }
];



// Form state
const customerMode = ref('existing'); // 'existing' or 'new'
const selectedCustomerId = ref('');
const customerSearchQuery = ref('');
const isSearching = ref(false);
const customersList = ref<any[]>([]);
const shopsList = ref<any[]>([]);

const orderForm = ref({
  shopId: '',
  productStoreId: '',
  customer: {
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
    country: 'United States',
    phone: ''
  },
  lineItems: [] as Array<{
    selectedProductIndex: number | string;
    productId?: string;
    sku: string;
    title: string;
    quantity: number;
    price: number;
    searchQuery: string;
    isSearching: boolean;
    searchResults: any[];
  }>,
  note: ''
});

onMounted(async () => {
  try {
    shopsList.value = await getShopifyShops();
  } catch (err: any) {
    presentToast(translate("Failed to load Shopify shops: " + (err.message || err)));
  }
});

// Modal state
const isModalOpen = ref(false);
const orderResponseData = ref({
  shopifyOrderId: '',
  shopifyOrderName: ''
});

// Wizard navigation methods
function selectShop(shopId: string, storeId: string) {
  orderForm.value.shopId = shopId;
  orderForm.value.productStoreId = storeId;
  isBrandSelected.value = true;
}

function changeBrand() {
  isBrandSelected.value = false;
  resetForm();
}

function getActiveShopName(shopId: string) {
  const shop = shopsList.value.find(s => s.shopId === shopId);
  return shop ? (shop.name || shop.shopId) : shopId;
}

// Watchers / handlers
function handleCustomerModeChange() {
  selectedCustomerId.value = '';
  customerSearchQuery.value = '';
  customersList.value = [];
  orderForm.value.customer = { firstName: '', lastName: '', email: '', phone: '' };
  orderForm.value.shippingAddress = {
    address1: '',
    address2: '',
    city: '',
    province: '',
    zip: '',
    country: 'United States',
    phone: ''
  };
}

async function handleCreateCustomer() {
  const form = orderForm.value;

  if (!form.shopId) {
    presentToast(translate("Please select a Shopify Shop first."));
    return;
  }
  if (!form.customer.firstName || !form.customer.lastName || !form.customer.email) {
    presentToast(translate("Please enter first name, last name, and email to create a customer."));
    return;
  }

  emitter.emit('presentLoader', { message: 'Creating customer on Shopify...' });
  try {
    const res = await createShopifyCustomer(form.shopId, {
      email: form.customer.email,
      phoneNumber: form.customer.phone || undefined,
      firstName: form.customer.firstName,
      lastName: form.customer.lastName || undefined
    });
    emitter.emit('dismissLoader');

    if (res.hasShopifyError === 'Y') {
      presentToast(translate("Shopify Error: " + res.shopifyErrorMessage), "danger");
      return;
    }
    if (!res.customerId) {
      presentToast(translate("Failed to create customer on Shopify: no customerId returned."), "danger");
      return;
    }

    const newCustomerId = res.customerId;
    const newCust = {
      id: newCustomerId,
      firstName: form.customer.firstName,
      lastName: form.customer.lastName,
      email: form.customer.email,
      phone: form.customer.phone || '',
      address: { ...form.shippingAddress }
    };

    // Add to current customersList so selection works
    customersList.value.push(newCust);
    selectedCustomerId.value = newCustomerId;
    
    // Switch to existing mode to display summary details
    customerMode.value = 'existing';
    presentToast(translate("Customer created and selected successfully!"), "success");
  } catch (err: any) {
    emitter.emit('dismissLoader');
    presentToast(translate("Failed to create customer on Shopify: " + (err.message || err)), "danger");
  }
}

async function searchCustomers() {
  const query = customerSearchQuery.value.trim();
  if (!query) {
    presentToast(translate("Please enter email, phone or name to search."));
    return;
  }
  if (!orderForm.value.shopId) {
    presentToast(translate("Please select a Shopify Shop first."));
    return;
  }

  isSearching.value = true;
  try {
    customersList.value = await searchShopifyCustomers(orderForm.value.shopId, query);
    if (customersList.value.length === 0) {
      presentToast(translate("No customers found matching the criteria."), "warning");
    }
  } catch (err: any) {
    presentToast(translate("Failed to search customers: " + (err.message || err)));
  } finally {
    isSearching.value = false;
  }
}

function handleCustomerSelection(event: any) {
  const customerId = event.detail.value;
  const customer = customersList.value.find(c => c.id === customerId);
  if (customer) {
    orderForm.value.customer = {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || ''
    };
    if (customer.address) {
      orderForm.value.shippingAddress = {
        address1: customer.address.address1 || '',
        address2: customer.address.address2 || '',
        city: customer.address.city || '',
        province: customer.address.province || '',
        zip: customer.address.zip || '',
        country: customer.address.country || 'United States',
        phone: customer.address.phone || ''
      };
    } else {
      orderForm.value.shippingAddress = {
        address1: '',
        address2: '',
        city: '',
        province: '',
        zip: '',
        country: 'United States',
        phone: ''
      };
    }
  }
}

// Line Items management
function addLineItem() {
  orderForm.value.lineItems.push({
    selectedProductIndex: '',
    productId: '',
    sku: '',
    title: '',
    quantity: 1,
    price: 0,
    searchQuery: '',
    isSearching: false,
    searchResults: []
  });
}

function removeLineItem(index: number) {
  orderForm.value.lineItems.splice(index, 1);
}

async function searchRowProducts(index: number) {
  const item = orderForm.value.lineItems[index];
  const query = item.searchQuery ? item.searchQuery.trim() : '';
  if (!query) {
    await presentToast(translate("Please enter a SKU or product name to search."));
    return;
  }
  if (!orderForm.value.productStoreId) {
    await presentToast(translate("Please select a Shopify Shop first."));
    return;
  }

  item.isSearching = true;
  try {
    const res = await searchProducts({
      keyword: query,
      filters: {
        productStoreIds_s: { value: orderForm.value.productStoreId }
      }
    });
    item.searchResults = res.products || [];
    if (item.searchResults.length === 0) {
      await presentToast(translate("No products found matching the criteria for this shop."), "warning");
    }
  } catch (err: any) {
    await presentToast(translate("Failed to search products: " + (err.message || err)));
  } finally {
    item.isSearching = false;
  }
}

function getProductPrice(product: any): number {
  if (product.price !== undefined) return product.price;
  
  // Look for any key containing '_price' in product doc
  const priceKey = Object.keys(product).find(key => key.endsWith('_price') || key.toLowerCase().includes('price'));
  if (priceKey && product[priceKey]) {
    const val = parseFloat(product[priceKey]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

function handleProductSelection(index: number, selection: number | string) {
  const item = orderForm.value.lineItems[index];
  if (selection === 'custom') {
    item.productId = '';
    item.sku = '';
    item.title = '';
    item.price = 0;
  } else if (typeof selection === 'number' && item.searchResults[selection]) {
    const product = item.searchResults[selection];
    item.productId = product.productId;
    item.sku = product.internalName || product.productId;
    item.title = product.productName || product.productId;
    item.price = getProductPrice(product);
  }
}

// Pricing calculations
const totals = computed(() => {
  const subtotal = orderForm.value.lineItems.reduce((acc, item) => {
    return acc + (item.quantity * item.price);
  }, 0);

  const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
  
  // Free shipping above $150
  let shipping = 0;
  if (subtotal > 0) {
    shipping = subtotal >= 150 ? 0 : 10;
  }

  const total = Math.round((subtotal + tax + shipping) * 100) / 100;

  return { subtotal, tax, shipping, total };
});

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

async function presentToast(message: string, color: string = 'danger') {
  const toast = await toastController.create({
    message,
    duration: 3000,
    color,
    position: 'bottom'
  });
  await toast.present();
}

function resetForm() {
  customerMode.value = 'existing';
  selectedCustomerId.value = '';
  orderForm.value = {
    shopId: orderForm.value.shopId || '',
    productStoreId: orderForm.value.productStoreId || '',
    customer: {
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
      country: 'United States',
      phone: ''
    },
    lineItems: [],
    note: ''
  };
}

// Validation & API Submission
async function submitOrder() {
  const form = orderForm.value;

  // 1. Config Validation
  if (!form.shopId) {
    presentToast(translate("Please select a Shop."));
    return;
  }

  // 2. Customer Validation
  if (!form.customer.email || !form.customer.firstName || !form.customer.lastName) {
    presentToast(translate("Please complete all required customer information fields."));
    return;
  }

  // 3. Shipping Address Validation
  const addr = form.shippingAddress;
  if (!addr.address1 || !addr.city || !addr.province || !addr.zip || !addr.country) {
    presentToast(translate("Please fill in all shipping address fields."));
    return;
  }

  // 4. Line Items Validation
  if (form.lineItems.length === 0) {
    presentToast(translate("Please add at least one line item to the order."));
    return;
  }

  for (let i = 0; i < form.lineItems.length; i++) {
    const item = form.lineItems[i];
    if (!item.sku || !item.title) {
      presentToast(translate(`Line item ${i + 1} has missing SKU or Title.`));
      return;
    }
    if (item.quantity <= 0) {
      presentToast(translate(`Line item ${i + 1} must have a quantity greater than 0.`));
      return;
    }
    if (item.price < 0) {
      presentToast(translate(`Line item ${i + 1} cannot have a negative price.`));
      return;
    }
  }

  // 5. Create Customer if Mode is "new"
  let shopifyCustomerId = '';
  if (customerMode.value === 'new') {
    emitter.emit('presentLoader', { message: 'Creating customer on Shopify...' });
    try {
      const res = await createShopifyCustomer(form.shopId, {
        email: form.customer.email,
        phoneNumber: form.customer.phone || undefined,
        firstName: form.customer.firstName,
        lastName: form.customer.lastName || undefined
      });
      emitter.emit('dismissLoader');
      
      if (res.hasShopifyError === 'Y') {
        presentToast(translate("Shopify Error: " + res.shopifyErrorMessage));
        return;
      }
      if (!res.customerId) {
        presentToast(translate("Failed to create customer on Shopify: no customerId returned."));
        return;
      }
      shopifyCustomerId = res.customerId;
    } catch (err: any) {
      emitter.emit('dismissLoader');
      presentToast(translate("Failed to create customer on Shopify: " + (err.message || err)));
      return;
    }
  } else {
    shopifyCustomerId = selectedCustomerId.value;
  }

  // 6. Build API Payload
  const payload = {
    shopId: form.shopId,
    shopifyCustomerId: shopifyCustomerId,
    currencyCode: 'USD',
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
    note: form.note
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
      await presentToast(translate("Shopify Order Created Successfully!"), "success");
      isModalOpen.value = true;
      resetForm();
    } else {
      throw new Error("Invalid response schema from order API");
    }
  } catch (err: any) {
    emitter.emit('dismissLoader');
    const errMsg = err?.message || 'Error occurred while creating Shopify order.';
    await presentToast(translate(errMsg), "danger");
  }
}
</script>

<style scoped>
.brand-select-container {
  max-width: 800px;
  margin: 40px auto;
}

.brand-select-header {
  margin-bottom: 24px;
}

.brand-card {
  border: 1px solid var(--ion-color-light);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.brand-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.brand-card-icon {
  font-size: 48px;
  color: var(--ion-color-primary);
  margin-bottom: 12px;
}

.active-brand-card {
  border: 1px solid var(--ion-color-primary);
  margin-bottom: 16px;
}

.active-brand-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-info-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.active-brand-icon {
  font-size: 28px;
  color: var(--ion-color-primary);
}

.card-icon {
  margin-right: 8px;
  vertical-align: middle;
  color: var(--ion-color-primary);
}

.input-item {
  background: var(--ion-background-color, #fff);
  border: 1px solid var(--ion-color-light, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
}

.line-items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-items-state {
  color: var(--ion-color-medium);
  border: 2px dashed var(--ion-color-light);
  border-radius: 8px;
  margin: 16px 0;
}

.item-row {
  border-bottom: 1px solid var(--ion-color-light);
  padding-bottom: 12px;
}

.item-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.action-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
}

.item-subtotal-text {
  font-size: 14px;
  font-weight: bold;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.summary-sticky {
  position: sticky;
  top: 16px;
}

.summary-card {
  border: 1px solid var(--ion-color-primary-tint, #dcdcdc);
}

.free-shipping-note {
  font-size: 11px;
  color: var(--ion-color-success);
  margin: 0;
  margin-top: 4px;
}

.divider {
  height: 1px;
  background-color: var(--ion-color-light);
  margin: 12px 16px;
}

.total-row {
  font-size: 18px;
}

.small-text {
  font-size: 11px;
  color: var(--ion-color-medium);
  display: inline;
}

.payload-preview-card {
  border: 1px solid var(--ion-color-light);
}

/* Flex layout vertical center helpers */
.align-items-center {
  align-items: center;
}

/* Ripple parent utility */
.ripple-parent {
  position: relative;
  overflow: hidden;
}

.selected-customer-summary {
  border-top: 1px dashed var(--ion-color-light);
  margin-top: 16px;
}

.summary-details p {
  margin: 6px 0;
  font-size: 14px;
}

.summary-details h4 {
  font-size: 15px;
  color: var(--ion-color-dark);
}

.address-text {
  color: var(--ion-color-medium);
  line-height: 1.5;
}
</style>
