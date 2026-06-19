<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/customers" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Customer Detail</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDeleteCustomer" :disabled="deleting || customer?.statusId === 'PARTY_DISABLED'">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-buttons>
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
                <p v-if="customerSince">Customer since {{ customerSince }}</p>
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
                <template v-for="section in contactSections" :key="section.key">
                  <ion-item class="contact-section" lines="none">
                    <ion-label color="medium">{{ section.label }}</ion-label>
                    <ion-button v-if="!section.values.length" slot="end" fill="clear" size="small" @click="onAddContact(section.contactMechTypeId)">
                      Add
                      <ion-icon slot="end" :icon="addCircleOutline" />
                    </ion-button>
                    <ion-button v-else slot="end" fill="clear" size="small" @click="onEditContact(section)">
                      Edit
                      <ion-icon slot="end" :icon="pencilOutline" />
                    </ion-button>
                  </ion-item>
                  <ion-item v-for="value in section.values" :key="value.contactMechId">
                    <ion-label>{{ value.display }}</ion-label>
                    <ion-note slot="end">{{ seed.describe(value.contactMechPurposeTypeId) }}</ion-note>
                  </ion-item>
                  <ion-item v-if="!section.values.length" lines="none">
                    <ion-label color="medium"><em>None on file</em></ion-label>
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
                  <ion-item v-for="relationship in personalRelationships" :key="relationship.key">
                    <ion-label>
                      <p class="overline">{{ seed.describe(relationship.partyRelationshipTypeId) }}</p>
                      <h3>{{ relationship.relatedPartyName }}</h3>
                      <p>{{ relationship.relatedPartyId }}</p>
                    </ion-label>
                    <ion-button slot="end" fill="outline" size="small" :disabled="!relationship.active" @click="onExpireRelationship(relationship)">
                      {{ relationship.active ? 'Expire' : 'Expired' }}
                    </ion-button>
                  </ion-item>
                  <ion-item v-if="!personalRelationships.length" lines="none">
                    <ion-label color="medium"><em>No relationships on file</em></ion-label>
                  </ion-item>
                </ion-list>
                <div class="card-actions">
                  <ion-button fill="clear" size="small" @click="onViewRelationshipHistory('personal')">View history</ion-button>
                  <ion-button fill="clear" size="small" @click="onAddRelationship()">Add new</ion-button>
                </div>
              </ion-card>

              <!-- Merged contacts -->
              <ion-card>
                <ion-card-header>
                  <ion-card-title>Merged Contacts</ion-card-title>
                </ion-card-header>
                <ion-list lines="none">
                  <!-- Already-merged duplicates (active only; expired ones are in View history) -->
                  <template v-for="duplicate in duplicateRelationships" :key="duplicate.key">
                    <ion-item v-if="duplicate.active">
                      <ion-label>
                        <p class="overline">{{ duplicate.isCanonical ? 'Duplicate' : 'Canonical' }}</p>
                        <h3>{{ duplicate.isCanonical ? duplicate.duplicatePartyName : duplicate.canonicalPartyName }}</h3>
                        <p>{{ duplicate.isCanonical ? duplicate.duplicatePartyId : duplicate.canonicalPartyId }}</p>
                      </ion-label>
                      <ion-button slot="end" fill="outline" size="small" @click="onExpireDuplicateRelationship(duplicate)">
                        Expire
                      </ion-button>
                    </ion-item>
                  </template>
                  <!-- Unmerged candidates with the same Shopify ID -->
                  <ion-item v-for="candidate in mergableDuplicates" :key="candidate.partyId">
                    <ion-label>
                      <p class="overline">Duplicate candidate</p>
                      <h3>{{ candidate.name }}</h3>
                      <p>{{ candidate.partyId }}</p>
                    </ion-label>
                    <ion-button slot="end" fill="clear" size="small" :router-link="`/customers/${candidate.partyId}`">
                      <ion-icon slot="icon-only" :icon="openOutline" />
                    </ion-button>
                    <ion-button slot="end" fill="solid" size="small" color="primary" :disabled="mergingIds.includes(candidate.partyId)" @click="onMergeCandidate(candidate.partyId)">
                      <ion-spinner v-if="mergingIds.includes(candidate.partyId)" name="crescent" slot="icon-only" />
                      <template v-else>Merge</template>
                    </ion-button>
                  </ion-item>
                  <ion-item v-if="!duplicateRelationships.some((d: { active: boolean }) => d.active) && !mergableDuplicates.length" lines="none">
                    <ion-label color="medium"><em>No Merged Contacts</em></ion-label>
                  </ion-item>
                </ion-list>
                <div class="card-actions">
                  <ion-button fill="clear" size="small" @click="onViewRelationshipHistory('duplicate')">View history</ion-button>
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
            <ion-item v-for="event in timeline" :key="event.id" lines="full">
              <ion-icon slot="start" :icon="pricetagOutline" color="medium" />
              <ion-label>{{ event.label }}</ion-label>
              <ion-icon slot="end" :icon="informationCircleOutline" color="medium" />
            </ion-item>
            <ion-item v-if="!timeline.length" lines="full">
              <ion-icon slot="start" :icon="pricetagOutline" color="medium" />
              <ion-label>Created by {{ customer.createdByUserLogin }}</ion-label>
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
        <!-- Open tasks (placeholder until GET /oms/parties/{partyId}/tasks lands) -->
        <div class="section-header">
          <h2>Open tasks</h2>
          <ion-button fill="outline" size="small">View all</ion-button>
        </div>

        <ion-card v-for="task in openTasks" :key="task.workEffortId" class="task-card">
          <ion-item lines="full">
            <ion-checkbox slot="start" />
            <ion-label>
              <h2>{{ task.orderName || task.orderId || task.workEffortName }}</h2>
              <p v-if="task.orderDate">{{ formatLongDate(task.orderDate) }}</p>
            </ion-label>
            <ion-chip slot="end" outline>{{ task.workEffortId }}</ion-chip>
            <ion-note v-if="task.orderTotal != null" slot="end">{{ money(task.orderTotal) }}</ion-note>
          </ion-item>

          <div class="task-grid">
            <div>
              <p class="overline">Task</p>
              <h3>{{ task.workEffortName }}</h3>
              <p>{{ seed.describe(task.purposeTypeId || task.workEffortTypeId) }}</p>
              <p class="muted" v-if="task.dueDate">Due {{ formatLongDate(task.dueDate) }}</p>
            </div>
            <div>
              <p class="overline">Assignee</p>
              <h3>{{ task.assignee?.name || 'Unassigned' }}</h3>
              <p class="muted" v-if="task.assignee?.fromDate">{{ formatLongDate(task.assignee.fromDate) }}</p>
            </div>
            <div>
              <p class="overline">Reporter</p>
              <h3>{{ task.reporter?.name || '—' }}</h3>
            </div>
          </div>

          <div class="task-grid" v-if="task.notes">
            <div>
              <p class="overline">Notes</p>
              <p>{{ task.notes }}</p>
            </div>
          </div>

          <div class="card-actions">
            <ion-button fill="clear" size="small">Resolve task</ion-button>
            <ion-button v-if="task.orderId" fill="clear" size="small" :router-link="`/orders/${task.orderId}`">
              View order
            </ion-button>
          </div>
        </ion-card>
        <EmptyState
          v-if="tasksStatus === 'loaded' && !openTasks.length"
          title="No open tasks"
          message="This customer has no open tasks."
        />

        <!-- Recent orders (real when present, placeholder until the Solr orders query lands) -->
        <div class="section-header">
          <h2>Recent orders</h2>
          <ion-button fill="outline" size="small">View all</ion-button>
        </div>

        <div class="ion-padding-horizontal">
          <ion-searchbar placeholder="Search" :value="recentOrdersQuery" @ion-input="recentOrdersQuery = ($event.target as any).value ?? ''" />
        </div>

        <div v-if="recentOrders.length" class="recent-orders-grid">
          <ion-card v-for="order in recentOrders" :key="order.id">
            <ion-item lines="full">
              <ion-label>
                <h2>{{ order.name }}</h2>
                <p>{{ order.subtitle }}</p>
              </ion-label>
              <ion-note slot="end">{{ order.progressLabel }}</ion-note>
              <ion-icon slot="end" :icon="chevronUp" color="medium" />
            </ion-item>

            <ion-progress-bar :value="order.progressValue" :color="order.progressColor" />

            <ion-item lines="full">
              <ion-label>
                <p class="overline">Order date</p>
                {{ order.orderDate }}
              </ion-label>
            </ion-item>

            <ion-list lines="none">
              <ion-list-header>
                <ion-label>Items</ion-label>
              </ion-list-header>
              <ion-item v-for="(item, itemIndex) in order.items" :key="itemIndex">
                <ion-thumbnail slot="start">
                  <DxpShopifyImg :src="(productCache as any).getProduct(item.productId)?.mainImageUrl" size="small" />
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
        <EmptyState
          v-else-if="ordersStatus === 'loaded'"
          title="No recent orders"
          message="This customer has no orders on file."
        />
      </div>

      <!-- ===== Orders segment ===== -->
      <div v-else-if="selectedSegment === 'orders'">
        <div class="section-header">
          <h2>All orders</h2>
        </div>
        <div class="ion-padding-horizontal">
          <ion-searchbar placeholder="Search" :value="allOrdersQuery" @ion-input="allOrdersQuery = ($event.target as any).value ?? ''" />
        </div>
        <div v-if="allOrders.length" class="recent-orders-grid">
          <ion-card v-for="order in allOrders" :key="order.id">
            <ion-item lines="full">
              <ion-label>
                <h2>{{ order.name }}</h2>
                <p>{{ order.subtitle }}</p>
              </ion-label>
              <ion-note slot="end">{{ order.progressLabel }}</ion-note>
              <ion-icon slot="end" :icon="chevronUp" color="medium" />
            </ion-item>
            <ion-progress-bar :value="order.progressValue" :color="order.progressColor" />
            <ion-item lines="full">
              <ion-label>
                <p class="overline">Order date</p>
                {{ order.orderDate }}
              </ion-label>
            </ion-item>
            <ion-list lines="none">
              <ion-list-header>
                <ion-label>Items</ion-label>
              </ion-list-header>
              <ion-item v-for="(item, itemIndex) in order.items" :key="itemIndex">
                <ion-thumbnail slot="start">
                  <DxpShopifyImg :src="(productCache as any).getProduct(item.productId)?.mainImageUrl" size="small" />
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
        <EmptyState
          v-else-if="ordersStatus === 'loaded'"
          title="No orders"
          message="This customer has no orders on file."
        />
      </div>

      <!-- ===== Unfillable segment ===== -->
      <div v-else-if="selectedSegment === 'unfillable'">
        <div class="section-header">
          <h2>Unfillable orders</h2>
        </div>
        <div v-if="unfillableOrders.length" class="recent-orders-grid">
          <ion-card v-for="order in unfillableOrders" :key="order.id">
            <ion-item lines="full">
              <ion-label>
                <h2>{{ order.name }}</h2>
                <p>{{ order.subtitle }}</p>
              </ion-label>
              <ion-note slot="end">{{ order.progressLabel }}</ion-note>
              <ion-icon slot="end" :icon="chevronUp" color="medium" />
            </ion-item>
            <ion-progress-bar :value="order.progressValue" color="warning" />
            <ion-item lines="full">
              <ion-label>
                <p class="overline">Order date</p>
                {{ order.orderDate }}
              </ion-label>
            </ion-item>
            <ion-list lines="none">
              <ion-list-header>
                <ion-label>Items</ion-label>
              </ion-list-header>
              <ion-item v-for="(item, itemIndex) in order.items" :key="itemIndex">
                <ion-thumbnail slot="start">
                  <DxpShopifyImg :src="(productCache as any).getProduct(item.productId)?.mainImageUrl" size="small" />
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
        <EmptyState
          v-else-if="ordersStatus === 'loaded'"
          title="No unfillable orders"
          message="No orders are currently parked at the unfillable facility."
        />
      </div>

      <!-- ===== Returns segment ===== -->
      <div v-else-if="selectedSegment === 'returns'">
        <div class="section-header">
          <h2>Returns</h2>
        </div>
        <ion-list v-if="returnRows.length">
          <ion-list-header>
            <ion-label>{{ returnRows.length }} {{ returnRows.length === 1 ? 'RMA' : 'RMAs' }}</ion-label>
          </ion-list-header>
          <div
            v-for="returnRow in returnRows"
            :key="returnRow.returnId"
            class="list-item"
            style="--columns-mobile: 2; --columns-tablet: 4; --columns-desktop: 4;"
            role="link"
            tabindex="0"
            @click="openReturnRow(returnRow)"
            @keydown.enter.prevent="openReturnRow(returnRow)"
            @keydown.space.prevent="openReturnRow(returnRow)"
          >
            <ion-item lines="none">
              <ion-thumbnail v-if="returnRow.thumbnailProductId" slot="start">
                <DxpShopifyImg :src="(productCache as any).getProduct(returnRow.thumbnailProductId)?.mainImageUrl" size="small" />
              </ion-thumbnail>
              <ion-label class="ion-text-wrap">
                <p class="overline">{{ returnRow.dateLabel }}</p>
                {{ returnRow.title }}
                <p>{{ returnRow.itemSummary }}</p>
              </ion-label>
            </ion-item>

            <ion-label class="tablet ion-text-start">
              {{ returnRow.orderLabel }}
              <p v-if="returnRow.facilityLabel">{{ returnRow.facilityLabel }}</p>
              <p v-if="returnRow.channelLabel">{{ returnRow.channelLabel }}</p>
            </ion-label>

            <ion-label class="tablet">
              {{ returnRow.amount }}
              <p>{{ returnRow.itemCountLabel }}</p>
            </ion-label>

            <ion-label class="ion-text-end">
              {{ returnRow.statusLabel }}
              <p>Status</p>
            </ion-label>
          </div>
        </ion-list>
        <ErrorState
          v-else-if="returnsStatus === 'error'"
          title="Returns failed to load"
          :message="returnsError"
        />
        <EmptyState
          v-else-if="returnsStatus === 'loaded'"
          title="No returns"
          message="This customer has no returns on file."
        />
        <div v-else class="ion-padding ion-text-center">
          <ion-spinner name="crescent" />
        </div>
      </div>

      <!-- ===== Comms segment ===== -->
      <div v-else-if="selectedSegment === 'comms'">
        <div class="section-header">
          <h2>Communications</h2>
        </div>
        <div v-if="customerCommunications.length" class="recent-orders-grid">
          <ion-card v-for="comm in customerCommunications" :key="comm.communicationEventId">
            <ion-item lines="full">
              <ion-label>
                <h2>{{ comm.subject || '(No subject)' }}</h2>
                <p>{{ (seed as any).describe(comm.communicationEventTypeId) || comm.communicationEventTypeId }}</p>
              </ion-label>
              <ion-chip slot="end" :color="commStatusColor(comm.statusId)" outline>
                {{ (seed as any).describe(comm.statusId) || comm.statusId }}
              </ion-chip>
            </ion-item>

            <ion-item lines="full">
              <ion-label>
                <p class="overline">Date</p>
                {{ formatLongDate(comm.datetimeStarted || comm.entryDate) }}
              </ion-label>
              <ion-label slot="end" v-if="comm.datetimeEnded">
                <p class="overline">Ended</p>
                {{ formatLongDate(comm.datetimeEnded) }}
              </ion-label>
            </ion-item>

            <ion-item lines="full">
              <ion-label>
                <p class="overline">From</p>
                {{ comm.partyIdFrom || '—' }}
              </ion-label>
              <ion-label slot="end">
                <p class="overline">To</p>
                {{ comm.partyIdTo || '—' }}
              </ion-label>
            </ion-item>

            <ion-item v-if="comm.content || comm.note" lines="none">
              <ion-label class="ion-text-wrap">
                <p class="overline">Message</p>
                <p>{{ comm.content || comm.note }}</p>
              </ion-label>
            </ion-item>
          </ion-card>
        </div>
        <EmptyState
          v-else-if="commsStatus === 'loaded'"
          title="No communications"
          message="No communication events found for this customer."
        />
        <ErrorState
          v-else-if="commsStatus === 'error'"
          title="Communications failed to load"
          :message="commsError"
        />
        <div v-else class="ion-padding ion-text-center">
          <ion-spinner name="crescent" />
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
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  alertController,
  modalController
} from '@ionic/vue';
import { DateTime } from 'luxon';
import {
  addCircleOutline,
  chevronUp,
  informationCircleOutline,
  openOutline,
  pencilOutline,
  pricetagOutline,
  trashOutline
} from 'ionicons/icons';
import { commonUtil, DxpShopifyImg } from '@common';
import { useCustomerDetail } from '@/composables/useCustomerDetail';
import { useProductCacheStore } from '@/store/productCache';
import { useSeedStore } from '@/store/seed';
import type { CustomerOrderSummary, CustomerReturnSummary } from '@/types/customer';
import AddContactModal from '@/components/AddContactModal.vue';
import AddRelationshipModal from '@/components/AddRelationshipModal.vue';
import RelationshipHistoryModal from '@/components/RelationshipHistoryModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import router from '@/router';
import { deleteCustomerDetails, indexCustomer } from '@/services/customer';

