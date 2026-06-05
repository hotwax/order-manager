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
          <ion-badge slot="end" :color="commonUtil.getStatusColor(order.statusId)">{{ order.status }}</ion-badge>
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

      <div v-if="selectedSegment === 'items'">

        <ion-list>
          <ion-list-header>
            <ion-label>Items</ion-label>
          </ion-list-header>
          <ion-item lines="full" buttonDetail="false" button>
            <ion-checkbox :checked="areAllSelected" justify="start" label-placement="end" @ionChange="toggleSelectAll($event.detail.checked)">Select all</ion-checkbox>
            <ion-button slot="end" fill="outline" color="medium" @click.stop>
              Add items
            </ion-button>
          </ion-item>
          <ion-accordion-group>
            <ion-accordion v-for="group in groupedItems" :key="group.externalId" :value="group.externalId">
              <div slot="header" class="list-item order-item-rollup">
                <ion-item class="item-key-header" lines="none">
                  <ion-checkbox v-model="group.selected" justify="start" label-placement="end" @click.stop>
                    <ion-thumbnail v-if="group.imageUrl">
                      <img :src="group.imageUrl" alt="Product Image" />
                    </ion-thumbnail>
                    <ion-label>
                      {{ group.name }}
                      <p>SKU: {{ group.sku }}</p>
                      <p>Ext ID: {{ group.externalId }}</p>
                    </ion-label>
                  </ion-checkbox>
                </ion-item>
                
                <ion-label class="tablet">
                  {{ group.totalQty }} {{ group.totalQty === 1 ? 'unit' : 'units' }}
                  <p>Qty</p>
                </ion-label>
                
                <ion-label class="tablet">
                  <ion-badge :color="commonUtil.getStatusColor(group.statusId)">{{ group.status }}</ion-badge>
                  <p>Status</p>
                </ion-label>
                
                <ion-label class="ion-text-end">
                  {{ money(group.totalPrice, order.currency) }}
                  <p v-for="adj in getGroupAdjustments(group)" :key="adj.comment">
                    {{ adj.comment }}: {{ money(adj.amount, order.currency) }}
                  </p>
                </ion-label>
              </div>
              <div slot="content">
                <ion-list lines="none">
                  <div v-for="item in group.items" :key="item.orderItemSeqId" class="list-item order-item-row">
                    <ion-item lines="none">
                      <ion-checkbox v-model="item.selected" justify="start" label-placement="end">
                        <ion-label>
                          Item Seq: {{ item.orderItemSeqId }}
                          <p>Ship Group #{{ item.shipGroupSeqId }}</p>
                        </ion-label>
                      </ion-checkbox>
                    </ion-item>
                    
                    <ion-chip class="tablet" outline>
                      <ion-icon :icon="businessOutline"></ion-icon>
                      <ion-label>{{ item.facilityName }}</ion-label>
                    </ion-chip>

                    <ion-chip class="tablet" outline>
                      <ion-icon :icon="gitBranchOutline"></ion-icon>
                      <ion-label>{{ item.attributeCount }}</ion-label>
                    </ion-chip>
                    
                    <ion-badge class="tablet" :color="commonUtil.getStatusColor(item.statusId)">{{ item.status }}</ion-badge>

                    <ion-buttons>
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
                  </div>
                </ion-list>
              </div>
            </ion-accordion>
          </ion-accordion-group>
        </ion-list>

        <!-- Totals Card -->
        <ion-card class="totals">
          <ion-card-header>
            <ion-card-title>Totals</ion-card-title>
          </ion-card-header>
          <ion-list lines="none">
            <ion-item>
              <ion-label>Subtotal</ion-label>
              <ion-label slot="end">{{ money(orderTotals.subtotal, order.currency) }}</ion-label>
            </ion-item>
            <ion-item v-for="(amount, typeId) in orderTotals.adjustments" :key="typeId">
              <ion-label>{{ seed.orderAdjustmentTypeDescription(typeId) }}</ion-label>
              <ion-label slot="end">{{ money(amount, order.currency) }}</ion-label>
            </ion-item>
          </ion-list>
          <ion-item class="total-item">
            <ion-label>Grand Total</ion-label>
            <ion-label slot="end" color="dark">{{ money(orderTotals.total, order.currency) }}</ion-label>
          </ion-item>
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
              <ion-button fill="outline" color="primary" @click="brokerShipGroup(shipGroup.id)">Broker</ion-button>
              <ion-button fill="outline" color="medium" :disabled="!['ORDER_CREATED', 'ORDER_APPROVED'].includes(order.statusId)" @click="parkShipGroup(shipGroup.id)">Park</ion-button>
            </div>
          </ion-card>
        </template>

        <template v-else>
          <EmptyState
            title="No ship groups"
            message="There are no ship groups defined for this order."
          />
        </template>
      </div>

      <div v-if="selectedSegment === 'holds'">
        <div v-if="openHolds.length">
          <div class="list-item work-effort-row" v-for="hold in openHolds" :key="hold.id">
            <ion-item lines="none">
              <ion-label>
                {{ hold.id }}
                <p>{{ translate("ID") }}</p>
              </ion-label>
            </ion-item>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ hold.purposeTypeId || '-' }}
                <p>{{ translate("purpose") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ hold.description || '-' }}
                <p>{{ translate("description") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                <ion-badge :color="commonUtil.getStatusColor(hold.statusId)">{{ seed.statusDescription(hold.statusId) }}</ion-badge>
                <p>{{ translate("status") }}</p>
              </ion-label>
            </div>
          </div>
        </div>
        <ion-list v-if="!openHolds.length">
          <ion-item lines="none">
            <ion-label>{{ translate("No holds on this order") }}</ion-label>
          </ion-item>
        </ion-list>
      </div>

      <div v-if="selectedSegment === 'comms'">
        <div v-if="commEvents.length">
          <div class="list-item comm-event-row" v-for="ev in commEvents" :key="ev.id">
            <ion-item lines="none">
              <ion-label>
                {{ ev.id }}
                <p>{{ translate("ID") }}</p>
              </ion-label>
            </ion-item>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ ev.partyIdFrom || '-' }}
                <p>{{ translate("from") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ ev.partyIdTo || '-' }}
                <p>{{ translate("to") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center">
                {{ ev.content || '-' }}
                <p>{{ translate("content") }}</p>
              </ion-label>
            </div>
            <div class="tablet">
              <ion-label class="ion-text-center" v-if="ev.entryDate">
                {{ formatDate(ev.entryDate) }}
                <p>{{ translate("entry date") }}</p>
              </ion-label>
              <ion-label v-else>-</ion-label>
            </div>
          </div>
        </div>
        <ion-list v-if="!commEvents.length">
          <ion-item lines="none">
            <ion-label>{{ translate("No communication events for this order") }}</ion-label>
          </ion-item>
        </ion-list>
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
          <ion-button fill="outline" color="danger" :disabled="['ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(order.statusId)" @click="cancelOrder">Cancel</ion-button>
          <ion-button fill="outline" color="medium" :disabled="!['ORDER_CREATED', 'ORDER_APPROVED'].includes(order.statusId)" @click="parkFullOrder">Park</ion-button>
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
import { IonAccordion, IonAccordionGroup, IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonCheckbox, IonChip, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonNote, IonPage, IonPopover, IonProgressBar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonThumbnail, IonTitle, IonToolbar, alertController, modalController } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import { businessOutline, chevronDown, ellipsisVertical, gitBranchOutline } from 'ionicons/icons';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import FacilityModal from '@/components/FacilityModal.vue';
import RoutingGroupModal from '@/components/RoutingGroupModal.vue';
import { commonUtil, translate } from '@common';
import { showToast } from '@/utils';
import { useOrderTaskStore } from '@/store/orderTask';
import { useUserStore } from '@/store/user';

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
    statusId: raw.statusId,
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

const openHolds = computed(() => orderDetailStore.orderHeaderWorkEfforts.map((link: any) => {
  const we = link['org.apache.ofbiz.workeffort.workeffort.WorkEffort'] || link;
  return {
    id: link.workEffortId,
    purposeTypeId: we.workEffortPurposeTypeId || '',
    statusId: we.statusId || '',
    description: we.description || ''
  };
}));

const commEvents = computed(() => orderDetailStore.commEvents.map((ev: any) => ({
  id: ev.communicationEventId,
  partyIdFrom: ev.partyIdFrom,
  partyIdTo: ev.partyIdTo,
  content: ev.content,
  entryDate: ev.entryDate
})));

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
    totalPrice: number;
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
          totalQty: orderDetailStore.quantitiesByExternalId[externalId] || 0,
          totalPrice: orderDetailStore.totalsByExternalId[externalId] || 0,
          status,
          statusId,
          selected: false,
          items: []
        };
      }
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
        returnableQty,
        attributeCount: rawItem?.orderItemAttributes?.length || rawItem?.attributes?.length || rawItem?.orderItemAttributeList?.length || 0
      });
    });
  });

  return Object.values(groups);
});

