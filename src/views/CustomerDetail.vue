<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/customers" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Customer detail</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="loading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="customer">
      <!-- ===== Header zone: main column + timeline column ===== -->
      <div class="customer-detail-header">
        <div class="customer-detail-main">
          <!-- Identity / lifetime value -->
          <ion-card class="customer-header-card">
            <ion-item lines="none">
              <ion-label>
                <h1>{{ customer.name || 'First Last' }}</h1>
                <p>Customer since {{ customerSince || '—' }}</p>
              </ion-label>
              <div slot="end" class="lifetime-value ion-text-right">
                <p class="overline">Lifetime value</p>
                <h2>{{ lifetimeValue }}</h2>
              </div>
            </ion-item>
          </ion-card>

          <div class="customer-detail-cards">
            <!-- Contact -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>Contact</ion-card-title>
              </ion-card-header>
              <ion-list lines="full">
                <ion-item v-for="section in contactSections" :key="section.key" class="contact-section" lines="none">
                  <ion-label color="medium">{{ section.label }}</ion-label>
                  <ion-button slot="end" fill="clear" size="small">
                    Add
                    <ion-icon slot="end" :icon="addCircleOutline" />
                  </ion-button>
                </ion-item>
                <template v-for="section in contactSections" :key="`${section.key}-values`">
                  <ion-item v-for="(value, idx) in section.values" :key="`${section.key}-${idx}`">
                    <ion-label>{{ value }}</ion-label>
                    <ion-note slot="end">note</ion-note>
                  </ion-item>
                </template>
              </ion-list>
            </ion-card>

            <div class="customer-detail-secondary">
              <!-- Relationships -->
              <ion-card>
                <ion-card-header>
                  <ion-card-title>Relationships</ion-card-title>
                </ion-card-header>
                <ion-list lines="none">
                  <ion-item>
                    <ion-label>
                      <p class="overline">Party ID</p>
                      <h3>Person name</h3>
                      <p>relationshipTypeDesc</p>
                    </ion-label>
                    <ion-button slot="end" fill="outline" size="small">Expire</ion-button>
                  </ion-item>
                </ion-list>
                <div class="card-actions">
                  <ion-button fill="clear" size="small">View history</ion-button>
                  <ion-button fill="clear" size="small">Add new</ion-button>
                </div>
              </ion-card>

              <!-- Merged contacts -->
              <ion-card>
                <ion-card-header>
                  <ion-card-title>Merged contacts</ion-card-title>
                </ion-card-header>
                <ion-radio-group value="merged-1">
                  <ion-list lines="none">
                    <ion-item>
                      <ion-radio slot="start" value="merged-1" />
                      <ion-label>Item</ion-label>
                      <ion-note slot="end">note</ion-note>
                    </ion-item>
                  </ion-list>
                </ion-radio-group>
                <div class="card-actions">
                  <ion-button fill="clear" size="small">View history</ion-button>
                  <ion-button fill="clear" size="small">Merge more</ion-button>
                </div>
              </ion-card>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div class="customer-detail-timeline">
          <ion-list>
            <ion-list-header class="timeline-header">
              <ion-label>Timeline</ion-label>
              <ion-note>{{ createdAtLabel }}</ion-note>
            </ion-list-header>
            <ion-item lines="full">
              <ion-icon slot="start" :icon="pricetagOutline" color="medium" />
              <ion-label>Created by {{ customer.id || '<partyId>' }}</ion-label>
              <ion-icon slot="end" :icon="informationCircleOutline" color="medium" />
            </ion-item>
          </ion-list>
        </div>
      </div>

      <!-- ===== Segment ===== -->
      <ion-segment v-model="selectedSegment" scrollable>
        <ion-segment-button value="dashboard">
          <ion-label>Dashboard</ion-label>
        </ion-segment-button>
        <ion-segment-button value="tasks">
          <ion-label>Tasks</ion-label>
        </ion-segment-button>
        <ion-segment-button value="unfillable">
          <ion-label>Unfillable</ion-label>
        </ion-segment-button>
        <ion-segment-button value="orders">
          <ion-label>Orders</ion-label>
        </ion-segment-button>
        <ion-segment-button value="returns">
          <ion-label>Returns</ion-label>
        </ion-segment-button>
        <ion-segment-button value="comms">
          <ion-label>Comms</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- ===== Dashboard ===== -->
      <div v-if="selectedSegment === 'dashboard'">
        <!-- Open tasks -->
        <div class="section-header">
          <h2>Open tasks</h2>
          <ion-button fill="outline" size="small">View all</ion-button>
        </div>

        <ion-card class="task-card">
          <ion-item lines="full">
            <ion-checkbox slot="start" />
            <ion-label>
              <h2>Order name</h2>
              <p>orderHeader.orderDate</p>
            </ion-label>
            <ion-chip slot="end" outline>
              workEffort.id
              <ion-icon :icon="copyOutline" />
            </ion-chip>
            <ion-note slot="end">$orderHeader.total</ion-note>
          </ion-item>

          <div class="task-contact">
            <ion-item lines="none">
              <ion-icon slot="start" :icon="personOutline" color="medium" />
              <ion-label>Full name</ion-label>
              <ion-button slot="end" fill="clear" size="small">
                Copy
                <ion-icon slot="end" :icon="copyOutline" />
              </ion-button>
            </ion-item>
            <ion-item lines="none">
              <ion-icon slot="start" :icon="callOutline" color="medium" />
              <ion-label>413-230-3505</ion-label>
              <ion-button slot="end" fill="clear" size="small">
                Copy
                <ion-icon slot="end" :icon="copyOutline" />
              </ion-button>
            </ion-item>
            <ion-item lines="none">
              <ion-icon slot="start" :icon="mailOutline" color="medium" />
              <ion-label>email@example.com</ion-label>
              <ion-button slot="end" fill="clear" size="small">
                Copy
                <ion-icon slot="end" :icon="copyOutline" />
              </ion-button>
            </ion-item>
          </div>

          <div class="task-grid">
            <div>
              <p class="overline">Task</p>
              <h3>workEffort.name</h3>
              <p>workEffort.purposeType</p>
              <p class="muted">Due workEffort.dueDate</p>
            </div>
            <div>
              <p class="overline">Assignee</p>
              <h3>assignee party person name</h3>
              <p class="muted">assigned date time</p>
              <ion-button fill="outline" size="small">Assign</ion-button>
            </div>
            <div>
              <p class="overline">Resolution comment</p>
              <p>Response</p>
              <p>Response</p>
              <p>Response</p>
            </div>
          </div>

          <div class="task-grid">
            <div>
              <p class="overline">Notes</p>
              <p>workEffort.notes</p>
            </div>
            <div>
              <p class="overline">Reporter</p>
              <p>reporter party person name</p>
            </div>
          </div>

          <div class="card-actions">
            <ion-button fill="clear" size="small">Resolve task</ion-button>
            <ion-button fill="clear" size="small">View order</ion-button>
          </div>
        </ion-card>

        <!-- Recent orders -->
        <div class="section-header">
          <h2>Recent orders</h2>
          <ion-button fill="outline" size="small">View all</ion-button>
        </div>

        <div class="ion-padding-horizontal">
          <ion-searchbar placeholder="Search" />
        </div>

        <div class="recent-orders-grid">
          <ion-card v-for="(order, index) in recentOrders" :key="order.id || `placeholder-${index}`">
            <ion-item lines="full">
              <ion-label>
                <h2>{{ order.name }}</h2>
                <p>{{ order.subtitle }}</p>
              </ion-label>
              <ion-note slot="end">{{ order.progressLabel }}</ion-note>
              <ion-icon slot="end" :icon="chevronUp" color="medium" />
            </ion-item>

            <ion-progress-bar :value="order.progressValue" />

            <ion-item lines="full">
              <ion-label>
                <p class="overline">Order date</p>
                {{ order.orderDate }}
              </ion-label>
              <ion-note slot="end">note</ion-note>
            </ion-item>

            <ion-list lines="none">
              <ion-list-header>
                <ion-label>Items</ion-label>
              </ion-list-header>
              <ion-item v-for="(item, itemIndex) in order.items" :key="itemIndex">
                <ion-thumbnail slot="start">
                  <img v-if="item.imageUrl" :src="item.imageUrl" alt="Product image" />
                </ion-thumbnail>
                <ion-label>
                  {{ item.name }}
                  <p>{{ item.secondary }}</p>
                </ion-label>
              </ion-item>
            </ion-list>

            <div class="card-actions">
              <ion-button
                fill="clear"
                size="small"
                :router-link="order.id ? `/orders/${order.id}` : undefined"
                :disabled="!order.id"
              >
                View details
              </ion-button>
            </div>
          </ion-card>
        </div>
      </div>

      <!-- ===== Other segments (placeholder) ===== -->
      <div v-else class="segment-placeholder">
        <EmptyState
          :title="`${segmentLabel} coming soon`"
          :message="`The ${segmentLabel.toLowerCase()} view for this customer isn't wired up yet.`"
        />
      </div>
    </ion-content>

    <ion-content v-else-if="loading">
      <ion-list>
        <ion-item lines="none">
          <ion-label>Loading customer...</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-else-if="error">
      <ErrorState
        title="Customer failed to load"
        :message="error"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        title="Customer not found"
        message="The selected customer is not available in this workspace."
      />
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
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonThumbnail,
  IonTitle,
  IonToolbar
} from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import {
  addCircleOutline,
  callOutline,
  chevronUp,
  copyOutline,
  informationCircleOutline,
  mailOutline,
  personOutline,
  pricetagOutline
} from 'ionicons/icons';
import { useCustomerStore } from '@/store/customer';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const props = defineProps<{
  customerId: string;
}>();