const props = defineProps<{
  customerId: string;
}>();

const selectedSegment = ref('dashboard');
const seed = useSeedStore();
const productCache = useProductCacheStore();
const recentOrdersQuery = ref('');
const allOrdersQuery = ref('');
const deleting = ref(false);

const {
  customer,
  loading,
  error,
  contactSections,
  personalRelationships,
  duplicateRelationships,
  mergableDuplicates,
  timeline,
  recentOrders: recentOrdersSource,
  openTasks,
  customerReturns: customerReturnsSource,
  customerCommunications: customerCommunicationsSource,
  ordersStatus,
  tasksStatus,
  returnsStatus,
  commsStatus,
  returnsError,
  commsError,
  lifetimeValue: lifetimeValueRaw,
  lifetimeCurrency,
  customerSince: customerSinceRaw,
  load,
  loadReturns,
  loadCommunications,
  expireRelationship,
  mergeContact,
  createRelationship,
  addContact,
  updateContact,
  expireContact
} = useCustomerDetail(() => props.customerId);

const mergingIds = ref<string[]>([]);

const customerReturns = computed(() => customerReturnsSource.value as import('@/types/customer').CustomerReturnSummary[]);
const customerCommunications = computed(() => customerCommunicationsSource.value as import('@/types/customer').CustomerCommunicationSummary[]);

