<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Bad address</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        placeholder="Search unfillable orders..."
        @clear="clearFilters"
      >
        <ion-item lines="none">
          <ion-checkbox v-model="swappable" justify="start" label-placement="end">
            Swappable
          </ion-checkbox>
        </ion-item>
        <ion-input v-model="dateAfter" label="Date after" label-placement="stacked" type="date" />
        <ion-input v-model="dateBefore" label="Date before" label-placement="stacked" type="date" />
        <ion-select v-model="orderChannel" label="Channel" label-placement="stacked" interface="popover">
          <ion-select-option value="All">All channels</ion-select-option>
          <ion-select-option value="shopify">Shopify</ion-select-option>
          <ion-select-option value="amazon">Amazon</ion-select-option>
          <ion-select-option value="retail">Retail Store</ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <ion-item lines="none" class="select-all-item">
        <ion-checkbox slot="start" v-model="selectAll" />
        <ion-label>Select all</ion-label>
      </ion-item>

      <div class="bad-address-list">
        <ion-card v-for="order in badAddressOrders" :key="order.id">
          <ion-item lines="none">
            <ion-checkbox slot="start" v-model="order.selected" />
            <ion-label>
              {{ order.orderName }}
              <p>{{ order.orderDate }}</p>
            </ion-label>
            <ion-chip slot="end" outline color="medium">
              Task: {{ order.workEffortId }}
            </ion-chip>
            <ion-note slot="end" color="dark">{{ money(order.orderTotal) }}</ion-note>
          </ion-item>

          <ion-card-content>
            <!-- Contact Details -->
            <div class="contact-details border-top ion-padding-top">
              <ion-item lines="none">
                <ion-icon slot="start" :icon="personOutline" />
                <ion-label>
                  {{ order.customerName }}
                  <p>Customer</p>
                </ion-label>
                <ion-buttons slot="end">
                  <ion-button fill="clear" :href="'tel:' + order.phone">
                    <ion-icon slot="icon-only" :icon="callOutline" />
                  </ion-button>
                  <ion-button fill="clear" :href="'mailto:' + order.email">
                    <ion-icon slot="icon-only" :icon="mailOutline" />
                  </ion-button>
                </ion-buttons>
              </ion-item>
              
              <ion-item lines="none" v-if="order.phone">
                <ion-label>
                  <p>Telecom contact</p>
                  {{ order.phone }}
                </ion-label>
              </ion-item>

              <ion-item lines="none" v-if="order.email">
                <ion-label>
                  <p>Email contact</p>
                  {{ order.email }}
                </ion-label>
              </ion-item>
            </div>

            <!-- Task Details -->
            <div class="task-details border-top ion-padding-top">
              <ion-radio-group v-model="order.selectedAddressType">
                <ion-list lines="none">
                  <ion-list-header>
                    <ion-label>Original Address</ion-label>
                    <ion-radio slot="end" value="original" />
                  </ion-list-header>
                  <ion-item v-for="(val, key) in order.originalAddress" :key="key">
                    <ion-label>
                      <p class="ion-text-capitalize">{{ key }}</p>
                      {{ val }}
                    </ion-label>
                  </ion-item>
                </ion-list>

                <ion-list lines="none" class="ion-margin-top">
                  <ion-list-header>
                    <ion-label>Suggested Address</ion-label>
                    <ion-radio slot="end" value="suggested" />
                  </ion-list-header>
                  <ion-item v-for="(val, key) in order.suggestedAddress" :key="key">
                    <ion-label>
                      <p class="ion-text-capitalize">{{ key }}</p>
                      {{ val }}
                    </ion-label>
                  </ion-item>
                </ion-list>
              </ion-radio-group>
            </div>

            <!-- Actions -->
            <div class="actions border-top ion-margin-top ion-padding-top">
              <ion-buttons>
                <ion-button fill="solid" color="primary">Save and release hold</ion-button>
                <ion-button fill="outline" color="danger">Cancel order</ion-button>
                <ion-button fill="outline" color="medium">Park</ion-button>
              </ion-buttons>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonChip,
  IonRadioGroup,
  IonRadio
} from '@ionic/vue';
import {
  personOutline,
  callOutline,
  mailOutline
} from 'ionicons/icons';
import SearchFilterCard from '@/components/SearchFilterCard.vue';

const searchQuery = ref('');
const swappable = ref(false);
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('All');
const selectAll = ref(false);

const badAddressOrders = ref([
  {
    id: '10001',
    orderName: 'Order #10001',
    orderDate: '2026-05-30 14:22',
    workEffortId: 'WE-9921',
    orderTotal: 124.50,
    customerName: 'Jane Doe',
    phone: '+1 555-9876',
    email: 'jane.doe@example.com',
    selected: false,
    selectedAddressType: 'suggested',
    originalAddress: {
      address1: '125 Makret St',
      city: 'San Francisco',
      state: 'CA',
      zip: '9410'
    },
    suggestedAddress: {
      address1: '125 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105'
    }
  }
]);

watch(selectAll, (val) => {
  badAddressOrders.value.forEach(order => {
    order.selected = val;
  });
});

function clearFilters() {
  searchQuery.value = '';
  swappable.value = false;
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = 'All';
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
</script>

<style scoped>
.border-top {
  border-top: 1px solid var(--ion-color-light);
}
</style>