const customerStore = useCustomerStore();
const { fetchStatus, errors } = storeToRefs(customerStore);

const selectedSegment = ref('dashboard');

const loading = computed(() => fetchStatus.value.detail === 'pending');
const error = computed(() => errors.value.detail || '');
const customer = computed(() => customerStore.getCustomer(props.customerId) || null);

const customerSince = computed(() => formatMonthYear(customer.value?.createdStamp));
const createdAtLabel = computed(() => formatTimestamp(customer.value?.createdStamp));
const lifetimeValue = computed(() =>
  customer.value?.lifetimeValue ? money(customer.value.lifetimeValue) : '$0.00'
);

// Contact mechs grouped into the Email / Phone / Address sections the design shows.
// Each section falls back to a single "Item" placeholder row when empty so the
// template still reads like the mockup before real data lands.
const contactSections = computed(() => {
  const cust = customer.value;
  const toValues = (mechs?: Array<{ infoString?: string }>) =>
    (mechs || []).map((mech) => mech.infoString).filter(Boolean) as string[];
  const addressValues = (cust?.postalAddresses || [])
    .map((mech) => {
      const address = mech.postalAddress;
      if (!address) return mech.infoString;
      return [address.address1, address.city, address.stateProvinceGeoId, address.postalCode]
        .filter(Boolean)
        .join(', ');
    })
    .filter(Boolean) as string[];

  return [
    { key: 'email', label: 'Email', values: withPlaceholder(toValues(cust?.emails)) },
    { key: 'phone', label: 'Phone', values: withPlaceholder(toValues(cust?.phones)) },
    { key: 'address', label: 'Address', values: withPlaceholder(addressValues) }
  ];
});