const customerSince = computed(() => formatMonthYear(customerSinceRaw.value));
const createdAtLabel = computed(() => (timeline.value[0]?.at ? formatTimestamp(timeline.value[0].at) : ''));
const lifetimeValue = computed(() => money(lifetimeValueRaw.value, lifetimeCurrency.value));

function mapOrder(order: CustomerOrderSummary) {
  return {
    id: order.orderId,
    name: order.orderName || order.orderId,
    subtitle: `${order.itemCount} ${order.itemCount === 1 ? 'item' : 'items'} · ${order.unitCount} ${order.unitCount === 1 ? 'unit' : 'units'}`,
    progressLabel: order.progressLabel || order.statusDesc || 'In progress',
    progressValue: order.progressValue ?? 0.5,
    progressColor: order.progressColor || 'primary',
    orderDate: formatLongDate(order.orderDate),
    isUnfillable: order.isUnfillable,
    items: (order.items || []).map((item) => ({
      productId: item.productId || '',
      name: item.name || item.sku || 'Item',
      secondary: item.sku || '',
      imageUrl: item.imageUrl || ''
    }))
  };
}

function matchesOrderQuery(order: ReturnType<typeof mapOrder>, q: string): boolean {
  const lower = q.toLowerCase();
  return order.name.toLowerCase().includes(lower) || order.id.toLowerCase().includes(lower);
}

