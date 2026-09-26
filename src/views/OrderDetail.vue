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
        :timeline="orderTimeline"
        :exchange-sources="exchangeSources"
        :can-view-returns="canViewReturns"
        :shopify-admin-url="shopifyAdminUrl"
        @open-customer-contact="openCustomerContactModal"
        @open-locale-prompt="openLocalePrompt"
        @open-manage-identifications="openManageIdentificationsModal"
        @open-manage-attributes="openManageAttributesModal"
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
        v-model:selected-item-ids="selectedItemIds"
        :order="order"
        :item-actions="itemActions"
        :payment-return-ids="paymentReturnIds"
        @add-item="openAddItemFromItemsSegment"
        @reject-and-release="rejectAndReleaseItem"
        @open-item-attributes="openItemAttributesModal"
        @request-inventory-transfer="requestInventoryTransferForItem"
        @cancel-single-item="cancelSingleItem"
      />

      <div v-if="selectedSegment === 'ship-groups'" class="ion-padding">
        <template v-if="order.shipGroups.length">
          <OrderShipGroupCard
            v-for="shipGroup in order.shipGroups.filter((sg) => sg.items.length)"
            :key="shipGroup.id"
            :ship-group="shipGroup"
            :order-id="order.id"
            :order-status-id="order.statusId"
            :expanded="expandedShipGroupIds.has(shipGroup.id)"
            :selected-item-ids="selectedShipGroupItems[shipGroup.id] || []"
            :hold-task-count="countShipGroupHoldTasks(allHoldTasks, shipGroup.id)"
            :distance="shipGroupDistances[shipGroup.id]"
            :carriers="availableCarriers"
            :disabled-actions="shipGroupDisabledActions[shipGroup.id]"
            :can-request-inventory-transfer="canRequestInventoryTransfer"
            :has-transferable-items="inventoryTransferItemsForShipGroup(shipGroup).length > 0"
            :editor="shipGroupEditor(shipGroup)"
            :saving="savingShipGroupId === shipGroup.id"
            @update:expanded="$event ? expandedShipGroupIds.add(shipGroup.id) : expandedShipGroupIds.delete(shipGroup.id)"
            @update:selected-item-ids="selectedShipGroupItems[shipGroup.id] = $event"
            @show-holds="selectedSegment = 'holds'"
            @broker="brokerShipGroup(shipGroup)"
            @release="releaseSelectedItems(shipGroup)"
            @park="parkSelectedItems(shipGroup)"
            @pull-back="rejectSelectedItems(shipGroup)"
            @request-transfer="requestInventoryTransfersForShipGroup(shipGroup)"
            @add-task="openAddTaskModal(shipGroup)"
            @add-items="openAddItemModal(shipGroup)"
            @view-inventory="viewInventory"
            @change-carrier-method="(carrierPartyId, shipmentMethodTypeId) => saveCarrierAndMethod(shipGroup, carrierPartyId, shipmentMethodTypeId)"
            @update:editor="setShipGroupEditor(shipGroup, $event)"
            @save-fields="saveShipGroupFields(shipGroup, $event)"
            @save-address="saveShippingAddress(shipGroup, $event)"
          />
        </template>
        <EmptyState v-else :title="translate('No ship groups')"
          :message="translate('There are no ship groups defined for this order.')" />
      </div>

      <OrderHoldsSegment
        v-if="selectedSegment === 'holds'"
        :address-validation-tasks="addressValidationTasks"
        :swap-tasks="swapTasks"
        :fraud-tasks="fraudTasks"
        :hold-tasks="holdTasks"
        @completed="reloadHoldTasks"
        @create-hold-task="openCreateHoldTaskModal"
      />

      <OrderCommsSegment v-if="selectedSegment === 'comms'" :comm-events="orderDetailStore.commEventsForOrder(orderId)" />
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

    <ion-footer v-if="order && selectedSegment === 'holds' && allHoldTasks.length">
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button @click="openCreateHoldTaskModal">{{ translate('Create hold task') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonItem, IonLabel, IonList, IonMenuButton, IonPage, IonProgressBar, IonSegment, IonSegmentButton, IonTitle, IonToolbar, onIonViewWillEnter } from '@ionic/vue';
import { logger, translate } from '@common';
import router from '@/router';
import Actions from '@/authorization/actions';
import EmptyState from '@/components/common/EmptyState.vue';
import ErrorState from '@/components/common/ErrorState.vue';
import OrderCommsSegment from '@/components/orders/OrderCommsSegment.vue';
import OrderHoldsSegment from '@/components/orders/OrderHoldsSegment.vue';
import OrderItemsSegment from '@/components/orders/OrderItemsSegment.vue';
import OrderShipGroupCard from '@/components/orders/OrderShipGroupCard.vue';
import OrderSummaryHeader from '@/components/orders/OrderSummaryHeader.vue';
import { useOrderActions } from '@/composables/useOrderActions';
import { useOrderDistances } from '@/composables/useOrderDistances';
import { useProductMaster } from '@/composables/useProductMaster';
import { useCustomerStore } from '@/store/customer';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useUserStore } from '@/store/user';
import type { ShipGroupActionId } from '@/utils/OrderActionValidator';
import { countShipGroupHoldTasks } from '@/utils/orderHoldTasks';
import { shopifyAdminOrderUrl, singleShopIdForProductStore } from '@/utils/shopifyAdmin';
import type { EnrichedOrderTimelineEvent, EnrichedPayment } from '@/types/orderDetail';

