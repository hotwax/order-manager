<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/orders" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Order details</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="loading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="order">
      <div class="order-detail-header">
        <!-- direct child matching .order-detail-header>ion-item -->
        <ion-item lines="none">
          <ion-label>
            {{ order.orderName || 'Order' }}
            <p>{{ order.id }}</p>
          </ion-label>
          <ion-badge slot="end" color="primary">{{ order.status }}</ion-badge>
        </ion-item>

        <!-- timeline: child matching .order-detail-timeline -->
        <div class="order-detail-timeline">
          <ion-list>
            <ion-list-header>
              <ion-label>Timeline</ion-label>
            </ion-list-header>

            <ion-item v-for="historyEntry in order.history" :key="historyEntry.id">
              <ion-label>
                {{ historyEntry.label }}
                <p>{{ historyEntry.detail }}</p>
                <p v-if="historyEntry.changeReason">{{ historyEntry.changeReason }}</p>
              </ion-label>
              <ion-note slot="end">{{ formatDate(historyEntry.at) }}</ion-note>
            </ion-item>

            <template v-if="!order.history?.length">
              <ion-item>
                <ion-label>
                  Order status
                  <p>Initial status details</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  Order facility change
                  <p>Facility details</p>
                </ion-label>
              </ion-item>
            </template>
          </ion-list>
        </div>

        <!-- details wrapper: child matching .order-detail-header-details -->
        <div class="order-detail-header-details">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ order.customerName || 'Customer name' }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>Email</p>
                  {{ customer?.email || 'Email not available' }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Phone</p>
                  {{ customer?.phone || 'Phone not available' }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Billing address</p>
                  <template v-if="billingAddress?.lines?.length">
                    <div v-for="(line, idx) in billingAddress.lines" :key="idx">{{ line }}</div>
                  </template>
                  <div v-else>Billing address not available</div>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Order identifications</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>Order name</p>
                  {{ order.orderName || 'Order name' }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Order external ID</p>
                  {{ order.externalId || 'Order external ID' }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Order ID</p>
                  {{ order.id }}
                </ion-label>
              </ion-item>
              <ion-item v-for="id in order.identifications" :key="id.orderIdentificationTypeId">
                <ion-label>
                  <p>{{ id.typeLabel }}</p>
                  {{ id.idValue }}
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Order payment preference</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item v-for="payment in order.payments" :key="payment.id">
                <ion-label>
                  <p>{{ payment.paymentMethodTypeDesc || payment.method }}</p>
                  {{ money(payment.amount, order.currency) }}
                </ion-label>
                <ion-note slot="end">{{ payment.statusDesc || payment.status }}</ion-note>
              </ion-item>
              <ion-item v-if="!order.payments?.length">
                <ion-label>No payment preference records</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Source</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>Product store name</p>
                  {{ order.productStoreName }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Sales channel</p>
                  {{ order.channel || 'Sales channel enum' }}
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card>
        </div>
      </div>

      <ion-segment v-model="selectedSegment">
        <ion-segment-button value="items">
          <ion-label>Items</ion-label>
        </ion-segment-button>
        <ion-segment-button value="ship-groups">
          <ion-label>Ship groups</ion-label>
        </ion-segment-button>
        <ion-segment-button value="holds">
          <ion-label>Holds</ion-label>
        </ion-segment-button>
        <ion-segment-button value="comms">
          <ion-label>Comms</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div v-if="selectedSegment === 'holds'">
        <ion-card v-for="hold in openHolds" :key="hold.id">
          <ion-item color="warning" lines="none">
            <ion-label>
              {{ hold.purpose }}
              <p>{{ hold.name }}</p>
              <p v-if="hold.assignee">Assigned to {{ hold.assignee }}</p>
            </ion-label>
            <ion-badge slot="end" color="dark">{{ hold.status }}</ion-badge>
          </ion-item>
        </ion-card>
        <ion-list v-if="!openHolds.length">
          <ion-item lines="none">
            <ion-label>No open holds on this order</ion-label>
          </ion-item>
        </ion-list>
      </div>

      <div v-if="selectedSegment === 'items'">
        <ion-accordion-group>
          <ion-accordion v-for="group in groupedItems" :key="group.externalId" :value="group.externalId">
            <div slot="header" class="list-items">
              <ion-item class="item-key-header">
                <ion-checkbox slot="start" v-model="group.selected" @click.stop />
                <ion-thumbnail slot="start" v-if="group.imageUrl">
                  <img :src="group.imageUrl" alt="Product Image" />
                </ion-thumbnail>
                <ion-label>
                  {{ group.name }}
                  <p>SKU: {{ group.sku }} · Ext ID: {{ group.externalId }}</p>
                </ion-label>
                <ion-note slot="end" class="ion-text-right">
                  {{ group.totalQty }} {{ group.totalQty === 1 ? 'unit' : 'units' }}
                  <p>{{ money(group.unitPrice, order.currency) }}</p>
                </ion-note>
                <ion-badge slot="end" color="primary">{{ group.status }}</ion-badge>
              </ion-item>
            </div>
            <div slot="content" class="ion-padding-horizontal">
              <ion-list lines="none">
                <ion-item v-for="item in group.items" :key="item.orderItemSeqId">
                  <ion-checkbox slot="start" v-model="item.selected" />
                  <ion-label>
                    Item Seq: {{ item.orderItemSeqId }} (Ship Group #{{ item.shipGroupSeqId }})
                    <p>Quantity: {{ item.quantity }}</p>
                  </ion-label>
                  <ion-chip outline color="secondary">
                    {{ item.facilityName }}
                  </ion-chip>
                  <ion-badge slot="end" color="primary">{{ item.status }}</ion-badge>

                  <ion-buttons slot="end">
                    <ion-button fill="clear" size="small" color="success">
                      Complete
                    </ion-button>
                    <ion-button fill="clear" size="small" color="danger">
                      Cancel
                    </ion-button>
                    <ion-button
                      v-if="item.statusId === 'ITEM_COMPLETED' && item.returnableQty > 0"
                      fill="clear"
                      size="small"
                      color="warning"
                    >
                      Return
                    </ion-button>

                    <ion-button fill="clear" size="small" :id="'item-opt-trigger-' + item.orderItemSeqId">
                      <ion-icon slot="icon-only" :icon="ellipsisVertical" />
                    </ion-button>
                    <ion-popover :trigger="'item-opt-trigger-' + item.orderItemSeqId" dismiss-on-select>
                      <ion-content>
                        <ion-list>
                          <ion-item buttonDetail="false" button>Edit Quantity</ion-item>
                          <ion-item buttonDetail="false" button>Change Facility</ion-item>
                          <ion-item buttonDetail="false" button color="danger">Cancel Item</ion-item>
                        </ion-list>
                      </ion-content>
                    </ion-popover>
                  </ion-buttons>
                </ion-item>
              </ion-list>
            </div>
          </ion-accordion>
        </ion-accordion-group>

        <!-- Totals Card -->
        <ion-card class="totals">
          <ion-card-header>
            <ion-card-title>Totals</ion-card-title>
          </ion-card-header>
          <ion-list lines="none">
            <ion-item>
              <ion-label>Subtotal</ion-label>
              <ion-note slot="end">{{ money(orderTotals.subtotal, order.currency) }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>Taxes</ion-label>
              <ion-note slot="end">{{ money(orderTotals.taxes, order.currency) }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>Shipping</ion-label>
              <ion-note slot="end">{{ money(orderTotals.shipping, order.currency) }}</ion-note>
            </ion-item>
            <ion-item class="total-item">
              <ion-label>Grand Total</ion-label>
              <ion-note slot="end" color="dark">{{ money(orderTotals.total, order.currency) }}</ion-note>
            </ion-item>
          </ion-list>
        </ion-card>
      </div>
      <div v-if="selectedSegment === 'ship-groups'">
        <!-- Loop through ship groups or show mock card if empty -->
        <template v-if="order.shipGroups && order.shipGroups.length">
          <ion-card v-for="shipGroup in order.shipGroups" :key="shipGroup.id">
            <div class="shipgroup">
              <ion-item lines="none">
                <ion-label>
                  Ship Group #{{ shipGroup.id }}
                  <p>{{ shipGroup.facilityName || 'Facility Name' }}</p>
                  <p>{{ shipGroup.itemSummary }}</p>
                </ion-label>
                <ion-icon slot="end" :icon="chevronDown" />
              </ion-item>
            </div>

            <ion-progress-bar value="0.5" />

            <div class="selectable-attributes ion-padding-horizontal ion-padding-top">
              <ion-chip outline color="secondary">May Split</ion-chip>
              <ion-chip outline color="success">Gift</ion-chip>
              <ion-chip outline color="warning">High Priority</ion-chip>
            </div>

            <div class="lifecycle">
              <ion-item lines="none">
                <ion-label>Brokered</ion-label>
                <ion-note slot="end">{{ formatDate(shipGroup.estimatedShipDate) || 'Pending' }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Pick</ion-label>
                <ion-note slot="end">{{ formatDate(shipGroup.picklistDate) || 'Pending' }}</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Pack</ion-label>
                <ion-note slot="end">Pending</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Ship</ion-label>
                <ion-note slot="end">Pending</ion-note>
              </ion-item>
            </div>

            <div class="selected-attributes">
              <ion-item lines="none" v-if="shipGroup.giftMessage">
                <ion-label>
                  <p>Gift message</p>
                  {{ shipGroup.giftMessage }}
                </ion-label>
              </ion-item>
              <ion-item lines="none" v-if="shipGroup.shippingInstructions">
                <ion-label>
                  <p>Shipping instructions</p>
                  {{ shipGroup.shippingInstructions }}
                </ion-label>
              </ion-item>
            </div>

            <div class="shipgroup-items">
              <ion-list-header>
                <ion-label>Items in Ship Group</ion-label>
              </ion-list-header>
              <ion-item v-for="item in shipGroup.items" :key="item.id">
                <ion-label>
                  {{ item.name }}
                  <p>SKU: {{ item.sku }}</p>
                </ion-label>
                <ion-note slot="end">{{ item.quantity }} units</ion-note>
              </ion-item>
            </div>

            <ion-list class="fulfillment">
              <ion-list-header>
                <ion-label>Fulfillment</ion-label>
              </ion-list-header>
              <ion-item>
                <ion-select label="Shipping method" interface="popover" placeholder="Select Shipping Method" :value="shipGroup.shipmentMethodTypeId || shipGroup.method">
                  <ion-select-option :value="shipGroup.shipmentMethodTypeId || shipGroup.method">
                    {{ shipGroup.method || 'Standard Shipping' }}
                  </ion-select-option>
                  <ion-select-option value="standard">Standard Shipping</ion-select-option>
                  <ion-select-option value="expedited">Expedited Shipping</ion-select-option>
                  <ion-select-option value="overnight">Overnight Delivery</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-select label="Carrier party" interface="popover" placeholder="Select Carrier" :value="shipGroup.carrier">
                  <ion-select-option :value="shipGroup.carrier">
                    {{ shipGroup.carrier || 'Select Carrier' }}
                  </ion-select-option>
                  <ion-select-option value="ups">UPS (United Parcel Service)</ion-select-option>
                  <ion-select-option value="fedex">FedEx</ion-select-option>
                  <ion-select-option value="usps">USPS (United States Postal Service)</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-select label="Shipping address" interface="popover" placeholder="Select Address" :value="shipGroup.contactMechId || 'primary'">
                  <ion-select-option value="primary">Primary Address</ion-select-option>
                  <ion-select-option value="secondary">Secondary Address</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-list>

            <div class="actions ion-padding-horizontal ion-padding-bottom">
              <ion-button fill="outline" color="primary">Broker</ion-button>
              <ion-button fill="outline" color="medium">Park</ion-button>
            </div>
          </ion-card>
        </template>

        <!-- Mock / Placeholder card if no ship groups are present -->
        <template v-else>
          <ion-card>
            <div class="shipgroup">
              <ion-item lines="none">
                <ion-label>
                  Ship Group #1
                  <p>Main Warehouse (MC-01)</p>
                  <p>3 items · 5 units</p>
                </ion-label>
                <ion-icon slot="end" :icon="chevronDown" />
              </ion-item>
            </div>

            <ion-progress-bar value="0.5" />

            <div class="selectable-attributes ion-padding-horizontal ion-padding-top">
              <ion-chip outline color="secondary">May Split</ion-chip>
              <ion-chip outline color="success">Gift</ion-chip>
              <ion-chip outline color="warning">High Priority</ion-chip>
            </div>
            <ion-item color="warning" class="ion-margin-horizontal ion-margin-vertical">
              <ion-label>
                Order on hold: Address validation failed
                <p>Verify shipping address task is open</p>
              </ion-label>
              <ion-button slot="end" fill="outline" color="dark" size="small">
                View task
              </ion-button>
            </ion-item>
            <div class="selected-attributes">
              <ion-item lines="none">
                <ion-label>
                  <p>Gift message</p>
                  Happy Birthday! Hope you have a great day!
                </ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-label>
                  <p>Shipping instructions</p>
                  Please leave the package at the back door.
                </ion-label>
              </ion-item>
            </div>

            <div class="lifecycle">
              <ion-item lines="none">
                <ion-label>Brokered</ion-label>
                <ion-note slot="end">2026-05-30 14:00</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Pick</ion-label>
                <ion-note slot="end">2026-05-30 15:30</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Pack</ion-label>
                <ion-note slot="end">2026-05-30 16:15</ion-note>
              </ion-item>
              <ion-item lines="none">
                <ion-label>Ship</ion-label>
                <ion-note slot="end">2026-05-30 17:00</ion-note>
              </ion-item>
            </div>

            <ion-list class="tems">
              <ion-list-header>
                <ion-label>Items in Ship Group</ion-label>
              </ion-list-header>
              <ion-item>
                <ion-label>
                  Special Edition Lip Balm
                  <p>SKU: LIP-BALM-001</p>
                </ion-label>
                <ion-note slot="end">2 units</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>
                  Hydrating Face Serum
                  <p>SKU: SERUM-HYD-002</p>
                </ion-label>
                <ion-note slot="end">1 unit</ion-note>
              </ion-item>
            </ion-list>

            <ion-list class="fulfillment">
              <ion-list-header>
                <ion-label>Fulfillment</ion-label>
              </ion-list-header>
              <ion-item>
                <ion-select label="Shipping method" interface="popover" placeholder="Select Shipping Method" value="standard">
                  <ion-select-option value="standard">Standard Shipping</ion-select-option>
                  <ion-select-option value="expedited">Expedited Shipping</ion-select-option>
                  <ion-select-option value="overnight">Overnight Delivery</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-select label="Carrier party" interface="popover" placeholder="Select Carrier" value="ups">
                  <ion-select-option value="ups">UPS (United Parcel Service)</ion-select-option>
                  <ion-select-option value="fedex">FedEx</ion-select-option>
                  <ion-select-option value="usps">USPS (United States Postal Service)</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Shipping address" interface="popover" placeholder="Select Address" value="primary">
                  <ion-select-option value="primary">125 Market Street, San Francisco, CA 94105</ion-select-option>
                  <ion-select-option value="secondary">456 Oak Avenue, New York, NY 10001</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-list>

            <div class="actions">
              <ion-button fill="outline" color="primary">Broker</ion-button>
              <ion-button fill="outline" color="medium">Park</ion-button>
            </div>
          </ion-card>
        </template>
      </div>

    </ion-content>

    <ion-content v-else-if="loading">
      <ion-list>
        <ion-item lines="none">
          <ion-label>Loading order...</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-slot:default v-else-if="error">
      <ErrorState
        title="Order failed to load"
        :message="error"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        title="Order not found"
        message="The selected order is not available in this workspace."
      />
    </ion-content>

    <ion-footer v-if="order">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button fill="outline" color="danger">Cancel</ion-button>
          <ion-button fill="outline" color="medium">Park</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="solid" color="warning">Return</ion-button>
          <ion-button fill="solid" color="primary">Release</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardTitle,
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
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  IonAccordion,
  IonAccordionGroup,
  IonThumbnail,
  IonCheckbox,
  IonFooter,
  IonPopover
} from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import { chevronDown, ellipsisVertical } from 'ionicons/icons';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';

const props = defineProps<{
  orderId: string;
}>();

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();
const productCache = useProductCacheStore();

const { isLoading: loading, error } = storeToRefs(orderDetailStore);

/**
 * View model — adapts the raw order master-detail payload to the shape this template
 * already binds, joining IDs to labels through the seed store and product cache. The
 * template graph and CSS are unchanged; only the data feeding it is real now.
 */
const order = computed(() => {
  const raw = orderDetailStore.current;
  if (!raw) return null;

  return {
    orderName: raw.orderName,
    id: raw.orderId,
    externalId: raw.externalId,
    status: seed.statusDescription(raw.statusId),
    channel: seed.enumDescription(raw.salesChannelEnumId),
    productStoreName: seed.productStoreName(raw.productStoreId),
    currency: raw.currencyUom,
    customerName: orderDetailStore.customerName,
    history: orderDetailStore.headerStatuses.map((entry: any) => ({
      id: entry.orderStatusId,
      label: seed.statusDescription(entry.statusId),
      detail: entry.statusUserLogin || '',
      changeReason: entry.changeReason || '',
      at: entry.statusDatetime
    })),
    identifications: (raw.identifications || []).map((identification: any) => ({
      orderIdentificationTypeId: identification.orderIdentificationTypeId,
      typeLabel: seed.orderIdentificationTypeDescription(identification.orderIdentificationTypeId),
      idValue: identification.idValue
    })),
    payments: (raw.paymentPreferences || []).map((payment: any) => ({
      id: payment.orderPaymentPreferenceId,
      paymentMethodTypeDesc: seed.paymentMethodDescription(payment.paymentMethodTypeId),
      amount: payment.maxAmount ?? payment.presentmentAmount,
      statusDesc: seed.statusDescription(payment.statusId)
    })),
    shipGroups: (raw.shipGroups || []).map((shipGroup: any) => ({
      id: shipGroup.shipGroupSeqId,
      facilityName: seed.facilityName(shipGroup.facilityId),
      itemSummary: shipGroupItemSummary(shipGroup),
      maySplit: shipGroup.maySplit,
      isGift: shipGroup.isGift,
      giftMessage: shipGroup.giftMessage,
      shippingInstructions: shipGroup.shippingInstructions,
      estimatedShipDate: shipGroup.estimatedShipDate,
      picklistDate: shipGroup.picklistDate,
      shipmentMethodTypeId: shipGroup.shipmentMethodTypeId,
      method: shipGroup.shipmentMethodTypeId,
      carrier: shipGroup.carrierPartyId,
      contactMechId: shipGroup.contactMechId,
      items: (shipGroup.items || []).map((item: any) => {
        const product = productCache.getProduct(item.productId);
        // parentProductName is the product title ("Abominable Hoodie"); productName is the
        // variant ("XS / Blue", ~= itemDescription). Prefer the title, then variant, then id.
        return {
          id: item.orderItemSeqId,
          name: product?.parentProductName || product?.productName || item.itemDescription || item.productId,
          sku: product?.sku || item.productId,
          quantity: item.quantity
        };
      })
    }))
  };
});

const customer = computed(() => {
  const raw = orderDetailStore.current;
  if (!raw) return undefined;
  const email = orderDetailStore.contactMechsByPurpose['ORDER_EMAIL']?.contactMech?.infoString;
  const telecomMech = (raw.contactMechs || []).find((mech: any) => mech.telecomNumber);
  const telecom = telecomMech?.telecomNumber;
  const phone = telecom
    ? [telecom.countryCode, telecom.areaCode, telecom.contactNumber].filter(Boolean).join(' ')
    : '';
  return { email, phone };
});

const billingAddress = computed(() => {
  const mech = orderDetailStore.contactMechsByPurpose['BILLING_LOCATION'];
  const lines = addressLines(mech?.postalAddress);
  return lines.length ? { lines } : undefined;
});

// Open order holds (WorkEfforts), labeled via seed; assignee name from the nested person.
const openHolds = computed(() => orderDetailStore.openHolds.map((hold: any) => {
  const person = hold.partyAssignments?.[0]?.person;
  return {
    id: hold.workEffortId,
    purpose: seed.enumDescription(hold.workEffortPurposeTypeId),
    name: hold.workEffortName,
    status: seed.statusDescription(hold.statusId),
    assignee: person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : '',
    at: hold.createdDate
  };
}));

const groupedItems = computed(() => {
  if (!order.value) return [];

  const groups: Record<string, {
    externalId: string;
    name: string;
    sku: string;
    imageUrl?: string;
    unitPrice: number;
    currency: string;
    totalQty: number;
    status: string;
    selected: boolean;
    items: Array<{
      orderItemSeqId: string;
      shipGroupSeqId: string;
      facilityId: string;
      facilityName: string;
      quantity: number;
      statusId: string;
      status: string;
      selected: boolean;
      unitPrice: number;
      returnedQty: number;
      returnableQty: number;
    }>;
  }> = {};

  (order.value.shipGroups || []).forEach((sg: any) => {
    (sg.items || []).forEach((item: any) => {
      const rawSg = orderDetailStore.current?.shipGroups?.find((g: any) => g.shipGroupSeqId === sg.id);
      const rawItem = rawSg?.items?.find((i: any) => i.orderItemSeqId === item.id);

      const externalId = rawItem?.externalId || item.sku || item.id;
      const unitPrice = Number(rawItem?.unitPrice || 0);
      const statusId = rawItem?.statusId || '';
      const status = seed.statusDescription(statusId);
      const returnedQty = orderDetailStore.returnedQtyByItemSeqId[item.id] || 0;
      const returnableQty = Math.max(0, Number(item.quantity || 0) - returnedQty);

      if (!groups[externalId]) {
        const product = productCache.getProduct(rawItem?.productId);
        groups[externalId] = {
          externalId,
          name: item.name,
          sku: item.sku,
          imageUrl: product?.mainImageUrl || '',
          unitPrice,
          currency: order.value.currency,
          totalQty: 0,
          status,
          selected: false,
          items: []
        };
      }

      groups[externalId].totalQty += Number(item.quantity || 0);
      groups[externalId].items.push({
        orderItemSeqId: item.id,
        shipGroupSeqId: sg.id,
        facilityId: sg.facilityId || '',
        facilityName: sg.facilityName || 'Facility',
        quantity: item.quantity,
        statusId,
        status,
        selected: false,
        unitPrice,
        returnedQty,
        returnableQty
      });
    });
  });

  return Object.values(groups);
});

const orderTotals = computed(() => {
  const raw = orderDetailStore.current;
  if (!raw) return { subtotal: 0, taxes: 0, shipping: 0, total: 0 };

  let subtotal = 0;
  let taxes = 0;
  let shipping = 0;

  (raw.shipGroups || []).forEach((sg: any) => {
    (sg.items || []).forEach((item: any) => {
      subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 0);
    });
  });

  (raw.adjustments || []).forEach((adj: any) => {
    const amount = Number(adj.amount || 0);
    if (adj.orderAdjustmentTypeId === 'SHIPPING_CHARGES') {
      shipping += amount;
    } else if (adj.orderAdjustmentTypeId === 'SALES_TAX') {
      taxes += amount;
    } else {
      taxes += amount;
    }
  });

  const total = raw.grandTotal || (subtotal + taxes + shipping);

  return { subtotal, taxes, shipping, total };
});

const selectedSegment = ref('items');

onMounted(() => loadOrder(props.orderId));
watch(() => props.orderId, (orderId) => loadOrder(orderId));

async function loadOrder(orderId: string) {
  await orderDetailStore.setCurrentOrder(orderId);
  // Rich product data (name/SKU/image): fetch only uncached products, never refetch.
  useProductMaster().init();
  await useProductMaster().prefetch(orderDetailStore.allItems.map((item: any) => item.productId));
}

function shipGroupItemSummary(shipGroup: any) {
  const items = shipGroup.items || [];
  const units = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  return `${items.length} ${items.length === 1 ? 'item' : 'items'} · ${units} ${units === 1 ? 'unit' : 'units'}`;
}

function addressLines(postalAddress: any): string[] {
  if (!postalAddress) return [];
  return [
    postalAddress.toName,
    postalAddress.address1,
    postalAddress.address2,
    [postalAddress.city, seed.geoName(postalAddress.stateProvinceGeoId), postalAddress.postalCode].filter(Boolean).join(', '),
    seed.geoName(postalAddress.countryGeoId)
  ].filter(Boolean) as string[];
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0));
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}
</script>

<style scoped>
ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions" "subtitle actions";
}

ion-card-header  ion-card-title {
  grid-area: title;
}

ion-card-header  ion-card-subtitle {
  grid-area: subtitle;
}

ion-card-header  ion-note,
ion-card-header  ion-button,
ion-card-header  ion-buttons {
  grid-area: actions;
  align-self: center;
}

.order-detail-header {
  display: grid;
  gap: var(--spacer-base);
  grid-template-columns: 1fr 357px;
  grid-template-rows: auto 1fr;
}

.order-detail-header>ion-item {
  grid-row: 1;
  grid-column: 1;
}

.order-detail-header-details {
  grid-row: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: start;
}

.order-detail-header-details ion-card {
  flex: 1 1 300px;
  max-width: 375px;
}

.order-detail-timeline {
  grid-column: 2;
  grid-row: span 2;
}


@media (min-width: 900px) {
  .order-detail-header {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
  }

  .order-detail-header-details {
    align-items: start;
    grid-template-columns: 1fr;
  }
}
</style>
