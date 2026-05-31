<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Hold</ion-title>
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

      <div class="hold-orders-list">
        <ion-card v-for="order in heldOrders" :key="order.id">
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
              <ion-list lines="none">
                <ion-item>
                  <ion-label>
                    {{ order.taskName }}
                    <p>{{ order.taskPurpose }}</p>
                  </ion-label>
                  <ion-note slot="end" v-if="order.dueDate">Due: {{ order.dueDate }}</ion-note>
                </ion-item>
                <ion-item v-if="order.taskNotes">
                  <ion-label>
                    <p>Notes</p>
                    {{ order.taskNotes }}
                  </ion-label>
                </ion-item>
              </ion-list>

              <ion-list lines="none" class="ion-margin-top">
                <ion-item>
                  <ion-label>
                    {{ order.assigneeName || 'Unassigned' }}
                    <p>Assignee</p>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>
                    {{ order.reporterName || 'System' }}
                    <p>Reporter</p>
                  </ion-label>
                </ion-item>
              </ion-list>

              <ion-list lines="none" class="ion-margin-top">
                <ion-item>
                  <ion-textarea
                    label="Resolution comment"
                    label-placement="stacked"
                    placeholder="Enter resolution comment..."
                    v-model="order.resolutionComment"
                  />
                </ion-item>
              </ion-list>
            </div>

            <!-- Actions -->
            <div class="actions border-top ion-margin-top ion-padding-top">
              <ion-buttons>
                <ion-button fill="solid" color="primary">Resolve task</ion-button>
                <ion-button fill="outline" color="secondary" :router-link="'/order/' + order.id">View order</ion-button>
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
  IonTextarea
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

const heldOrders = ref([
  {
    id: '10002',
    orderName: 'Order #10002',
    orderDate: '2026-05-30 15:10',
    workEffortId: 'WE-9922',
    orderTotal: 210.00,
    customerName: 'Alice Johnson',
    phone: '+1 555-4321',
    email: 'alice.j@example.com',
    selected: false,
    taskName: 'Manual Fraud Review',
    taskPurpose: 'Review potential fraud markers due to high value first-time order.',
    dueDate: '2026-06-01',
    taskNotes: 'Customer IP location does not match billing zip code. Need manual callback or validation.',
    assigneeName: 'Bob Smith',
    reporterName: 'Fraud System',
    resolutionComment: ''
  }
]);

watch(selectAll, (val) => {
  heldOrders.value.forEach(order => {
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
