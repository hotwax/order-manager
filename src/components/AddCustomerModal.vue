<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button data-testid="viewmore-close-modal" @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Find Customer") }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-segment v-model="selectedSection" @ionChange="segmentChange($event.target.value)">
        <ion-segment-button value="search" content-id="search">{{ translate("Search") }}</ion-segment-button>
        <ion-segment-button value="create" content-id="create">{{ translate("Create") }}</ion-segment-button>
      </ion-segment>
      <ion-searchbar v-if="selectedSection === 'search'" :value="queryString" :placeholder="translate('Search')" @keyup.enter="queryString = $event.target.value; searchCustomers()"/>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-segment-view>
      <ion-segment-content id="search">
        <ion-item v-for="customer in customers" :key="customer.id" button @click="selectCustomer(customer)">
          <ion-label>
            {{ customer.firstName }} {{ customer.lastName }}
            <p>{{ customer.id }}</p>
            <p>{{ customer.email }}</p>
          </ion-label>
        </ion-item>
        <p v-if="!queryString.trim()" class="empty-state">{{ translate("Search for a customer") }}</p>
        <p v-if="queryString.trim() && !customers?.length" class="empty-state">
          {{ translate("Customer not found") }}<br />
          {{ translate("Create a new one before proceeding.") }}
        </p>
      </ion-segment-content>
      <ion-segment-content id="create">
        <div v-if="step === 'info'">
          <ion-item>
            <ion-input label="First Name" v-model="customerForm.firstName" />
          </ion-item>
          <ion-item>
            <ion-input label="Last Name" v-model="customerForm.lastName" />
          </ion-item>
          <ion-item>
            <ion-input label="Phone" v-model="customerForm.phone" />
          </ion-item>
          <ion-item>
            <ion-input label="Email" v-model="customerForm.email" />
          </ion-item>
        </div>
        <div v-if="step === 'shipping'">
          <ion-item>
            <ion-input label="Country" v-model="customerForm.address.country" />
          </ion-item>
          <ion-item>
            <ion-input label="Address line 1" v-model="customerForm.address.address1" />
          </ion-item>
          <ion-item>
            <ion-input label="Address line 2" v-model="customerForm.address.address2" />
          </ion-item>
          <ion-item>
            <ion-input label="City" v-model="customerForm.address.city" />
          </ion-item>
          <ion-item>
            <ion-input label="Province" v-model="customerForm.address.province" />
          </ion-item>
          <ion-item>
            <ion-input label="Zip" v-model="customerForm.address.zip" />
          </ion-item>
          <ion-item>
            <ion-input label="Phone" v-model="customerForm.address.phone" />
          </ion-item>
          <ion-item>
            <ion-input label="Email" v-model="customerForm.address.email" />
          </ion-item>
        </div>
      </ion-segment-content>
      <!-- <ion-fab horizontal="end" vertical="bottom" v-if="selectedSection === 'create' && step === 'info'">
        <ion-fab-button @click="step = 'shipping'">
          <ion-icon :icon="arrowForwardOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab> -->
      <ion-fab horizontal="end" vertical="bottom" v-if="selectedSection === 'create'">
        <ion-fab-button @click="handleCreateCustomer">
          <ion-icon :icon="saveOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-segment-view>
  </ion-content>
</template>

<script setup lang="ts">
import { showToast } from '@/utils';
import { emitter, translate } from '@common';
import { IonInput, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSegment, IonSegmentButton, IonSegmentView, IonSegmentContent, IonItem, IonLabel, IonSearchbar, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from "ionicons/icons";
import { ref } from 'vue';
import { searchShopifyCustomers, createShopifyCustomer } from '@/services/customer';

const queryString = ref("")
const selectedSection = ref("search")

const props = defineProps(["shopId"])

const customers = ref()
const customerForm = ref({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: {
    address1: "",
    address2: "",
    city: "",
    province: "",
    country: "",
    zip: "",
    phone: "",
    email: ""
  }
})
const step = ref("info")

function segmentChange(value: string) {
  selectedSection.value = value
}

function closeModal() {
  modalController.dismiss()
}

async function searchCustomers() {
  const query = queryString.value.trim();
  if (!query) {
    showToast(translate("Please enter email, phone or name to search."));
    return;
  }
  if (!props.shopId) {
    showToast(translate("Please select a Shopify Shop first."));
    return;
  }

  try {
    customers.value = await searchShopifyCustomers(props.shopId, query);
  } catch (err: any) {
    showToast(translate("Failed to search customers: " + (err.message || err)));
  }
}

async function handleCreateCustomer() {
  if (!props.shopId) {
    showToast(translate("Please select a Shopify Shop first."));
    return;
  }
  if (!customerForm.value.firstName || !customerForm.value.lastName || !customerForm.value.email) {
    showToast(translate("Please enter first name, last name, and email to create a customer."));
    return;
  }

  emitter.emit('presentLoader', { message: 'Creating customer...' });
  try {
    const res = await createShopifyCustomer(props.shopId, {
      email: customerForm.value.email,
      phoneNumber: customerForm.value.phone || undefined,
      firstName: customerForm.value.firstName,
      lastName: customerForm.value.lastName || undefined
    });
    emitter.emit('dismissLoader');

    if (res.hasShopifyError === 'Y') {
      showToast(translate("Shopify Error: " + res.shopifyErrorMessage));
      return;
    }
    if (!res.customerId) {
      showToast(translate("Failed to create customer on Shopify: no customerId returned."));
      return;
    }

    const newCustomerId = res.customerId;
    const newCust = {
      id: newCustomerId,
      firstName: customerForm.value.firstName,
      lastName: customerForm.value.lastName,
      email: customerForm.value.email,
      phone: customerForm.value.phone || ''
    };

    selectCustomer(newCust)
    showToast(translate("Customer created and selected successfully!"));
  } catch (err: any) {
    emitter.emit('dismissLoader');
    showToast(translate("Failed to create customer: " + (err.message || err)));
  }
}

function selectCustomer(customer: any) {
  modalController.dismiss({ customer })
}
</script>
