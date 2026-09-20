<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/orders" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Order details') }}</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="loading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="order">
      <OrderSummaryHeader
        :order="order"
        :customer="customer"
        :customer-party-id="customerPartyId"
        :billing-address="billingAddress"
        :order-timeline="orderTimeline"
        :exchange-sources="exchangeSources"
        :can-view-returns="canViewReturns"
        :shopify-admin-url="shopifyAdminUrl"
        :risk-summary="riskSummary"
        :risk-fact-count="riskFactCount"
        :risk-counts="riskCounts"
        :get-status-color="commonUtil.getStatusColor"
        :risk-level-color="riskLevelColor"
        :format-date-time="formatDateTime"
        :translate="translate"
        @open-customer-contact="openCustomerContactModal"
        @open-locale-prompt="openLocalePrompt"
        @open-manage-identifications="openManageIdentificationsModal"
        @open-risk-details="openRiskDetails"
      />

      <ion-segment v-model="selectedSegment">
        <ion-segment-button value="items">
          <ion-label>{{ translate('Items') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="ship-groups">
          <ion-label>{{ translate('Shipgroups') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="holds">
          <ion-label>{{ translate('Holds') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="comms">
          <ion-label>{{ translate('Comms') }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <OrderItemsSegment
        v-if="selectedSegment === 'items'"
        :order="order"
        :are-all-selected="areAllSelected"
        :item-groups="itemGroups"
        :order-totals="orderTotals"
        :payment-received-total="paymentReceivedTotal"
        :payment-sections="paymentSections"
        :payment-net-amount="paymentNetAmount"
        :payment-net-color="paymentNetColor"
        :can-view-returns="canViewReturns"
        :can-request-inventory-transfer="canRequestInventoryTransfer"
        :is-kit="isKit"
        :get-product="getProduct"
        :product-feature-label="productFeatureLabel"
        :group-primary-identifier="groupPrimaryIdentifier"
        :group-secondary-identifier="groupSecondaryIdentifier"
        :group-location-label="groupLocationLabel"
        :attribute-chip-label="attributeChipLabel"
        :is-item-facility-action-disabled="isItemFacilityActionDisabled"
        :item-status-detail="itemStatusDetail"
        :item-line-total="itemLineTotal"
        :get-item-adjustment-rows="getItemAdjustmentRows"
        :get-group-adjustment-rows="getGroupAdjustmentRows"
        :is-inventory-transfer-request-eligible="isInventoryTransferRequestEligible"
        :is-item-cancel-allowed="isItemCancelAllowed"
        :carried-over-return-ids="carriedOverReturnIds"
        :money="money"
        :format-date-time="formatDateTime"
        :translate="translate"
        @toggle-select-all="toggleSelectAll"
        @open-add-item="openAddItemFromItemsSegment"
        @reject-and-release="rejectAndReleaseItem"
        @open-item-attributes="openItemAttributesModal"
        @request-inventory-transfer="requestInventoryTransferForItem"
        @cancel-single-item="cancelSingleItem"
      />

      <div v-if="selectedSegment === 'ship-groups'" class="ion-padding">
        <template v-if="order.shipGroups && order.shipGroups.length">
          <OrderShipGroupCard
            v-for="shipGroup in order.shipGroups.filter((sg: any) => sg.items?.length)"
            :key="shipGroup.id"
            :ship-group="shipGroup"
            :order="order"
            :is-ship-group-expanded="isShipGroupExpanded"
            :toggle-ship-group="toggleShipGroup"
            :ship-group-hold-task-count="shipGroupHoldTaskCount"
            :ship-group-hold-task-label="shipGroupHoldTaskLabel"
            :show-ship-group-hold-task="showShipGroupHoldTask"
            :is-item-selected="isItemSelected"
            :toggle-item-selection="toggleItemSelection"
            :is-ship-group-action-disabled="isShipGroupActionDisabled"
            :broker-ship-group="brokerShipGroup"
            :release-selected-items="releaseSelectedItems"
            :park-selected-items="parkSelectedItems"
            :reject-selected-items="rejectSelectedItems"
            :can-request-inventory-transfer="canRequestInventoryTransfer"
            :inventory-transfer-items-for-ship-group="inventoryTransferItemsForShipGroup"
            :request-inventory-transfers-for-ship-group="requestInventoryTransfersForShipGroup"
            :open-add-task-modal="openAddTaskModal"
            :open-add-item-modal="openAddItemModal"
            :view-inventory="viewInventory"
            :available-carriers="availableCarriers"
            :ship-group-distances="shipGroupDistances"
            :product-identification-pref="productIdentificationPref"
            :save-carrier-and-method="saveCarrierAndMethod"
            :update-ship-group="updateShipGroup"
            :load-order="loadOrder"
            :customer-party-id="customerPartyId"
          />
        </template>
        <template v-else>
          <EmptyState :title="translate('No ship groups')"
            :message="translate('There are no ship groups defined for this order.')" />
        </template>
      </div>

      <OrderHoldsSegment
        v-if="selectedSegment === 'holds'"
        :has-order-hold-tasks="hasOrderHoldTasks"
        :order-address-validation-tasks="orderAddressValidationTasks"
        :order-swap-tasks="orderSwapTasks"
        :order-fraud-tasks="orderFraudTasks"
        :order-hold-tasks="orderHoldTasks"
        :countries="seed.getCountries"
        :translate="translate"
        @completed="reloadHoldTasks"
        @create-hold-task="openCreateHoldTaskModal()"
      />

      <OrderCommsSegment
        v-if="selectedSegment === 'comms'"
        :comm-events="commEvents"
        :format-date="formatDate"
        :translate="translate"
      />
    </ion-content>

    <ion-content v-else-if="loading">
      <ion-list>
        <ion-item lines="none">
          <ion-label>{{ translate('Loading order...') }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-content v-slot:default v-else-if="error">
      <ErrorState :title="translate('Order failed to load')" :message="error" />
    </ion-content>

    <ion-content v-else>
      <EmptyState :title="translate('Order not found')"
        :message="translate('Order {orderId} was not found in the database. It may have been removed, or a stale search index is still listing it.', { orderId })" />
    </ion-content>

    <ion-footer v-if="order && selectedSegment === 'items'">
      <ion-toolbar>
        <!-- The footer is one engine-driven list (OrderActionValidator.getOrderFooterActions):
             status transitions (Approve, …) on the start, lifecycle and cancel actions
             (Cancel items, Cancel order, Return) on the end. Only VALID actions are present — an
             action that doesn't apply to the order simply isn't rendered. -->
        <ion-buttons slot="start">
          <ion-button v-for="action in footerActions.filter(a => a.kind === 'status')" :key="action.id"
            :color="action.color" :fill="action.fill" @click="runFooterAction(action)">
            {{ footerActionLabel(action) }}
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button v-for="action in footerActions.filter(a => a.kind === 'footer')" :key="action.id"
            :color="action.color" :fill="action.fill" @click="runFooterAction(action)">
            {{ footerActionLabel(action) }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>

    <ion-footer v-if="order && selectedSegment === 'holds' && hasOrderHoldTasks">
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button @click="openCreateHoldTaskModal()">{{ translate('Create hold task') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonAccordion, IonAccordionGroup, IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonChip, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonListHeader, IonMenuButton, IonModal, IonNote, IonPage, IonPopover, IonProgressBar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSkeletonText, IonTextarea, IonThumbnail, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { DateTime } from 'luxon';
import { arrowUndoOutline, calendarOutline, checkmarkDoneOutline, chevronDown, chevronUp, closeCircleOutline, closeOutline, compassOutline, createOutline, cubeOutline, documentTextOutline, downloadOutline, ellipsisVertical, giftOutline, mailOutline, openOutline, pauseCircleOutline, pulseOutline, saveOutline, sendOutline, shieldOutline, storefrontOutline, sunnyOutline, swapHorizontalOutline, ticketOutline, timeOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import { useOrderDistances } from '@/composables/useOrderDistances';
import router from '@/router';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import AddContactModal from '@/components/AddContactModal.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import OrderItemAttributesModal from '@/components/orders/OrderItemAttributesModal.vue';
import ManageOrderIdentificationsModal from '@/components/orders/ManageOrderIdentificationsModal.vue';
import RiskAssessmentModal from '@/components/orders/RiskAssessmentModal.vue';
import FacilityInventoryModal from '@/components/fulfillment/FacilityInventoryModal.vue';
import OrderSummaryHeader from '@/components/orders/OrderSummaryHeader.vue';
import OrderItemsSegment from '@/components/orders/OrderItemsSegment.vue';
import OrderShipGroupCard from '@/components/orders/OrderShipGroupCard.vue';
import OrderHoldsSegment from '@/components/orders/OrderHoldsSegment.vue';
import OrderCommsSegment from '@/components/orders/OrderCommsSegment.vue';
import { useOrderActions } from '@/composables/useOrderActions';
import { api, commonUtil, DxpShopifyImg, logger, translate } from '@common';
import { summarizeBrokeredFacilities } from '@/services/order';
import { isInventoryTransferEligibleItem } from '@/services/inventoryTransfers';
import { showToast, isKit, riskLevelColor, sentimentCounts } from '@/utils';
import { OrderActionValidator } from '@/utils/OrderActionValidator';
import { countShipGroupHoldTasks } from '@/utils/orderHoldTasks';
import { rollUpItemStatuses, type ItemStatusBadge } from '@/utils/itemStatusBadges';
import { shipGroupItemStates as itemStatesFor } from '@/utils/shipGroupItemStates';
import { shopifyAdminOrderUrl, singleShopIdForProductStore } from '@/utils/shopifyAdmin';
import { useOrderTaskStore } from '@/store/orderTask';
import { useUserStore } from '@/store/user';
import { useProductStore } from '@/store/productStore';
import { useCustomerStore } from '@/store/customer';
import type { CustomerContactMech } from '@/types/customer';
import Actions from '@/authorization/actions';

const props = defineProps<{
  orderId: string;
}>();

const orderDetailStore = useOrderDetailStore();
const seed = useSeedStore();
const productCache = useProductCacheStore();
const customerStore = useCustomerStore();
const userStore = useUserStore();
const canViewReturns = computed(() => userStore.hasPermission(Actions.APP_ORDER_RETURN_VIEW));
const canRequestInventoryTransfer = computed(() => userStore.hasPermission(Actions.APP_INVENTORY_TRANSFER_CREATE));

const loading = computed(() => orderDetailStore.loadingById(props.orderId));
const error = computed(() => orderDetailStore.errorById(props.orderId));

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);
const customerPartyId = computed(() => orderDetailStore.customerPartyIdByOrderId(props.orderId));

// Shopify Admin deep-link. Primary source is the order's own shopifyShopOrder record
// (the shop it actually came from — same source CloneOrderModal uses). That endpoint
// isn't exposed by the connector yet (hotwax/mantle-shopify-connector#381), so until
// it ships we fall back to inferring the shop from the order's product store, but ONLY
// when exactly one Shopify shop maps to that store (see fallbackShopIdByProductStore) —
// an ambiguous multi-shop store or an unknown store degrades to no link, so we never
// point at the wrong store. No shop / no myshopify domain also degrades to no link. The
// URL is a computed over the seed dataset so it appears reactively even when the
// boot-time shops load finishes after the order renders.
const shopifyOrderShopId = ref('');
// Successful resolutions are memoized (the order→shop mapping is immutable): force
// reloads skip the refetch — no link flicker, and a transient refetch failure can't
// erase an already-resolved link. Not set on error, so the next loadOrder retries.
let resolvedShopifyShop = { orderId: '', shopId: '' };

const shopifyOrderId = computed(() => {
  const identifications = orderDetailStore.orderById(props.orderId)?.identifications || [];
  return identifications.find((identification: any) => identification.orderIdentificationTypeId === 'SHOPIFY_ORD_ID')?.idValue ?? '';
});

// Interim fallback until the connector exposes GET oms/orders/{id}/shopifyShopOrder
// (hotwax/mantle-shopify-connector#381): infer the shop from the order's product store,
// but ONLY when exactly one Shopify shop maps to it — 0 or >1 matches → '' (no link),
// so we never link to the wrong store. Reactive over the seed dataset so it resolves
// once the boot-time shops load completes. Skipped once the record-based id is known.
const fallbackShopIdByProductStore = computed(() => {
  if (shopifyOrderShopId.value) return '';
  const productStoreId = orderDetailStore.orderById(props.orderId)?.productStoreId;
  if (!productStoreId) return '';
  const shops = seed.shopifyShops.ids.map((id: string) => seed.shopifyShops.byId[id]);
  return singleShopIdForProductStore(shops, productStoreId);
});

const shopifyAdminUrl = computed(() => {
  if (!shopifyOrderId.value) return '';
  const shopId = shopifyOrderShopId.value || fallbackShopIdByProductStore.value;
  if (!shopId) return '';
  const shop: any = seed.shopifyShops.byId[shopId];
  return shop ? shopifyAdminOrderUrl(shop.myshopifyDomain || shop.domain, shopifyOrderId.value) : '';
});

async function resolveShopifyOrderShop(orderId: string) {
  // Stale caller: a slow loadOrder for a previously viewed order must not clobber
  // the state of the order now on screen.
  if (orderId !== props.orderId) return;
  if (resolvedShopifyShop.orderId === orderId) {
    // Already resolved — re-assert rather than trust the ref: a racing resolver for
    // another order may have cleared it before its stale response was discarded.
    shopifyOrderShopId.value = resolvedShopifyShop.shopId;
    return;
  }
  shopifyOrderShopId.value = '';
  if (!shopifyOrderId.value) return;
  seed.loadShopifyShops();
  try {
    const resp = await api({ url: `oms/orders/${orderId}/shopifyShopOrder`, method: 'GET' });
    const rows: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs ?? []);
    if (orderId !== props.orderId) return; // stale response after navigating to another order
    shopifyOrderShopId.value = rows.find((row: any) => row.shopId)?.shopId || '';
    resolvedShopifyShop = { orderId, shopId: shopifyOrderShopId.value };
  } catch (error: any) {
    // 404 is expected until the connector exposes this endpoint
    // (hotwax/mantle-shopify-connector#381); the product-store fallback covers the
    // link meanwhile. Only surface genuinely unexpected failures.
    if (error?.response?.status !== 404) {
      logger.error('Failed to resolve the Shopify shop for the order', error);
    }
  }
}

/**
 * View model — delegates to the enriched domain model from orderDetailStore.
 */
const order = computed(() => orderDetailStore.enrichedOrderByOrderId(props.orderId));


const customer = computed(() => order.value?.customer);

const billingAddress = computed(() => order.value?.customer?.billingAddress);

// OrderFacilityChange reasons that describe where items went. Every other reason —
// the REPORT_VAR/REPORT_NO_VAR rejection reasons, damaged, inventory-not-found — is a
// rejection, and reads by where the items came from instead.
const FACILITY_CHANGE_LABELS: Record<string, string> = {
  BROKERED: 'Brokered',
  ALLOCATED: 'Allocated',
  RELEASED: 'Released',
  PARKED: 'Parked'
};

const FACILITY_CHANGE_ICONS: Record<string, string> = {
  BROKERED: compassOutline,
  ALLOCATED: compassOutline,
  RELEASED: storefrontOutline,
  PARKED: pauseCircleOutline
};

const orderTimeline = computed(() => order.value?.timeline || []);

const timelineByShipGroup = computed(() => orderDetailStore.timelineByShipGroupByOrderId(props.orderId));

const expandedShipGroupIds = ref<Set<string>>(new Set());
const collapsibleObservers = new WeakMap<HTMLElement, ResizeObserver>();

function updateCollapsibleHeight(el: HTMLElement) {
  const update = () => {
    el.style.setProperty('--ship-group-collapsible-height', `${el.scrollHeight}px`);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(update);
    return;
  }

  update();
}

const vCollapsible = {
  mounted(el: HTMLElement) {
    updateCollapsibleHeight(el);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => updateCollapsibleHeight(el));
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    collapsibleObservers.set(el, observer);
  },
  updated(el: HTMLElement) {
    updateCollapsibleHeight(el);
  },
  unmounted(el: HTMLElement) {
    collapsibleObservers.get(el)?.disconnect();
    collapsibleObservers.delete(el);
  }
};

function isVirtualFacility(shipGroup: any): boolean {
  if (!shipGroup.facilityId) return true;
  return (
    shipGroup.facilityParentTypeId === 'VIRTUAL_FACILITY' ||
    shipGroup.facilityTypeId === 'VIRTUAL_FACILITY'
  );
}

/**
 * A ship group sold over the counter. OMS treats POS_COMPLETED as needing no
 * fulfillment at all (`requiresFulfillment` in OrderServices get#SalesOrder), so the
 * group has no carrier, no ship-to address, and no brokering/pick/pack/ship dates —
 * the goods left with the customer.
 */
function isPosCompleted(shipGroup: any): boolean {
  return shipGroup?.shipmentMethodTypeId === 'POS_COMPLETED';
}

/** When the ship group reached its facility, or undefined if nothing recorded it. */
function shipGroupBrokeredDate(shipGroup: any): string | number | undefined {
  return shipGroup.firstBrokeredDate;
}

/**
 * Brokered == the items sit at a physical facility. This is the rule the action engine
 * already applies (`OrderActionValidator.isShipGroupBrokered`); the lifecycle display
 * has to apply it too, because a group can be brokered with no date to show.
 */
function isShipGroupBrokered(shipGroup: any): boolean {
  return shipGroup.isBrokered ?? (!isVirtualFacility(shipGroup) || !!shipGroup.firstBrokeredDate);
}

/** Item-derived state for this group; see utils/shipGroupItemStates for why it is the authority. */
function shipGroupItemStates(shipGroup: any) {
  return itemStatesFor(shipGroup?.items);
}

/**
 * A stopped group is read-only: its carrier, method, dates, gift message and instructions
 * all describe a shipment that is no longer going to change. Reads the same `settled` the
 * card's label uses, so the two cannot disagree.
 */
function isShipGroupReadOnly(shipGroup: any): boolean {
  return shipGroup.isReadOnly ?? shipGroupItemStates(shipGroup).settled;
}

function shipGroupProgress(shipGroup: any): number {
  return shipGroup.progress ?? 0;
}

/** A step that never got a date: still to come, or already behind us and simply not recorded. */
function lifecycleStepNote(shipGroup: any, date: any): string {
  return formatTime(date)
    || (shipGroupItemStates(shipGroup).settled ? translate('No date') : translate('Pending'));
}

/** The brokered step's time, or why there is none: not brokered yet vs. brokered untimed. */
function brokeredStepNote(shipGroup: any): string {
  return formatTime(shipGroupBrokeredDate(shipGroup))
    || (isShipGroupBrokered(shipGroup) || shipGroupItemStates(shipGroup).settled
      ? translate('No date')
      : translate('Pending'));
}

function isShipGroupExpanded(shipGroupId: string): boolean {
  return expandedShipGroupIds.value.has(shipGroupId);
}

/** Whether the item detail block is showing — always, for a counter sale with no toggle. */
function isShipGroupDetailsOpen(shipGroup: any): boolean {
  return isPosCompleted(shipGroup) || isShipGroupExpanded(shipGroup.id);
}


function toggleShipGroup(shipGroupId: string) {
  const next = new Set(expandedShipGroupIds.value);
  if (next.has(shipGroupId)) {
    next.delete(shipGroupId);
  } else {
    next.add(shipGroupId);
  }
  expandedShipGroupIds.value = next;
}

function shipGroupHeaderTitle(shipGroup: any): string {
  return shipGroup.headerTitle || `${shipGroup.id} ${shipGroup.facilityName || translate('Facility Name')}`;
}

function shipGroupStatusLabel(shipGroup: any): string {
  return shipGroup.statusLabel || '';
}

function hasSelectableShipGroupOptions(shipGroup: any): boolean {
  if (isShipGroupReadOnly(shipGroup)) return false;
  return !shipGroup.giftMessage
    || (!shipGroup.shipAfterDate && !shipGroup.shipByDate)
    || (!shipGroup.estimatedShipDate && !shipGroup.estimatedDeliveryDate)
    || !shipGroup.shippingInstructions;
}

function hasSelectedShipGroupOptions(shipGroup: any): boolean {
  return !!shipGroup.giftMessage
    || !!shipGroup.shipAfterDate
    || !!shipGroup.shipByDate
    || !!shipGroup.estimatedShipDate
    || !!shipGroup.estimatedDeliveryDate
    || !!shipGroup.shippingInstructions;
}

function shipGroupPreviewItems(shipGroup: any) {
  return (shipGroup.items || []).slice(0, 3);
}

function carrierName(carrierPartyId: string): string {
  const carrier = availableCarriers.value.find((party: any) => party.partyId === carrierPartyId);
  return carrier ? [carrier.firstName, carrier.lastName].filter(Boolean).join(' ') || carrier.groupName || carrier.partyId : '';
}

function shippingMethodLabel(shipmentMethodTypeId: string): string {
  return shipmentMethodTypeId ? seed.shipmentMethodDescription(shipmentMethodTypeId) : '';
}

// ── Holds segment — order-scoped task cards ───────────────────────────────────
const orderAddressValidationTasks = computed(() => orderTaskStore.getOrderAddressValidationTasksByOrderId(props.orderId));
const orderSwapTasks = computed(() => orderTaskStore.getOrderSwapTasksByOrderId(props.orderId));
const orderFraudTasks = computed(() => orderTaskStore.getOrderFraudTasksByOrderId(props.orderId));
const orderHoldTasks = computed(() => orderTaskStore.getOrderHoldTasksByOrderId(props.orderId));
const hasOrderHoldTasks = computed(() =>
  orderAddressValidationTasks.value.length > 0
  || orderSwapTasks.value.length > 0
  || orderFraudTasks.value.length > 0
  || orderHoldTasks.value.length > 0
);

const orderShipGroupHoldTasks = computed(() => [
  ...orderAddressValidationTasks.value,
  ...orderSwapTasks.value,
  ...orderFraudTasks.value,
  ...orderHoldTasks.value,
]);

function shipGroupHoldTaskCount(shipGroup: any): number {
  return countShipGroupHoldTasks(orderShipGroupHoldTasks.value, shipGroup.id);
}

function shipGroupHoldTaskLabel(shipGroup: any): string {
  const count = shipGroupHoldTaskCount(shipGroup);
  return `${count} ${translate(count === 1 ? 'hold task' : 'hold tasks')}`;
}

function showShipGroupHoldTask() {
  selectedSegment.value = 'holds';
}

function reloadHoldTasks() {
  return orderTaskStore.fetchOrderHoldTasks(props.orderId);
}

const commEvents = computed(() => (orderDetailStore.commEventsByOrderId[props.orderId] || []).map((ev: any) => ({
  id: ev.communicationEventId,
  partyIdFrom: ev.partyIdFrom,
  partyIdTo: ev.partyIdTo,
  content: ev.content,
  entryDate: ev.entryDate
})));

const selectedItemIds = ref<Set<string>>(new Set());

const groupedItems = computed(() => {
  const groups = order.value?.groupedItems || [];
  return groups.map((group: any) => {
    const items = (group.items || []).map((item: any) => ({
      ...item,
      get selected() { return selectedItemIds.value.has(item.orderItemSeqId); },
      set selected(v: boolean) { v ? selectedItemIds.value.add(item.orderItemSeqId) : selectedItemIds.value.delete(item.orderItemSeqId); }
    }));
    return {
      ...group,
      items,
      get selected() { return items.length > 0 && items.every((i: any) => selectedItemIds.value.has(i.orderItemSeqId)); },
      set selected(v: boolean) { items.forEach((i: any) => v ? selectedItemIds.value.add(i.orderItemSeqId) : selectedItemIds.value.delete(i.orderItemSeqId)); }
    };
  });
});

// Items are rolled up by external id so a product split across ship groups reads as one row. A
// group backed by a single order item has nothing to roll up, so it exposes that item and the
// row is rendered without the accordion instead of hiding one row behind a disclosure.
const itemGroups = computed(() => groupedItems.value.map((group: any) => ({
  group,
  soleItem: group.items.length === 1 ? group.items[0] : null
})));

const orderTotals = computed(() => order.value?.totals || { subtotal: 0, adjustments: {}, includedAdjustments: {}, total: 0 });

const riskAssessments = computed(() => orderDetailStore.riskAssessmentsByOrderId[props.orderId] || []);
const riskFacts = computed(() => order.value?.risk?.facts || []);
const riskCounts = computed(() => order.value?.risk?.counts || { negative: 0, positive: 0, neutral: 0 });
const riskFactCount = computed(() => order.value?.risk?.factCount || 0);

async function openRiskDetails() {
  const modal = await modalController.create({
    component: RiskAssessmentModal,
    componentProps: { risks: riskAssessments.value },
  });
  await modal.present();
}

const riskSummary = computed(() => order.value?.risk || {
  hasRiskSignal: false,
  recommendation: translate('No recommendation'),
  level: translate('No risk level'),
  facts: [],
  counts: { negative: 0, positive: 0, neutral: 0 },
  factCount: 0
});

// Only preferences that actually collected money count — refunded, cancelled and
// declined preferences would otherwise inflate this past the grand total.
const paymentReceivedTotal = computed(() => order.value?.payments?.receivedTotal || 0);

// Payment card sections: one divider per distinct preference status, in order of first
// appearance, with refunded pinned to the bottom (stable sort keeps the rest in place).
const paymentSections = computed(() => order.value?.payments?.sections || []);

// Net collected right now: approved/settled/received preferences minus refunded ones.
// Cancelled/declined/not-received preferences never contribute in either direction.
const paymentNetAmount = computed(() => order.value?.payments?.netAmount || 0);

// Every non-cancelled item fully returned (by quantity).
const allItemsReturned = computed(() => order.value?.payments?.allItemsReturned || false);

// Negative net = more refunded than collected. Positive net on a fully-returned order =
// money still held for goods that all came back — likely a refund owed.
const paymentNetColor = computed(() => order.value?.payments?.netColor);


const selectedSegment = ref('items');

watch(selectedSegment, (segment) => {
  if (!props.orderId) return;
  if (segment === 'holds') {
    orderTaskStore.fetchOrderHoldTasks(props.orderId);
    orderDetailStore.fetchRiskAssessments(props.orderId);
  }
  if (segment === 'comms') orderDetailStore.fetchCommEvents(props.orderId);
});

const areAllSelected = computed(() => {
  if (!groupedItems.value.length) return false;
  return groupedItems.value.every(group =>
    group.items.every(item => selectedItemIds.value.has(item.orderItemSeqId))
  );
});

const selectedItems = computed(() =>
  groupedItems.value.flatMap(group =>
    group.items.filter(item => selectedItemIds.value.has(item.orderItemSeqId))
  )
);

const allGroupedItems = computed(() =>
  groupedItems.value.flatMap((group: any) => group.items)
);

function shipGroupById(shipGroupId: string) {
  return (order.value?.shipGroups || []).find((shipGroup: any) => shipGroup.id === shipGroupId) || null;
}

/**
 * The items a ship-group action applies to. Selection NARROWS the action;
 * with nothing checked the action covers the whole ship group, so the buttons
 * never sit disabled just because the user has not ticked a row.
 */
function actionableItemObjectsForShipGroup(shipGroup: any) {
  const items = allGroupedItems.value.filter((item: any) => item.shipGroupSeqId === shipGroup.id);
  const itemIds = new Set(selectedItemsForShipGroup(shipGroup.id));
  if (!itemIds.size) return items;
  return items.filter((item: any) => itemIds.has(item.orderItemSeqId));
}

function shipGroupActionContext(shipGroup: any) {
  return {
    isVirtual: isVirtualFacility(shipGroup),
    allItems: allGroupedItems.value
  };
}

function shipGroupActionValidation(shipGroup: any, actionId: any) {
  if (!order.value) return { allowed: false };
  return OrderActionValidator.validateShipGroupAction(
    order.value,
    shipGroup,
    actionId,
    actionableItemObjectsForShipGroup(shipGroup),
    shipGroupActionContext(shipGroup)
  );
}

function isShipGroupActionDisabled(shipGroup: any, actionId: any) {
  if (shipGroup.actions) {
    if (actionId === 'CANCEL') return !shipGroup.actions.canCancel;
    if (actionId === 'RELEASE') return !shipGroup.actions.canRelease;
    if (actionId === 'REASSIGN_FACILITY') return !shipGroup.actions.canReassignFacility;
    if (actionId === 'EDIT_SHIPPING_METHOD' || actionId === 'EDIT_CARRIER_METHOD') return !shipGroup.actions.canEditShippingMethod;
  }
  return !shipGroupActionValidation(shipGroup, actionId).allowed;
}

function isVirtualFacilityForItem(item: any) {
  const shipGroup = shipGroupById(item.shipGroupSeqId);
  return shipGroup ? isVirtualFacility(shipGroup) : !item.facilityId;
}

function inventoryTransferItem(item: any) {
  const group = groupedItems.value.find((candidate: any) =>
    candidate.items.some((groupItem: any) => groupItem.orderItemSeqId === item.orderItemSeqId));
  return {
    ...item,
    productId: group?.productId || '',
    name: group ? groupPrimaryIdentifier(group) : `${translate('Item')} ${item.orderItemSeqId}`,
    sku: group?.sku || group?.productId || '',
    imageUrl: getProduct(group?.productId)?.mainImageUrl,
  };
}

function isInventoryTransferRequestEligible(item: any) {
  return item.actions?.canTransfer ?? isInventoryTransferEligibleItem(inventoryTransferItem(item), isVirtualFacilityForItem(item));
}

function inventoryTransferItemsForShipGroup(shipGroup: any) {
  if (isVirtualFacility(shipGroup)) return [];
  return actionableItemObjectsForShipGroup(shipGroup)
    .filter((item: any) => isInventoryTransferRequestEligible(item));
}

function itemActionContext(item: any) {
  const allowedTransitions = seed.allowedTransitions(item.statusId);
  return {
    isVirtual: isVirtualFacilityForItem(item),
    itemAllowedToStatusIds: new Set(allowedTransitions.map((transition: any) => transition.toStatusId)),
    allItems: allGroupedItems.value
  };
}

function itemFacilityActionValidation(item: any) {
  if (!order.value) return { allowed: false };
  const shipGroup = shipGroupById(item.shipGroupSeqId);
  if (shipGroup && isVirtualFacility(shipGroup)) {
    return OrderActionValidator.validateShipGroupAction(
      order.value,
      shipGroup,
      'RELEASE',
      [item],
      shipGroupActionContext(shipGroup)
    );
  }

  return OrderActionValidator.validateItemAction(
    order.value,
    item,
    'REJECT_AND_RELEASE',
    itemActionContext(item)
  );
}

function isItemFacilityActionDisabled(item: any) {
  return item.actions ? !item.actions.canRejectAndRelease : !itemFacilityActionValidation(item).allowed;
}

/**
 * Whether this row may offer Cancel. A non-terminal item is not enough: the validator also
 * refuses once the ORDER is terminal, when the store's cancelAllowedWhen policy rules out the
 * ship group's phase, and when the seed transition table has no ITEM_CANCELLED edge from the
 * item's current status. Reading the same validator the action itself runs is what keeps the
 * button from offering a cancellation the backend will reject.
 */
function itemCancelValidation(item: any) {
  if (!order.value) return { allowed: false, reason: 'Order is not loaded.' };
  return OrderActionValidator.validateItemAction(order.value, item, 'CANCEL_ITEM', itemActionContext(item));
}

function isItemCancelAllowed(item: any) {
  return item.actions?.canCancel ?? itemCancelValidation(item).allowed;
}

function toggleSelectAll(checked: boolean) {
  if (checked) {
    groupedItems.value.forEach(group =>
      group.items.forEach(item => selectedItemIds.value.add(item.orderItemSeqId))
    );
  } else {
    selectedItemIds.value.clear();
  }
}

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function shipGroupProductIdentification(identificationPref: string, item: any): string {
  const product = getProduct(item.productId);
  return product ? commonUtil.getProductIdentificationValue(identificationPref, product) : '';
}

// Ionic caches routed page instances: navigating /orders/A → /orders/B and back re-activates
// A's instance without re-mounting, while the store's currentOrderId still points at B. Load on
// every view activation (onIonViewWillEnter fires on first enter and on each re-enter; the store
// skips the refetch when the order is already loaded) so the page re-asserts its own order.
onIonViewWillEnter(() => loadOrder(props.orderId));
watch(() => props.orderId, (orderId) => loadOrder(orderId));

watch(customerPartyId, (partyId) => {
  if (partyId) customerStore.loadCustomerProfile(partyId);
}, { immediate: true });

// Orders this one was exchanged from (OrderItemAssoc rows of type EXCHANGE, pointing at the
// original via toOrderId). Distinct, and never the order itself.
const exchangeSourceOrderIds = computed(() => [...new Set(
  (orderDetailStore.orderById(props.orderId)?.itemAssocs || [])
    .filter((assoc: any) => assoc.orderItemAssocTypeId === 'EXCHANGE' && assoc.toOrderId && assoc.toOrderId !== props.orderId)
    .map((assoc: any) => assoc.toOrderId as string)
)]);

// Lazily hydrate each original order (cached in the store by id) so the Source card can show
// its name and the returns that were processed as part of the exchange.
watch(exchangeSourceOrderIds, (ids) => {
  ids.forEach((id) => orderDetailStore.fetchOrder(id));
}, { immediate: true });

const exchangeSources = computed(() => exchangeSourceOrderIds.value.map((orderId) => {
  const entry = orderDetailStore.byOrderId[orderId];
  const payload = entry?.payload;
  return {
    orderId,
    loading: !entry || entry.status === 'loading' || entry.status === 'idle',
    orderName: payload?.orderName || payload?.externalId || orderId,
    returnIds: [...new Set((payload?.returnItems || []).map((item: any) => item.returnId).filter(Boolean))] as string[]
  };
}));

// Returns behind an exchange-credit/payment OPP. The returnId is NOT derivable from the OPP's
// ref numbers (they carry Shopify txn ids), so the source of truth is the original order's
// returnItems. When this order was exchanged from several originals, an OPP with a
// parentRefNum narrows to the original whose refunded OPP carries that same manualRefNum;
// otherwise every source's returns are listed rather than guessing (amount/id-adjacency
// heuristics proved unreliable against real data).
function carriedOverReturnIds(payment: any): string[] {
  if (!['EXCHANGE_CREDIT', 'EXCHANGE_PAYMENT'].includes(payment.paymentMethodTypeId)) return [];

  let sources = exchangeSources.value;
  if (payment.parentRefNum && sources.length > 1) {
    const matching = sources.filter((source) =>
      (orderDetailStore.byOrderId[source.orderId]?.payload?.paymentPreferences || []).some(
        (opp: any) => opp.manualRefNum === payment.parentRefNum
      )
    );
    if (matching.length) sources = matching;
  }
  return [...new Set(sources.flatMap((source) => source.returnIds))];
}

// Rejection reasons live under these two enum parent types and are otherwise only
// loaded when the Reject items modal opens — without them a timeline rejection reads
// as its raw id ("REJ_RSN_DAMAGED"). Loading is idempotent per enum type, so the guard
// just avoids re-listing the child types on every order.
const REJECTION_REASON_PARENT_TYPES = ['REPORT_AN_ISSUE', 'RPRT_NO_VAR_LOG'];

function loadRejectionReasonEnums() {
  REJECTION_REASON_PARENT_TYPES
    .filter((parentTypeId) => !seed.getEnumsByParentType(parentTypeId).length)
    .forEach((parentTypeId) => {
      seed.loadEnumsByParentType(parentTypeId).catch((error: any) =>
        logger.debug(`Rejection reason enums for ${parentTypeId} unavailable`, error)
      );
    });
}

async function loadOrder(orderId: string, force = false) {
  await orderDetailStore.loadOrderAggregate(orderId, { force });
  loadRejectionReasonEnums();
  resolveShopifyOrderShop(orderId);
  const partyId = orderDetailStore.customerPartyIdByOrderId(orderId);
  if (partyId) {
    await customerStore.loadCustomerProfile(partyId, force);
  }
  useProductMaster().init();
  const allItems = (orderDetailStore.orderById(orderId)?.shipGroups || []).flatMap((sg: any) => sg.items || []);
  await useProductMaster().prefetch(allItems.map((item: any) => item.productId));
  await Promise.all([
    orderDetailStore.fetchShippingMethods(),
    orderDetailStore.fetchCarrierParties(),
  ]);
}

async function openCustomerContactModal(contactMechTypeId: string, contactMechPurposeTypeId: string) {
  const partyId = customerPartyId.value;
  if (!partyId) {
    await showToast(translate('Customer is not available for this order.'));
    return;
  }

  const modal = await modalController.create({
    component: AddContactModal,
    componentProps: { contactMechTypeId, contactMechPurposeTypeId },
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role !== 'confirm' || !data) return;

  try {
    await (customerStore as any).addContact(partyId, contactMechTypeId, data);
    if (order.value?.id) await loadOrder(order.value.id, true);
    await showToast(translate('Customer contact updated successfully.'));
  } catch {
    await showToast(translate('Failed to update customer contact. Please try again.'));
  }
}

async function openLocalePrompt() {
  if (!order.value?.id) return;

  const alert = await alertController.create({
    header: translate('Locale'),
    inputs: [{
      name: 'localeString',
      type: 'text',
      placeholder: 'en-US',
    }],
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Save'),
        role: 'confirm',
        handler: (data) => {
          const localeString = String(data?.localeString || '').trim();
          if (!localeString) return false;
          saveOrderLocale(localeString);
          return true;
        },
      },
    ],
  });
  await alert.present();
}

async function saveOrderLocale(localeString: string) {
  if (!order.value?.id) return;

  try {
    await api({
      url: `oms/orders/${order.value.id}`,
      method: 'PUT',
      data: { orderId: order.value.id, localeString },
    });
    await loadOrder(order.value.id, true);
    await showToast(translate('Order locale updated successfully.'));
  } catch {
    await showToast(translate('Failed to update order locale. Please try again.'));
  }
}

const availableCarriers = computed(() =>
  [...orderDetailStore.carrierParties].sort((a, b) => {
    const nameA = ([a.firstName, a.lastName].filter(Boolean).join(' ') || a.groupName || a.partyId).toLowerCase();
    const nameB = ([b.firstName, b.lastName].filter(Boolean).join(' ') || b.groupName || b.partyId).toLowerCase();
    return nameA.localeCompare(nameB);
  })
);

// Local reactive selection state per ship group — keyed by shipGroupSeqId.
// This allows the carrier/method dropdowns to update immediately without waiting
// for the API round-trip + loadOrder.
const shipGroupSelection = ref<Record<string, { carrierId: string; methodId: string }>>({});

// Item checkbox selection per ship group — keyed by shipGroupSeqId, value is Set of item ids.
const selectedShipGroupItems = ref<Record<string, Set<string>>>({});

function isItemSelected(shipGroupId: string, itemId: string) {
  return selectedShipGroupItems.value[shipGroupId]?.has(itemId) ?? false;
}

function toggleItemSelection(shipGroupId: string, itemId: string, checked: boolean) {
  if (!selectedShipGroupItems.value[shipGroupId]) {
    selectedShipGroupItems.value[shipGroupId] = new Set();
  }
  if (checked) {
    selectedShipGroupItems.value[shipGroupId].add(itemId);
  } else {
    selectedShipGroupItems.value[shipGroupId].delete(itemId);
  }
}

function selectedItemsForShipGroup(shipGroupId: string): string[] {
  return Array.from(selectedShipGroupItems.value[shipGroupId] ?? []);
}

function getSelection(shipGroupId: string, shipGroup: any) {
  if (!shipGroupSelection.value[shipGroupId]) {
    shipGroupSelection.value[shipGroupId] = {
      carrierId: shipGroup.carrier ?? '',
      methodId: shipGroup.shipmentMethodTypeId ?? '',
    };
  }
  return shipGroupSelection.value[shipGroupId];
}

const { shipGroupDistances } = useOrderDistances(() => props.orderId, order, isVirtualFacility);

const {
  showUnavailableAction,
  brokerShipGroup,
  cancelOrderItems,
  cancelSingleItem,
  rejectAndReleaseItem,
  cancelOrder,
  changeOrderStatus,
  runOrderStatusAction,
  startReturn,
  viewInventory,
  openCloneOrderModal,
  footerActions,
  runFooterAction,
  footerActionLabel,
  openAddTaskModal,
  openCreateHoldTaskModal,
  openAddItemModal,
  parkSelectedItems,
  rejectSelectedItems,
  releaseSelectedItems,
  openInventoryTransferRequestModal,
  requestInventoryTransferForItem,
  requestInventoryTransfersForShipGroup,
  saveCarrierAndMethod,
  updateShipGroup,
} = useOrderActions({
  orderId: props.orderId,
  order,
  loadOrder,
  selectedShipGroupItems,
  selectedItems,
  selectedItemIds,
  groupedItems,
  openFacilityModal,
  openFacilityInventoryModal,
  shipGroupById,
  actionableItemObjectsForShipGroup,
  shipGroupActionValidation,
  itemFacilityActionValidation,
  itemCancelValidation,
  isVirtualFacilityForItem,
  inventoryTransferItem,
  selectedSegment,
  reloadHoldTasks,
});

// Keep local state in sync when order reloads (e.g. after save)
watch(
  () => order.value?.shipGroups,
  (shipGroups) => {
    (shipGroups || []).forEach((sg: any) => {
      shipGroupSelection.value[sg.id] = {
        carrierId: sg.carrier ?? '',
        methodId: sg.shipmentMethodTypeId ?? '',
      };
    });
  },
  { immediate: true }
);


function methodsForCarrier(carrierPartyId: string) {
  return [...orderDetailStore.shippingMethodsByCarrier(carrierPartyId)].sort((a, b) =>
    Number(a.sequenceNumber ?? Infinity) - Number(b.sequenceNumber ?? Infinity)
  );
}

async function onCarrierChange(shipGroupId: string, carrierPartyId: string) {
  // Immediately update local state so methods dropdown re-renders with new carrier's methods
  // and method resets to empty (shows placeholder)
  shipGroupSelection.value[shipGroupId] = { carrierId: carrierPartyId, methodId: '' };
}

async function onMethodChange(shipGroupId: string, shipmentMethodTypeId: string) {
  const sel = shipGroupSelection.value[shipGroupId];
  if (!sel?.carrierId || !shipmentMethodTypeId) return;
  sel.methodId = shipmentMethodTypeId;
  await saveCarrierAndMethod(shipGroupId, shipmentMethodTypeId, sel.carrierId);
}

// Ship group updates
async function saveGiftMessage(shipGroup: any, message: string) {
  try {
    await updateShipGroup(shipGroup.id, { giftMessage: message });
    await showToast(translate('Gift message saved.'));
  } catch {
    await showToast(translate('Failed to save gift message.'));
  }
}

async function clearGiftMessage(shipGroup: any) {
  try {
    await updateShipGroup(shipGroup.id, { giftMessage: null });
    await showToast(translate('Gift message cleared.'));
  } catch {
    await showToast(translate('Failed to clear gift message.'));
  }
}

async function saveShippingDates(shipGroup: any, dates: { shipAfterDate: string; shipByDate: string }) {
  try {
    await updateShipGroup(shipGroup.id, {
      shipAfterDate: dates.shipAfterDate || null,
      shipByDate: dates.shipByDate || null,
    });
    await showToast(translate('Shipping dates saved.'));
  } catch {
    await showToast(translate('Failed to save shipping dates.'));
  }
}

async function saveDeliveryDates(shipGroup: any, dates: { estimatedShipDate: string; estimatedDeliveryDate: string }) {
  try {
    await updateShipGroup(shipGroup.id, {
      estimatedShipDate: dates.estimatedShipDate || null,
      estimatedDeliveryDate: dates.estimatedDeliveryDate || null,
    });
    await showToast(translate('Delivery dates saved.'));
  } catch {
    await showToast(translate('Failed to save delivery dates.'));
  }
}

async function saveInstruction(shipGroup: any, instruction: string) {
  try {
    await updateShipGroup(shipGroup.id, { shippingInstructions: instruction });
    await showToast(translate('Instructions saved.'));
  } catch {
    await showToast(translate('Failed to save instructions.'));
  }
}

function shipGroupShippingContactMech(shipGroup: any) {
  return shipGroup.contactMechId
    ? orderDetailStore.contactMechsByIdByOrderId(props.orderId)[shipGroup.contactMechId]
    : orderDetailStore.contactMechsByPurposeByOrderId(props.orderId)['SHIPPING_LOCATION'];
}

async function saveShippingAddress(shipGroup: any, form: any) {
  if (!order.value) return;
  const partyId = customerPartyId.value;
  if (!partyId) {
    await showToast(translate('Customer is not available for this order.'));
    return;
  }

  const contactMechId = shipGroupShippingContactMech(shipGroup)?.contactMechId || shipGroup.contactMechId;
  try {
    await orderTaskStore.updateShippingInformation(order.value.id, shipGroup.id, {
      ...form,
      partyId,
      contactMechId,
      contactMechPurposeTypeId: 'SHIPPING_LOCATION',
      isEdited: true,
    });
    await showToast(translate('Shipping address updated successfully.'));
    await loadOrder(order.value.id, true);
  } catch {
    await showToast(translate('Failed to update shipping address. Please try again.'));
  }
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

function timelineMillis(value: string | number | undefined | null) {
  if (!value) return undefined;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return String(value).length === 10 ? numericValue * 1000 : numericValue;
  }

  const stringValue = String(value);
  const sqlDate = DateTime.fromSQL(stringValue);
  if (sqlDate.isValid) return sqlDate.toMillis();

  const isoDate = DateTime.fromISO(stringValue);
  return isoDate.isValid ? isoDate.toMillis() : undefined;
}

function formatDateTime(value: string | number | undefined) {
  const millis = timelineMillis(value);
  return millis
    ? DateTime.fromMillis(millis).toLocaleString({ hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric', hourCycle: 'h12' })
    : '';
}

function findTimeDiff(startTime: string | number | undefined, endTime: string | number | undefined) {
  const startMillis = timelineMillis(startTime);
  const endMillis = timelineMillis(endTime);
  if (!startMillis || !endMillis) return '';

  const timeDiff = DateTime.fromMillis(endMillis).diff(DateTime.fromMillis(startMillis), ['years', 'months', 'days', 'hours', 'minutes']);
  let diffString = '+ ';
  if (timeDiff.years) diffString += `${Math.round(timeDiff.years)} years `;
  if (timeDiff.months) diffString += `${Math.round(timeDiff.months)} months `;
  if (timeDiff.days) diffString += `${Math.round(timeDiff.days)} days `;
  if (timeDiff.hours) diffString += `${Math.round(timeDiff.hours)} hours `;
  if (timeDiff.minutes) diffString += `${Math.round(timeDiff.minutes)} minutes`;

  return diffString.trim() === '+' ? '' : diffString.trim();
}

type LifecycleStep = 'brokered' | 'pick' | 'pack' | 'ship';
const LIFECYCLE_STEP_ORDER: LifecycleStep[] = ['brokered', 'pick', 'pack', 'ship'];

function lifecycleStepValue(timeline: any, step: LifecycleStep) {
  if (!timeline) return undefined;
  if (step === 'brokered') return timeline.firstBrokeredDate || timeline.firstReleasedDate;
  if (step === 'pick') return timeline.picklistDate;
  if (step === 'pack') return timeline.packedDate;
  return timeline.shippedDate;
}

// Overline for a ship-group lifecycle step. The first completed step shows its age
// from now; every later completed step shows the elapsed time since the nearest
// previous completed step (a "+ 30 minutes" delta), so the timeline reads as per-step
// durations instead of repeating the same "months ago" on every step (#350). A missing
// intermediate step is skipped, so the delta is measured from the closest prior
// completed step rather than a gap.
function lifecycleStepLabel(timeline: any, step: LifecycleStep) {
  const value = lifecycleStepValue(timeline, step);
  if (!value) return '';

  const stepIndex = LIFECYCLE_STEP_ORDER.indexOf(step);
  for (let index = stepIndex - 1; index >= 0; index--) {
    const previousValue = lifecycleStepValue(timeline, LIFECYCLE_STEP_ORDER[index]);
    if (previousValue) return findTimeDiff(previousValue, value);
  }
  return commonUtil.getRelativeTime(value);
}

function formatDate(value: string | number | undefined) {
  if (!value) return '';
  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}

function formatTime(value: string | number | undefined) {
  if (!value) return '';

  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10
    ? DateTime.fromMillis(num)
    : DateTime.fromISO(String(value));

  return dt.isValid ? dt.toFormat('HH:mm') : String(value);
}

function getGroupAdjustments(group: any) {
  const adjs = orderDetailStore.adjustmentsByExternalId[group.externalId] || [];
  return adjs
    .map((adj) => ({ comment: adj.label, amount: Number(adj.amount), isIncluded: adj.isIncluded }))
    .filter(adj => adj.amount !== 0);
}

/**
 * A variant's selectable features as one line ("SIZE/M" -> "M"). `productFeatures` is the
 * Solr field the fulfillment app already renders this way, so the two apps agree on what a
 * variant reads as. Empty when the product is uncached or carries no features.
 */
function productFeatureLabel(productId: string): string {
  return commonUtil.getFeatures(getProduct(productId)?.productFeatures);
}

function groupPrimaryIdentifier(group: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.primaryId, getProduct(group.productId) || {})
    || group.name
    || group.externalId;
}

function groupSecondaryIdentifier(group: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.secondaryId, getProduct(group.productId) || {})
    || group.externalId;
}

// Same location-chip semantics as the Find Orders list rows: the group's items act as the
// "docs" — the top physical facility wins the chip (+N for further splits), and virtual/parking
// facilities only label the chip when nothing is brokered. Facility type comes from the seed
// store since ship groups don't carry it.
function groupLocationLabel(group: any): string {
  const summary = summarizeBrokeredFacilities(group.items.map((item: any) => ({
    facilityId: item.facilityId,
    facilityName: seed.facilityName(item.facilityId) || item.facilityName,
    facilityTypeId: seed.facility(item.facilityId)?.facilityTypeId
  })));

  const brokered = Boolean(summary.brokeredFacilityName);
  const name = summary.brokeredFacilityName || summary.dominantVirtualFacilityName;
  if (!name) return '';
  const splitCount = brokered ? summary.brokeredFacilitySplitCount : summary.dominantVirtualFacilitySplitCount;
  return splitCount > 0 ? `${name} +${splitCount}` : name;
}

function getGroupAdjustmentRows(group: any): Array<{ label: string; amount: string }> {
  return getGroupAdjustments(group).map((adjustment) => ({
    label: adjustment.isIncluded ? `${adjustment.comment} (${translate('included')})` : adjustment.comment,
    amount: money(adjustment.amount, order.value?.currency || 'USD')
  }));
}

function getItemAdjustmentRows(item: any): Array<{ label: string; amount: string }> {
  return (item.adjustments || []).map((adjustment: any) => ({
    label: itemAdjustmentLabel(adjustment),
    amount: money(adjustment.amount, order.value?.currency || 'USD')
  }));
}

function itemStatusDetail(item: any): string {
  return item.shipGroupSeqId ? `${translate('#')}${item.shipGroupSeqId}` : '';
}

function itemLineTotal(item: any): number {
  return Number(item.unitPrice || 0) * Number(item.quantity || 0);
}

function attributeChipLabel(count: number): string {
  return `${count || 0} ${Number(count) === 1 ? translate('attribute') : translate('attributes')}`;
}

function itemAdjustmentLabel(adj: any): string {
  return adj.comments
    || adj.comment
    || adj.description
    || seed.orderAdjustmentTypeDescription(adj.orderAdjustmentTypeId)
    || adj.orderAdjustmentTypeId
    || translate('Adjustment');
}

function itemAdjustmentKey(adj: any, fallbackSeqId = ""): string {
  return adj.orderAdjustmentId || [
    fallbackSeqId || adj.orderItemSeqId || "",
    adj.shipGroupSeqId || "",
    adj.orderAdjustmentTypeId || "",
    itemAdjustmentLabel(adj),
    Number(adj.amount || 0),
    Number(adj.amountAlreadyIncluded || 0)
  ].join("|");
}


const orderTaskStore = useOrderTaskStore();

async function openFacilityModal(): Promise<string | null> {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
}

/**
 * Order items carry no product identity of their own — the rolled up group holds it — so the
 * facility picker gets its product, name and image resolved from the owning group.
 */
function facilityInventoryItems(items: any[]) {
  return items.map((item: any) => {
    const group = groupedItems.value.find((candidate: any) =>
      candidate.items.some((groupItem: any) => groupItem.orderItemSeqId === item.orderItemSeqId));

    return {
      orderItemSeqId: item.orderItemSeqId,
      productId: group?.productId || '',
      name: group ? groupPrimaryIdentifier(group) : `${translate('Item')} ${item.orderItemSeqId}`,
      imageUrl: getProduct(group?.productId)?.mainImageUrl,
      quantity: Number(item.quantity || 1)
    };
  });
}

/**
 * One picker for both entry points. Releasing a single item from the items tab and releasing a
 * ship group's selection differ only in how many items are handed over.
 */
async function openFacilityInventoryModal(items: any[]): Promise<string | null> {
  const modal = await modalController.create({
    component: FacilityInventoryModal,
    componentProps: {
      items: facilityInventoryItems(items),
      productStoreId: orderDetailStore.orderById(props.orderId)?.productStoreId
    },
    cssClass: 'facility-inventory-modal'
  });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  return facilityId ?? null;
}

async function openAddItemFromItemsSegment() {
  const shipGroups = order.value?.shipGroups || [];
  if (!shipGroups.length) {
    await showToast(translate('No ship groups are available for this order.'));
    return;
  }

  if (shipGroups.length === 1) {
    await openAddItemModal(shipGroups[0]);
    return;
  }

  let selectedShipGroup: any = null;
  const alert = await alertController.create({
    header: translate('Select ship group'),
    buttons: [
      ...shipGroups.map((shipGroup: any) => ({
        text: shipGroupHeaderTitle(shipGroup),
        handler: () => {
          selectedShipGroup = shipGroup;
        }
      })),
      { text: translate('Cancel'), role: 'cancel' }
    ]
  });

  await alert.present();
  await alert.onDidDismiss();

  if (selectedShipGroup) await openAddItemModal(selectedShipGroup);
}

async function openItemAttributesModal(item: any) {
  const modal = await modalController.create({
    component: OrderItemAttributesModal,
    componentProps: {
      orderId: order.value!.id,
      orderItemSeqId: item.orderItemSeqId,
      attributes: item.attributes
    }
  });
  await modal.present();
  await modal.onDidDismiss();
  if (order.value?.id) await loadOrder(order.value.id, true);
}

async function openManageIdentificationsModal() {
  const modal = await modalController.create({
    component: ManageOrderIdentificationsModal,
    componentProps: {
      orderId: order.value!.id,
      identifications: order.value!.identifications
    }
  });
  await modal.present();
  const { role } = await modal.onWillDismiss();
  if (role !== 'confirm') return;
  if (order.value?.id) await loadOrder(order.value.id, true);
}

</script>

<style scoped>
/* A variant can carry many feature values — an e-gift card lists every denomination — and the
   identity column is narrow. Keep features to one line and put the full value on hover. */
.ship-group-item-features {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions" "subtitle actions";
}

.sentiment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
}

ion-card-header ion-card-title {
  grid-area: title;
}

ion-card-header ion-card-subtitle {
  grid-area: subtitle;
}

ion-card-header ion-note,
ion-card-header ion-button,
ion-card-header ion-buttons {
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
  border-left: var(--border-medium);
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

.comm-event-row {
  --columns-desktop: 5;
  --columns-tablet: 5;
}

.comm-event-row>ion-item {
  width: 100%;
}

.order-items-list {
  padding-block-start: var(--spacer-sm);
}

.order-items-toolbar {
  --min-height: 5rem;
}

.order-items .order-summary {
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
}

.order-summary {
  display: grid;
  align-items: start;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.item-key-header,
.item-key-content {
  pointer-events: none;
}

.item-key-header ion-checkbox,
.item-key-header ion-thumbnail,
.item-key-content ion-checkbox {
  pointer-events: auto;
}

@media (max-width: 699px) {
  .order-items .order-summary {
    grid-template-columns: 1fr;
  }
}
.customer-summary-card ion-card-header {
  display: flex;
  gap: var(--spacer-xs);
  justify-content: space-between;
}

.grand-total-row {
  --background: rgba(255, 255, 255, 0.06);
}

.payment-return-link {
  margin-inline-start: calc(-1 * var(--spacer-xs, 8px));
  text-transform: none;
}

/* Net amount sits across from the Payment title (the header grid's actions column). */
.payment-card ion-card-header ion-card-subtitle {
  grid-area: actions;
  align-self: center;
  margin: 0;
}
</style>