const props = defineProps<{
  orderId: string;
}>();

const orderDetailStore = useOrderDetailStore();
const orderTaskStore = useOrderTaskStore();
const customerStore = useCustomerStore();
const seed = useSeedStore();
const userStore = useUserStore();
const canViewReturns = computed(() => userStore.hasPermission(Actions.APP_ORDER_RETURN_VIEW));
const canRequestInventoryTransfer = computed(() => userStore.hasPermission(Actions.APP_INVENTORY_TRANSFER_CREATE));

const order = computed(() => orderDetailStore.enrichedOrderByOrderId(props.orderId));
const loading = computed(() => orderDetailStore.loadingById(props.orderId));
const error = computed(() => orderDetailStore.errorById(props.orderId));

const selectedSegment = ref('items');
const selectedItemIds = ref<Set<string>>(new Set());
const selectedShipGroupItems = ref<Record<string, string[]>>({});
const expandedShipGroupIds = ref<Set<string>>(new Set());

async function loadOrder(orderId: string, force = false) {
  await orderDetailStore.loadOrderAggregate(orderId, force);
  loadRejectionReasonEnums();
  // Shops load at boot; this retries a failed boot load (a no-op once loaded) without waiting on it.
  if (shopifyOrderId.value) seed.loadShopifyShops();
  const partyId = orderDetailStore.customerPartyIdByOrderId(orderId);
  if (partyId) await customerStore.loadCustomerProfile(partyId, force);
  // Rich product data (name/SKU/image): fetch only uncached products, never refetch.
  useProductMaster().init();
  await useProductMaster().prefetch(orderDetailStore.allItemsByOrderId(orderId).map((item: any) => item.productId));
  // Shipping methods and carriers are not order-specific; fetched once.
  await Promise.all([orderDetailStore.fetchShippingMethods(), orderDetailStore.fetchCarrierParties()]);
}

// Ionic caches routed page instances, so a page re-activated from /orders/A → /orders/B → back does
// not re-mount. Load on every view activation; the store skips the refetch when the order is loaded.
onIonViewWillEnter(() => loadOrder(props.orderId));
watch(() => props.orderId, (orderId) => loadOrder(orderId));

watch(selectedSegment, (segment) => {
  if (segment === 'holds') {
    orderTaskStore.fetchOrderHoldTasks(props.orderId);
    orderDetailStore.fetchRiskAssessments(props.orderId);
  }
  if (segment === 'comms') orderDetailStore.fetchCommEvents(props.orderId);
});

