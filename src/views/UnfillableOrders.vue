<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Unfillable orders</ion-title>
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

      <div class="unfillable-parking-list">
        <!-- Loop through ship groups in unfillable parking (mocked / placeholder) -->
        <ion-card v-for="shipGroup in unfillableParking" :key="shipGroup.id">
          <ion-card-header>
            <div class="shipgroup-header-row">
              <ion-card-title>{{ shipGroup.facilityName || 'Facility Name' }}</ion-card-title>
              <ion-button fill="clear" size="small" class="expand-btn">
                <ion-icon :icon="chevronDown" />
              </ion-button>
            </div>
          </ion-card-header>

          <ion-card-content>
            <!-- Grouped items -->
            <ion-list lines="none">
              <ion-item v-for="item in shipGroup.items" :key="item.id">
                <ion-label>
                  {{ item.name }}
                  <p>SKU: {{ item.sku }} · External ID: {{ item.externalId }}</p>
                </ion-label>
                <ion-note slot="end">{{ item.quantity }} units</ion-note>
              </ion-item>
            </ion-list>

            <!-- Contact Details -->
            <div class="contact-details border-top">
              <ion-item lines="none">
                <ion-icon slot="start" :icon="personOutline" />
                <ion-label>
                  {{ shipGroup.customerName }}
                  <p>Customer</p>
                </ion-label>
                <ion-buttons slot="end">
                  <ion-button fill="clear" :href="'tel:' + shipGroup.phone">
                    <ion-icon slot="icon-only" :icon="callOutline" />
                  </ion-button>
                  <ion-button fill="clear" :href="'mailto:' + shipGroup.email">
                    <ion-icon slot="icon-only" :icon="mailOutline" />
                  </ion-button>
                </ion-buttons>
              </ion-item>
              
              <ion-item lines="none" v-if="shipGroup.phone">
                <ion-label>
                  <p>Telecom contact</p>
                  {{ shipGroup.phone }}
                </ion-label>
              </ion-item>

              <ion-item lines="none" v-if="shipGroup.email">
                <ion-label>
                  <p>Email contact</p>
                  {{ shipGroup.email }}
                </ion-label>
              </ion-item>

              <ion-item lines="none">
                <ion-label>
                  <p>Order facility change routing</p>
                  {{ shipGroup.routingFacility || 'Dallas DC' }}
                </ion-label>
              </ion-item>

              <ion-item lines="none">
                <ion-label>
                  <p>Routing facility change description</p>
                  {{ shipGroup.routingDesc || 'Dallas DC has matching stock. Request routing change.' }}
                </ion-label>
              </ion-item>
            </div>

            <!-- Resolution -->
            <div class="resolution ion-margin-top ion-padding-top border-top">
              <div class="before">
                <ion-list lines="none">
                  <ion-list-header>
                    <ion-label>Ordered Items</ion-label>
                  </ion-list-header>
                  <ion-item v-for="item in shipGroup.items" :key="item.id">
                    <ion-label>
                      {{ item.name }}
                      <p>SKU: {{ item.sku }}</p>
                    </ion-label>
                    <ion-note slot="end">{{ item.quantity }} x {{ money(item.price) }}</ion-note>
                  </ion-item>
                  <ion-item class="total-item">
                    <ion-label>Original order total</ion-label>
                    <ion-note slot="end" color="dark">{{ money(shipGroup.originalTotal) }}</ion-note>
                  </ion-item>
                </ion-list>

                <ion-list lines="none" class="ion-margin-top">
                  <ion-list-header>
                    <ion-label>Suggested Items</ion-label>
                  </ion-list-header>
                  <ion-item v-for="suggested in shipGroup.suggestedOutcome" :key="suggested.id">
                    <ion-label>
                      {{ suggested.name }}
                      <p>SKU: {{ suggested.sku }} (Suggested Substitute)</p>
                    </ion-label>
                    <ion-note slot="end">{{ suggested.quantity }} x {{ money(suggested.price) }}</ion-note>
                  </ion-item>
                  <ion-item class="total-item">
                    <ion-label>New order total</ion-label>
                    <ion-note slot="end" color="dark">{{ money(shipGroup.suggestedTotal) }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-input
                      label="Suggested refund"
                      label-placement="stacked"
                      :value="money(shipGroup.availableFunds)"
                      helper-text="Total available funds for refund"
                      readonly
                    />
                  </ion-item>
                </ion-list>
              </div>
            </div>

            <!-- Actions -->
            <div class="actions ion-margin-top ion-padding-top border-top">
              <ion-buttons>
                <ion-button fill="solid" color="primary">Release updated order</ion-button>
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
import { ref } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonCardTitle,
  IonIcon,
  IonButton,
  IonInput,
  IonCheckbox,
  IonSelect,
  IonSelectOption
} from '@ionic/vue';
import {
  chevronDown,
  callOutline,
  mailOutline,
  personOutline
} from 'ionicons/icons';
import SearchFilterCard from '@/components/SearchFilterCard.vue';

const searchQuery = ref('');
const swappable = ref(false);
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('All');

// Mock data structure to fulfill the template requirements
const unfillableParking = ref([
  {
    id: 'sg-1',
    facilityName: 'Chicago Fulfillment Center (FC-02)',
    customerName: 'Alice Smith',
    phone: '+1 555-0123',
    email: 'alice.smith@example.com',
    routingFacility: 'Dallas DC (MC-04)',
    routingDesc: 'Dallas has matching stock. Request routing change to fulfill immediately.',
    originalTotal: 75.00,
    suggestedTotal: 65.00,
    availableFunds: 10.00,
    items: [
      {
        id: 'item-1',
        name: 'Matte Liquid Lipstick - Red',
        sku: 'LIP-MAT-RED',
        externalId: 'ext-balm-1',
        quantity: 2,
        price: 25.00
      },
      {
        id: 'item-2',
        name: 'Hydrating Face Cream',
        sku: 'CRM-HYD-50',
        externalId: 'ext-cream-2',
        quantity: 1,
        price: 25.00
      }
    ],
    suggestedOutcome: [
      {
        id: 'sug-1',
        name: 'Glossy Liquid Lipstick - Red',
        sku: 'LIP-GLO-RED',
        quantity: 2,
        price: 20.00
      },
      {
        id: 'sug-2',
        name: 'Hydrating Face Cream',
        sku: 'CRM-HYD-50',
        quantity: 1,
        price: 25.00
      }
    ]
  }
]);

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
.shipgroup-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.border-top {
  border-top: 1px solid var(--ion-color-light);
}

.total-item {
  font-weight: bold;
}

.expand-btn {
  margin: 0;
}
</style>