const orderTotals = computed(() => orderDetailStore.totals);

const selectedSegment = ref('items');

watch(selectedSegment, (segment) => {
  if (!props.orderId) return;
  if (segment === 'holds') orderDetailStore.fetchOrderHeaderWorkEfforts(props.orderId);
  if (segment === 'comms') orderDetailStore.fetchCommEvents(props.orderId);
});

const areAllSelected = computed(() => {
  if (!groupedItems.value.length) return false;
  return groupedItems.value.every(group => group.selected) && 
         groupedItems.value.every(group => group.items.every(item => item.selected));
});

function toggleSelectAll(checked: boolean) {
  groupedItems.value.forEach(group => {
    group.selected = checked;
    group.items.forEach(item => {
      item.selected = checked;
    });
  });
}

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
  return commonUtil.formatCurrency(value, currency);
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}

function getGroupAdjustments(group: any) {
  const adjs = orderDetailStore.adjustmentsByExternalId[group.externalId] || {};
  return Object.entries(adjs)
    .map(([comment, amount]) => ({ comment, amount }))
    .filter(adj => adj.amount !== 0);
}

const orderTaskStore = useOrderTaskStore();
const userStore = useUserStore();

async function openFacilityModal(): Promise<string | null> {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
}

async function brokerShipGroup(shipGroupSeqId: string) {
  const productStoreId = userStore.getCurrentProductStore.productStoreId;
  const modal = await modalController.create({ component: RoutingGroupModal, componentProps: { productStoreId } });
  await modal.present();
  const { data: routingGroupId } = await modal.onWillDismiss();
  if (!routingGroupId) return;
  try {
    await orderTaskStore.brokerShipGroup({ routingGroupId, orderId: order.value!.id, shipGroupSeqId, productStoreId });
    await showToast(translate('Ship group brokered successfully.'));
    await loadOrder(order.value!.id);
  } catch {
    await showToast(translate('Failed to broker the ship group. Please try again.'));
  }
}