type MappedOrder = ReturnType<typeof mapOrder>;

// Recent orders: live customer orders from Solr (docType:ORDER, customerPartyId).
const recentOrders = computed(() => {
  const mapped: MappedOrder[] = recentOrdersSource.value.slice(0, 12).map(mapOrder);
  const q = recentOrdersQuery.value.trim();
  return q ? mapped.filter((o) => matchesOrderQuery(o, q)) : mapped;
});
const allOrders = computed(() => {
  const mapped: MappedOrder[] = recentOrdersSource.value.map(mapOrder);
  const q = allOrdersQuery.value.trim();
  return q ? mapped.filter((o) => matchesOrderQuery(o, q)) : mapped;
});
const unfillableOrders = computed(() => recentOrdersSource.value.filter((o: CustomerOrderSummary) => o.isUnfillable).map(mapOrder));
const returnRows = computed(() => customerReturns.value.map(mapReturnRow));

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

async function onDeleteCustomer() {
  const alert = await alertController.create({
    header: 'Anonymize customer data',
    message: `This will permanently anonymize all PII for ${customer.value?.name || 'this customer'}. This cannot be undone.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Anonymize',
        role: 'confirm',
        handler: () => {
          void (async () => {
            deleting.value = true;
            try {
              await deleteCustomerDetails(props.customerId);
              await indexCustomer(props.customerId);
              await commonUtil.showToast('Customer data has been anonymized.');
              router.replace('/customers');
            } catch {
              await commonUtil.showToast('Failed to anonymize customer data. Please try again.');
            } finally {
              deleting.value = false;
            }
          })();
        }
      }
    ]
  });
  await alert.present();
}

async function onAddRelationship() {
  const modal = await modalController.create({
    component: AddRelationshipModal,
    componentProps: { currentPartyId: props.customerId }
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'confirm' && data) {
    await createRelationship({
      partyIdFrom: props.customerId,
      partyIdTo: data.partyId,
      partyRelationshipTypeId: data.partyRelationshipTypeId,
      roleTypeIdFrom: data.roleTypeIdFrom,
      roleTypeIdTo: data.roleTypeIdTo,
      fromDate: DateTime.now().toMillis(),
      comments: data.comments
    });
  }
}

async function onMergeCandidate(candidatePartyId: string) {
  mergingIds.value = [...mergingIds.value, candidatePartyId];
  try {
    await mergeContact(candidatePartyId);
    await commonUtil.showToast('Contact merged successfully.');
  } catch {
    await commonUtil.showToast('Failed to merge contact. Please try again.');
  } finally {
    mergingIds.value = mergingIds.value.filter((id) => id !== candidatePartyId);
  }
}

async function onExpireDuplicateRelationship(duplicate: { keyFields: { partyIdFrom: string; partyIdTo: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: string } }) {
  await expireRelationship(duplicate.keyFields, DateTime.now().toMillis());
}

async function onViewRelationshipHistory(filterType?: 'duplicate' | 'personal') {
  const modal = await modalController.create({
    component: RelationshipHistoryModal,
    componentProps: { currentPartyId: props.customerId, filterType }
  });
  await modal.present();
}

async function onAddContact(contactMechTypeId: string) {
  const modal = await modalController.create({
    component: AddContactModal,
    componentProps: { contactMechTypeId }
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'confirm' && data) {
    await addContact(contactMechTypeId, data);
  }
}

async function onEditContact(section: import('@/types/customer').ContactSection) {
  const existingContact = customer.value?.contactMechs.find(
    (cm: import('@/types/customer').CustomerContactMech) => cm.contactMechId === section.values[0]?.contactMechId
  );
  const modal = await modalController.create({
    component: AddContactModal,
    componentProps: { contactMechTypeId: section.contactMechTypeId, existingContact }
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'confirm' && data && section.values[0]) {
    await updateContact(section.contactMechTypeId, section.values[0].contactMechId, data);
  } else if (role === 'expire' && section.values[0]) {
    await expireContact(section.values[0].contactMechId);
  }
}

async function onExpireRelationship(relationship: { keyFields: { partyIdFrom: string; partyIdTo: string; roleTypeIdFrom: string; roleTypeIdTo: string; fromDate: string } }) {
  await expireRelationship(relationship.keyFields, DateTime.now().toMillis());
}

function loadSelectedSegment(segment = selectedSegment.value) {
  if (segment === 'returns') return loadReturns();
  if (segment === 'comms') return loadCommunications();
}

onMounted(() => {
  void load();
  void loadSelectedSegment();
});
watch(selectedSegment, (segment) => {
  void loadSelectedSegment(segment);
});
watch(() => props.customerId, () => {
  void load();
  void loadSelectedSegment();
});

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0));
}

function commStatusColor(statusId: string): string {
  if (statusId === 'COM_COMPLETE') return 'success';
  if (statusId === 'COM_CANCELLED') return 'danger';
  if (statusId === 'COM_IN_PROGRESS') return 'primary';
  return 'medium';
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

function mapReturnRow(returnRecord: CustomerReturnSummary) {
  const primaryItem = returnRecord.items[0];
  const orderId = returnRecord.items.find((item) => item.orderId)?.orderId || '';
  const productLabel = primaryItem?.description || primaryItem?.productId || 'Return item';
  const itemSummary = returnRecord.itemCount > 1
    ? `${productLabel} + ${returnRecord.itemCount - 1} more`
    : productLabel;

  return {
    returnId: returnRecord.returnId,
    title: `RMA ${returnRecord.externalId || returnRecord.returnId}`,
    dateLabel: formatLongDate(returnRecord.entryDate),
    itemSummary,
    amount: money(returnRecord.returnTotal, returnRecord.currencyUomId),
    itemCountLabel: `${returnRecord.itemCount} ${returnRecord.itemCount === 1 ? 'item' : 'items'}`,
    orderLabel: orderId ? `Order ${orderId}` : 'Order not linked',
    facilityLabel: returnRecord.destinationFacilityId ? `Facility ${returnRecord.destinationFacilityId}` : '',
    channelLabel: returnRecord.returnChannelEnumId ? seed.describe(returnRecord.returnChannelEnumId) || returnRecord.returnChannelEnumId : '',
    thumbnailProductId: primaryItem?.productId || '',
    returnRoute: `/returns/${returnRecord.returnId}`,
    statusLabel: seed.describe(returnRecord.statusId) || returnRecord.statusId
  };
}

function openReturnRow(returnRow: ReturnType<typeof mapReturnRow>) {
  router.push(returnRow.returnRoute);
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