// Recent orders: real customer orders when present, otherwise three placeholder
// cards matching the mockup so the section never renders empty.
const recentOrders = computed(() => {
  const orders = customerStore.getCustomerOrders(props.customerId) || [];

  if (!orders.length) {
    return Array.from({ length: 3 }).map(() => ({
      id: '',
      name: 'Order name',
      subtitle: '3 items · 5 units',
      progressLabel: '80% Complete',
      progressValue: 0.8,
      orderDate: 'May 30, 2026',
      items: Array.from({ length: 3 }).map(() => ({
        name: 'primary identifier',
        secondary: 'secondary identifier',
        imageUrl: ''
      }))
    }));
  }

  return orders.map((order: any) => {
    const items = order.items || [];
    const units = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    return {
      id: order.id,
      name: order.orderName || order.externalId || order.id,
      subtitle: `${items.length} ${items.length === 1 ? 'item' : 'items'} · ${units} ${units === 1 ? 'unit' : 'units'}`,
      progressLabel: order.status || 'In progress',
      progressValue: 0.5,
      orderDate: formatLongDate(order.orderDate),
      items: items.slice(0, 3).map((item: any) => ({
        name: item.name || item.sku || 'Item',
        secondary: item.sku || '',
        imageUrl: item.imageUrl || ''
      }))
    };
  });
});