async function parkShipGroup(shipGroupSeqId: string) {
  const facilityId = await openFacilityModal();
  if (!facilityId) return;
  try {
    await orderTaskStore.parkOrder(order.value!.id, shipGroupSeqId, facilityId);
    await showToast(translate('Ship group successfully moved to parking.'));
    await loadOrder(order.value!.id);
  } catch {
    await showToast(translate('Failed to park the ship group. Please try again.'));
  }
}

async function cancelOrder() {
  const raw = orderDetailStore.current;
  if (!raw) return;
  const alert = await alertController.create({
    header: translate('Cancel order'),
    message: translate('Are you sure you want to cancel this order? This action cannot be undone.'),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          const items = (raw.shipGroups || []).flatMap((sg: any) =>
            (sg.items || []).map((item: any) => ({
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: sg.shipGroupSeqId,
            }))
          );
          try {
            await orderTaskStore.cancelOrder(raw.orderId, items);
            await showToast(translate('Order cancelled successfully.'));
            await loadOrder(raw.orderId);
          } catch {
            await showToast(translate('Failed to cancel the order. Please try again.'));
          }
        }
      }
    ]
  });
  await alert.present();
}

async function parkFullOrder() {
  const facilityId = await openFacilityModal();
  if (!facilityId) return;
  try {
    await orderTaskStore.parkOrderFull(order.value!.id, facilityId);
    await showToast(translate('Order successfully moved to parking.'));
    await loadOrder(order.value!.id);
  } catch {
    await showToast(translate('Failed to park the order. Please try again.'));
  }
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

.order-item-rollup {
  --columns-desktop: 4;
  --columns-tablet: 4;
  padding-inline-end: var(--spacer-base);
}

.order-item-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.work-effort-row {
  --columns-desktop: 4;
  --columns-tablet: 4;
}

.work-effort-row > ion-item {
  width: 100%;
}

.comm-event-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.comm-event-row > ion-item {
  width: 100%;
}
</style>