const {
  isShipGroupActionDisabled, isItemFacilityActionDisabled, isItemCancelAllowed, isInventoryTransferRequestEligible,
  inventoryTransferItemsForShipGroup, brokerShipGroup, parkSelectedItems, rejectSelectedItems, releaseSelectedItems,
  requestInventoryTransfersForShipGroup, openAddTaskModal, openAddItemModal, viewInventory, saveCarrierAndMethod,
  shipGroupEditor, setShipGroupEditor, savingShipGroupId, saveShipGroupFields, saveShippingAddress,
  rejectAndReleaseItem, requestInventoryTransferForItem, cancelSingleItem, openItemAttributesModal, openAddItemFromItemsSegment,
  footerActions, runFooterAction, footerActionLabel, openCustomerContactModal, openLocalePrompt, openManageIdentificationsModal,
  openManageAttributesModal, openRiskDetails, openCreateHoldTaskModal, reloadHoldTasks,
} = useOrderActions({ order, loadOrder, selectedItemIds, selectedShipGroupItems, selectedSegment });

/* ── Items tab ────────────────────────────────────────────────────────── */

const itemActions = computed(() => Object.fromEntries((order.value?.groupedItems || [])
  .flatMap((group) => group.items)
  .map((item) => [item.orderItemSeqId, {
    canCancel: isItemCancelAllowed(item),
    canTransfer: canRequestInventoryTransfer.value && isInventoryTransferRequestEligible(item),
    facilityDisabled: isItemFacilityActionDisabled(item),
  }])));

/* ── Ship groups tab ──────────────────────────────────────────────────── */

const SHIP_GROUP_ACTIONS: ShipGroupActionId[] = ['BROKER', 'RELEASE', 'PARK_ITEMS', 'PULL_BACK', 'ADD_TASK', 'ADD_ITEMS', 'EDIT_CARRIER_METHOD', 'EDIT_ADDRESS'];

const shipGroupDisabledActions = computed(() => Object.fromEntries((order.value?.shipGroups || []).map((shipGroup) => [
  shipGroup.id,
  Object.fromEntries(SHIP_GROUP_ACTIONS.map((actionId) => [actionId, isShipGroupActionDisabled(shipGroup, actionId)])),
])));

const shipGroupDistances = useOrderDistances(() => order.value?.shipGroups || []);

const availableCarriers = computed(() =>
  [...orderDetailStore.carrierParties].sort((a, b) => {
    const nameA = ([a.firstName, a.lastName].filter(Boolean).join(' ') || a.groupName || a.partyId).toLowerCase();
    const nameB = ([b.firstName, b.lastName].filter(Boolean).join(' ') || b.groupName || b.partyId).toLowerCase();
    return nameA.localeCompare(nameB);
  })
);

/* ── Holds tab ────────────────────────────────────────────────────────── */

const addressValidationTasks = computed(() => orderTaskStore.getOrderAddressValidationTasksByOrderId(props.orderId));
const swapTasks = computed(() => orderTaskStore.getOrderSwapTasksByOrderId(props.orderId));
const fraudTasks = computed(() => orderTaskStore.getOrderFraudTasksByOrderId(props.orderId));
const holdTasks = computed(() => orderTaskStore.getOrderHoldTasksByOrderId(props.orderId));
const allHoldTasks = computed(() => [...addressValidationTasks.value, ...swapTasks.value, ...fraudTasks.value, ...holdTasks.value]);

/* ── Header: timeline links and exchange lineage ──────────────────────── */

/** Timeline links depend on where the page is mounted and on what the user may open. */
function timelineRoute(link: EnrichedOrderTimelineEvent['link']): string | undefined {
  if (!link) return undefined;
  if (link.kind === 'return') return canViewReturns.value ? `/returns/${link.id}` : undefined;
  if (link.kind === 'exchangeSource') return `/${router.currentRoute.value.path.split('/')[1] || 'orders'}/${link.id}`;
  return `/orders/${link.id}`;
}

const orderTimeline = computed(() => (order.value?.timeline || []).map((event) => ({ ...event, route: timelineRoute(event.link) })));