const segmentLabel = computed(() => {
  const labels: Record<string, string> = {
    tasks: 'Tasks',
    unfillable: 'Unfillable',
    orders: 'Orders',
    returns: 'Returns',
    comms: 'Comms'
  };
  return labels[selectedSegment.value] || 'Dashboard';
});

onMounted(() => loadCustomer(props.customerId));
watch(() => props.customerId, (customerId) => loadCustomer(customerId));

async function loadCustomer(customerId: string) {
  if (!customerId) return;
  try {
    await customerStore.loadCustomer(customerId);
  } catch {
    // error surfaced via store errors.detail -> ErrorState
  }
}

function withPlaceholder(values: string[]): string[] {
  return values.length ? values : ['Item'];
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

function formatMonthYear(value?: string | number) {
  const date = parseDate(value);
  return date?.isValid ? date.toFormat('LLLL yyyy') : '';
}

function formatLongDate(value?: string | number) {
  const date = parseDate(value);
  return date?.isValid ? date.toLocaleString(DateTime.DATE_MED) : String(value ?? '');
}

function formatTimestamp(value?: string | number) {
  const date = parseDate(value);
  return date?.isValid ? date.toFormat('h:mma d LLL yyyy') : '';
}
</script>

<style scoped>
ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions";
  align-items: center;
}

ion-card-header ion-card-title {
  grid-area: title;
}

.customer-detail-header {
  display: grid;
  gap: var(--spacer-base, 16px);
  grid-template-columns: minmax(0, 1fr);
  padding: 8px;
}

.customer-detail-main {
  display: grid;
  gap: 16px;
  align-content: start;
}

.customer-detail-cards {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  align-items: start;
}

.customer-detail-secondary {
  display: grid;
  gap: 16px;
  align-content: start;
}

.customer-header-card h1 {
  font-size: 26px;
  font-weight: 400;
  margin: 0;
}

.lifetime-value h2 {
  font-size: 24px;
  font-weight: 400;
  margin: 0;
}

.lifetime-value .overline {
  margin: 0 0 2px;
}

.overline {
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-size: 10px;
  color: var(--ion-color-medium, #92949c);
  margin: 0 0 4px;
}

.muted {
  color: var(--ion-color-medium, #92949c);
}

.card-actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px 8px;
  border-top: 1px solid var(--ion-color-step-100, #e6e6e6);
}

.timeline-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 16px 8px;
}

.section-header h2 {
  font-size: 22px;
  font-weight: 400;
  margin: 0;
}

.task-contact {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.task-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  padding: 12px 16px;
}

.task-grid h3 {
  font-size: 16px;
  margin: 0 0 2px;
}

.task-grid p {
  margin: 0 0 2px;
  font-size: 14px;
}

.recent-orders-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  padding: 8px;
}

.segment-placeholder {
  padding: 8px;
}

@media (min-width: 992px) {
  .customer-detail-header {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
    align-items: start;
  }
}
</style>