// Orders this one was exchanged from (OrderItemAssoc rows of type EXCHANGE, pointing at the
// original via toOrderId). Distinct, and never the order itself.
const exchangeSourceOrderIds = computed(() => [...new Set<string>(
  (orderDetailStore.orderById(props.orderId)?.itemAssocs || [])
    .filter((assoc: any) => assoc.orderItemAssocTypeId === 'EXCHANGE' && assoc.toOrderId && assoc.toOrderId !== props.orderId)
    .map((assoc: any) => assoc.toOrderId)
)]);

// Lazily hydrate each original order (cached in the store by id) so the Source card can show its
// name and the returns that were processed as part of the exchange.
watch(exchangeSourceOrderIds, (ids) => ids.forEach((id) => orderDetailStore.fetchOrder(id)), { immediate: true });

const exchangeSources = computed(() => exchangeSourceOrderIds.value.map((orderId) => {
  const payload = orderDetailStore.orderById(orderId);
  return {
    orderId,
    loading: orderDetailStore.pendingById(orderId),
    orderName: payload?.orderName || payload?.externalId || orderId,
    returnIds: [...new Set((payload?.returnItems || []).map((item: any) => item.returnId).filter(Boolean))] as string[]
  };
}));

// Returns behind an exchange-credit/payment OPP. The returnId is NOT derivable from the OPP's ref
// numbers (they carry Shopify txn ids), so the source of truth is the original order's returnItems.
// When this order was exchanged from several originals, an OPP with a parentRefNum narrows to the
// original whose refunded OPP carries that same manualRefNum; otherwise every source's returns are
// listed rather than guessing (amount/id-adjacency heuristics proved unreliable against real data).
function carriedOverReturnIds(payment: EnrichedPayment): string[] {
  if (!['EXCHANGE_CREDIT', 'EXCHANGE_PAYMENT'].includes(payment.paymentMethodTypeId)) return [];

  let sources = exchangeSources.value;
  if (payment.parentRefNum && sources.length > 1) {
    const matching = sources.filter((source) =>
      (orderDetailStore.orderById(source.orderId)?.paymentPreferences || []).some(
        (opp: any) => opp.manualRefNum === payment.parentRefNum
      )
    );
    if (matching.length) sources = matching;
  }
  return [...new Set(sources.flatMap((source) => source.returnIds))];
}

const paymentReturnIds = computed(() => canViewReturns.value
  ? Object.fromEntries((order.value?.payments.list || []).map((payment) => [payment.id, carriedOverReturnIds(payment)]))
  : {});

/* ── Shopify Admin link ───────────────────────────────────────────────── */

// The OMS has no read endpoint for the shop an order came from (hotwax/mantle-shopify-connector#381),
// so the shop is inferred from the order's product store, and ONLY when exactly one Shopify shop maps
// to that store: an ambiguous or unknown store degrades to no link rather than the wrong store.
const shopifyOrderId = computed(() =>
  (orderDetailStore.orderById(props.orderId)?.identifications || [])
    .find((identification: any) => identification.orderIdentificationTypeId === 'SHOPIFY_ORD_ID')?.idValue ?? '');

// Reactive over the seed dataset, so the link appears even when the shops finish loading after the
// order renders.
const shopifyAdminUrl = computed(() => {
  const productStoreId = orderDetailStore.orderById(props.orderId)?.productStoreId;
  if (!shopifyOrderId.value || !productStoreId) return '';
  const shopId = singleShopIdForProductStore(seed.shopifyShops.ids.map((id: string) => seed.shopifyShops.byId[id]), productStoreId);
  const shop: any = shopId ? seed.shopifyShops.byId[shopId] : null;
  return shop ? shopifyAdminOrderUrl(shop.myshopifyDomain || shop.domain, shopifyOrderId.value) : '';
});

// Rejection reasons live under these two enum parent types and are otherwise only loaded when the
// Reject items modal opens — without them a timeline rejection reads as its raw id
// ("REJ_RSN_DAMAGED"). Loading is idempotent per enum type; the filter just avoids re-listing.
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
</script>
