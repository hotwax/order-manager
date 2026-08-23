<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/returns" />
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Return detail') }}</ion-title>
      </ion-toolbar>
      <ion-progress-bar v-if="detailLoading" type="indeterminate" />
    </ion-header>

    <ion-content v-if="returnRecord">
      <div class="return-detail-header">
        <ion-item class="return-detail-identity" lines="none">
          <ion-icon slot="start" :icon="arrowUndoOutline" />
          <ion-label class="ion-text-wrap">
            <p class="overline">
              {{ translate('RMA') }}
            </p>
            <h1>{{ returnRecord.returnId }}</h1>
            <p>
              {{ itemCountLabel }}
              <template v-if="returnRecord.returnTotal != null">
                · {{ money(returnRecord.returnTotal, returnRecord.currencyUomId) }}
              </template>
            </p>
          </ion-label>
          <ion-badge v-if="returnRecord.statusId" slot="end" :color="returnStatusColor(returnRecord.statusId)">
            {{ describe(returnRecord.statusId) }}
          </ion-badge>
        </ion-item>

        <div class="return-detail-header-details">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate('Return information') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>
                    {{ translate('Requested') }}
                  </p>
                  {{ formatLongDate(returnRecord.entryDate) }}
                </ion-label>
              </ion-item>
              <ion-item v-if="returnRecord.returnDate">
                <ion-label>
                  <p>{{ translate('Return date') }}</p>
                  {{ formatLongDate(returnRecord.returnDate) }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>
                    {{ translate('Return type') }}
                  </p>
                  {{ returnTypeLabel }}
                  <p v-if="returnRecord.isExchange">
                    {{ translate('Exchange') }}
                  </p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>
                    {{ translate('Destination facility') }}
                  </p>
                  {{ facilityLabel }}
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>
                    {{ translate('Customer') }}
                  </p>
                  {{ returnRecord.customerName || returnRecord.fromPartyId || translate('Not linked') }}
                </ion-label>
                <ion-button v-if="returnRecord.fromPartyId && canViewCustomers" slot="end" fill="clear" :router-link="`/customers/${returnRecord.fromPartyId}`">
                  {{ translate('View customer') }}
                  <ion-icon slot="end" :icon="openOutline" />
                </ion-button>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate('Source') }}</ion-card-title>
            </ion-card-header>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>{{ translate('System') }}</p>
                  {{ returnRecord.origin === 'shopify' ? translate('Shopify') : translate('OMS') }}
                </ion-label>
                <ion-badge slot="end" :color="syncColor(returnRecord.syncState)">
                  {{ syncLabel(returnRecord.syncState) }}
                </ion-badge>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>{{ translate('Channel') }}</p>
                  {{ channelLabel }}
                </ion-label>
              </ion-item>
              <ion-item v-if="returnRecord.shopifySync?.shopifyReturnId">
                <ion-label class="ion-text-wrap">
                  <p>{{ translate('Shopify return ID') }}</p>
                  {{ returnRecord.shopifySync.shopifyReturnId }}
                </ion-label>
              </ion-item>
              <ion-item v-if="returnRecord.shopifySync?.returnStatusId">
                <ion-label>
                  <p>{{ translate('Shopify status') }}</p>
                  <ion-badge :color="shopifyStatusColor(returnRecord.shopifySync.returnStatusId)">
                    {{ describe(returnRecord.shopifySync.returnStatusId) }}
                  </ion-badge>
                </ion-label>
              </ion-item>
              <ion-item v-if="returnRecord.shopifySync?.shopifyRefundId">
                <ion-label class="ion-text-wrap">
                  <p>{{ translate('Shopify refund ID') }}</p>
                  {{ returnRecord.shopifySync.shopifyRefundId }}
                </ion-label>
              </ion-item>
              <ion-item v-if="returnRecord.shopifySync?.lastSyncedDate">
                <ion-label>
                  <p>{{ translate('Last synchronized') }}</p>
                  {{ formatLongDate(returnRecord.shopifySync.lastSyncedDate) }}
                </ion-label>
              </ion-item>
              <ion-item v-if="returnRecord.replacementOrderId">
                <ion-label>
                  <p>{{ translate('Replacement order') }}</p>
                  {{ returnRecord.replacementOrderId }}
                </ion-label>
                <ion-button v-if="canViewOrders" slot="end" fill="clear" :router-link="`/orders/${returnRecord.replacementOrderId}`">
                  {{ translate('View order') }}
                </ion-button>
              </ion-item>
              <ion-item v-for="source in exchangeLineage" :key="source.orderId">
                <ion-label class="ion-text-wrap">
                  <p>{{ translate('Exchange of') }}</p>
                  {{ source.orderName }}
                  <p v-if="source.orderName !== source.orderId">
                    {{ source.orderId }}
                  </p>
                </ion-label>
                <ion-button v-if="canViewOrders" slot="end" fill="clear" :router-link="`/orders/${source.orderId}`">
                  {{ translate('View order') }}
                </ion-button>
              </ion-item>
              <ion-item v-if="syncError" color="danger">
                <ion-label class="ion-text-wrap">
                  <p>{{ translate('Latest Shopify error') }}</p>
                  {{ syncError }}
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card>
        </div>

        <div class="timeline return-detail-timeline">
          <ion-item lines="none">
            <ion-icon slot="start" :icon="timeOutline" />
            <h2>{{ translate('Timeline') }}</h2>
          </ion-item>

          <ion-list>
            <ion-item v-for="event in returnTimelineEvents" :key="event.id">
              <ion-icon slot="start" :icon="event.icon" />
              <ion-label class="ion-text-wrap">
                {{ event.label }}
                <p>{{ event.detail }}</p>
              </ion-label>
              <ion-note slot="end">
                {{ formatLongDate(event.date) }}
              </ion-note>
            </ion-item>
            <ion-item v-if="!returnTimelineEvents.length">
              <ion-icon slot="start" :icon="pulseOutline" />
              <ion-label>
                {{ translate('No status history') }}
              </ion-label>
            </ion-item>
          </ion-list>
        </div>
      </div>

      <ion-list v-for="group in itemGroups" :key="group.key" lines="none" class="return-items-list">
        <ion-list-header class="return-order-header">
          <ion-label>{{ itemGroupLabel(group) }}</ion-label>
          <ion-button v-if="group.orderId && canViewOrders" fill="clear" :router-link="`/orders/${group.orderId}`">
            {{ translate('View order') }}
            <ion-icon slot="end" :icon="openOutline" />
          </ion-button>
        </ion-list-header>
        <ion-accordion-group>
          <ion-accordion v-for="item in group.items" :key="`${group.key}-${item.returnItemSeqId}`" :value="`${group.key}-${item.returnItemSeqId}`">
            <ion-item slot="header" lines="none" class="return-item-accordion-header">
              <div class="list-item return-item-row">
                <div class="return-item-key">
                  <ion-thumbnail v-if="item.productId">
                    <DxpShopifyImg :src="(productCache as any).getProduct(item.productId)?.mainImageUrl" size="small" />
                  </ion-thumbnail>
                  <ion-label class="ion-text-wrap">
                    <h2>{{ itemLabel(item) }}</h2>
                    <p v-if="item.sku || item.productId">
                      {{ item.sku || item.productId }}
                    </p>
                  </ion-label>
                </div>

                <ion-label class="tablet return-item-quantity">
                  {{ isAmountOnlyAppeasementItem(item) ? '—' : item.returnQuantity }}
                  <p>{{ translate('Returned') }}</p>
                  <ion-badge class="return-item-restock" :color="restockState(item).color">
                    {{ restockState(item).label }}
                  </ion-badge>
                </ion-label>

                <ion-label class="tablet return-item-status">
                  <ion-badge v-if="item.statusId" :color="returnStatusColor(item.statusId)">
                    {{ describe(item.statusId) }}
                  </ion-badge>
                  <p v-if="item.returnTypeId">
                    {{ describe(item.returnTypeId) }}
                  </p>
                </ion-label>

                <ion-label class="ion-text-end return-item-amount">
                  {{ itemAmount(item) }}
                  <p v-if="item.returnPrice != null && !isAmountOnlyAppeasementItem(item)">
                    {{ money(item.returnPrice, returnRecord.currencyUomId) }} {{ translate('each') }}
                  </p>
                </ion-label>
              </div>
            </ion-item>

            <div slot="content" class="return-item-details">
              <div class="return-item-details-panel">
                <div class="return-item-reason">
                  <p class="return-item-detail-label">
                    {{ translate('Return reason') }}
                  </p>
                  <p class="return-item-detail-value">
                    {{ item.returnReasonDescription || describe(item.returnReasonId) }}
                  </p>
                </div>

                <dl class="return-item-facts">
                  <div v-if="item.unitPrice != null" class="return-item-fact">
                    <dt>{{ translate('Original unit price') }}</dt>
                    <dd>{{ money(item.unitPrice, returnRecord.currencyUomId) }}</dd>
                  </div>
                  <div v-if="item.returnPrice != null" class="return-item-fact">
                    <dt>{{ translate('Return price') }}</dt>
                    <dd>{{ money(item.returnPrice, returnRecord.currencyUomId) }}</dd>
                  </div>
                  <div v-if="item.receivedQuantity != null" class="return-item-fact">
                    <dt>{{ translate('Received quantity') }}</dt>
                    <dd>{{ item.receivedQuantity }}</dd>
                  </div>
                  <div v-if="item.expectedItemStatus" class="return-item-fact">
                    <dt>{{ translate('Inventory outcome') }}</dt>
                    <dd>{{ inventoryStatusLabel(item.expectedItemStatus) }}</dd>
                  </div>
                  <div v-if="item.returnItemTypeId" class="return-item-fact">
                    <dt>{{ translate('Return item type') }}</dt>
                    <dd>{{ describe(item.returnItemTypeId) }}</dd>
                  </div>
                </dl>

                <div class="return-item-references">
                  <p class="return-item-detail-label">
                    {{ translate('Identifiers') }}
                  </p>
                  <p>{{ itemReferenceLabel(item) }}</p>
                </div>
              </div>
            </div>
          </ion-accordion>
        </ion-accordion-group>
      </ion-list>

      <div class="return-financial-summary">
        <ion-card class="payment-card">
          <ion-card-header>
            <ion-card-title>{{ translate('Payment outcome') }}</ion-card-title>
            <ion-card-subtitle v-if="sourceOrderPayments.length">
              {{ translate('Net refunded') }} {{ money(paymentNetRefundedAmount, returnRecord.currencyUomId) }}
            </ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="none">
            <ion-item v-if="paymentOutcomeLoading">
              <ion-spinner slot="start" name="crescent" />
              <ion-label>{{ translate('Loading source order payment preferences') }}</ion-label>
            </ion-item>
            <template v-else-if="paymentSections.length">
              <template v-for="section in paymentSections" :key="section.statusId">
                <ion-item-divider color="light">
                  <ion-label>{{ section.label }}</ion-label>
                  <ion-label slot="end">
                    {{ money(section.total, returnRecord.currencyUomId) }}
                  </ion-label>
                </ion-item-divider>
                <ion-item v-for="payment in section.payments" :key="payment.key">
                  <ion-label>
                    <p class="overline">
                      {{ payment.paymentMethodTypeId || translate('Payment preference') }}
                    </p>
                    {{ payment.paymentMethodTypeDescription }}
                    <p>{{ translate('From order') }} {{ payment.orderName }}</p>
                    <p v-if="payment.createdDate">
                      {{ formatLongDate(payment.createdDate) }}
                    </p>
                  </ion-label>
                  <ion-label slot="end">
                    {{ money(payment.amount, returnRecord.currencyUomId) }}
                  </ion-label>
                </ion-item>
              </template>
            </template>
            <ion-item v-else>
              <ion-label class="ion-text-wrap">
                {{ paymentOutcomeEmptyMessage }}
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card class="totals">
          <ion-card-header>
            <ion-card-title>{{ translate('Return total') }}</ion-card-title>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>{{ translate('Item subtotal') }}</ion-label>
              <ion-label slot="end">
                {{ returnItemSubtotal != null ? money(returnItemSubtotal, returnRecord.currencyUomId) : translate('Not available') }}
              </ion-label>
            </ion-item>
            <ion-item class="grand-total-row">
              <ion-label>{{ translate('Total return value') }}</ion-label>
              <ion-label slot="end" color="dark">
                {{ returnRecord.returnTotal != null ? money(returnRecord.returnTotal, returnRecord.currencyUomId) : translate('Not available') }}
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>
      </div>
    </ion-content>

    <ion-content v-else-if="detailLoading">
      <div class="ion-padding ion-text-center">
        <ion-spinner name="crescent" />
        <p>{{ translate('Loading return') }}</p>
      </div>
    </ion-content>

    <ion-content v-else-if="detailError">
      <ErrorState
        :title="translate('Return failed to load')"
        :message="detailError"
        retryable
        @retry="loadReturn"
      />
    </ion-content>

    <ion-content v-else>
      <EmptyState
        :title="translate('Return not found')"
        :message="translate('The selected return is not available in this workspace.')"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { DxpShopifyImg, commonUtil, translate } from "@common";
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter
} from "@ionic/vue";
import {
  arrowUndoOutline,
  calendarOutline,
  checkmarkDoneOutline,
  closeCircleOutline,
  cubeOutline,
  documentTextOutline,
  openOutline,
  pulseOutline,
  timeOutline
} from "ionicons/icons";
import { DateTime } from "luxon";
import { storeToRefs } from "pinia";
import { computed, watch } from "vue";
import Actions from "@/authorization/actions";
import EmptyState from "@/components/common/EmptyState.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import { useProductMaster } from "@/composables/useProductMaster";
import { useOrderDetailStore } from "@/store/orderDetail";
import { useProductCacheStore } from "@/store/productCache";
import { useReturnsStore } from "@/store/returns";
import { useSeedStore } from "@/store/seed";
import { useUserStore } from "@/store/user";
import type { ReturnItemDetail, ReturnStatusHistory, ReturnSyncState } from "@/types/returns";

const props = defineProps<{
  returnId: string;
}>();

const returnsStore = useReturnsStore();
const seed = useSeedStore();
const productCache = useProductCacheStore();
const productMaster = useProductMaster();
const orderDetailStore = useOrderDetailStore();
const userStore = useUserStore();
const { current: returnRecord, detailLoading, detailError } = storeToRefs(returnsStore);
const canViewOrders = computed(() => userStore.hasPermission(Actions.APP_ORDERS_VIEW));
const canViewCustomers = computed(() => userStore.hasPermission(Actions.APP_CUSTOMERS_VIEW));
const itemGroups = computed(() => {
  const groups = new Map<string, { key: string; orderId?: string; orderName?: string; items: ReturnItemDetail[] }>();
  (returnRecord.value?.items || []).forEach((item) => {
    const orderId = item.orderId || returnRecord.value?.orderId;
    const key = orderId || "UNLINKED";
    const existing = groups.get(key) || { key, orderId, items: [] };
    existing.orderName = item.orderName || existing.orderName || (orderId === returnRecord.value?.orderId ? returnRecord.value?.orderName : undefined);
    existing.items.push(item);
    groups.set(key, existing);
  });

  return [...groups.values()];
});
const sourceOrderIds = computed(() => itemGroups.value.map((group) => group.orderId).filter((orderId): orderId is string => Boolean(orderId)));
const exchangeOriginalOrderIds = computed(() => [...new Set(sourceOrderIds.value.flatMap((sourceOrderId) => {
  const sourceOrder = orderDetailStore.orderById(sourceOrderId);

  return (sourceOrder?.itemAssocs || [])
    .filter((association: any) => association.orderItemAssocTypeId === "EXCHANGE" && association.toOrderId && association.toOrderId !== sourceOrderId)
    .map((association: any) => String(association.toOrderId));
}))]);
const exchangeLineage = computed(() => exchangeOriginalOrderIds.value.map((orderId) => {
  const order = orderDetailStore.orderById(orderId);

  return {
    orderId,
    orderName: order?.orderName || order?.externalId || orderId
  };
}));
const sourceOrderPayments = computed(() => sourceOrderIds.value.flatMap((orderId) => {
  const order = orderDetailStore.orderById(orderId);
  const orderName = order?.orderName || order?.externalId || orderId;

  return (order?.paymentPreferences || []).map((payment: any, index: number) => ({
    key: payment.orderPaymentPreferenceId || `${orderId}-${payment.paymentMethodTypeId || "PAYMENT"}-${index}`,
    orderId,
    orderName,
    paymentMethodTypeId: payment.paymentMethodTypeId || "",
    paymentMethodTypeDescription: seed.paymentMethodDescription(payment.paymentMethodTypeId) || payment.paymentMethodTypeId || translate("Payment preference"),
    amount: Number(payment.maxAmount ?? payment.presentmentAmount ?? 0),
    statusId: payment.statusId || "UNKNOWN",
    statusDescription: seed.statusDescription(payment.statusId) || payment.statusId || translate("Unknown status"),
    createdDate: payment.createdDate || payment.createdStamp
  }));
}));
const paymentOutcomeLoading = computed(() => sourceOrderIds.value.some((orderId) => orderDetailStore.loadingById(orderId)));
const paymentOutcomeEmptyMessage = computed(() => {
  if(!sourceOrderIds.value.length) {return translate("No source order is linked to this return.");}
  const hasLoadError = sourceOrderIds.value.some((orderId) => Boolean(orderDetailStore.errorById(orderId)));

  return hasLoadError
    ? translate("Source order payment preferences are unavailable.")
    : translate("No payment preference records were found on the source orders.");
});
const paymentSections = computed(() => {
  const sections: Array<{ statusId: string; label: string; payments: typeof sourceOrderPayments.value; total: number }> = [];
  const byStatus = new Map<string, (typeof sections)[number]>();
  sourceOrderPayments.value.forEach((payment) => {
    if(!byStatus.has(payment.statusId)) {
      const section = { statusId: payment.statusId, label: payment.statusDescription, payments: [], total: 0 };
      byStatus.set(payment.statusId, section);
      sections.push(section);
    }
    const section = byStatus.get(payment.statusId)!;
    section.payments.push(payment);
    section.total += payment.amount;
  });

  return sections
    .map((section) => ({ ...section, total: Math.round(section.total * 100) / 100 }))
    .sort((left, right) => Number(left.statusId === "PAYMENT_REFUNDED") - Number(right.statusId === "PAYMENT_REFUNDED"));
});
// The current return contract does not expose ReturnItemResponse, so a refund cannot be
// safely assigned to this RMA when a source order has several returns. Keep the figure
// grounded in the payment preferences shown below: completed refunds across every linked
// source order. Authorized/received sale payments are not part of the refunded amount.
const paymentNetRefundedAmount = computed(() => {
  const amount = sourceOrderPayments.value.reduce((total, payment) =>
    payment.statusId === "PAYMENT_REFUNDED" ? total + payment.amount : total, 0);

  return Math.round(amount * 100) / 100;
});
const returnItemSubtotal = computed(() => {
  const items = returnRecord.value?.items || [];
  if(!items.length || items.some((item) => item.returnPrice == null)) {return undefined;}
  const total = items.reduce((sum, item) => sum + (isAmountOnlyAppeasementItem(item)
    ? Number(item.returnPrice)
    : Number(item.returnPrice) * item.returnQuantity), 0);

  return Math.round(total * 100) / 100;
});

const itemCountLabel = computed(() => {
  const itemCount = returnRecord.value?.itemCount || 0;

  return `${itemCount} ${itemCount === 1 ? translate("item") : translate("items")}`;
});
const returnTypeLabel = computed(() => {
  if(returnRecord.value?.returnHeaderTypeId === "CUSTOMER_RETURN") {return translate("Customer return");}
  if(returnRecord.value?.returnHeaderTypeId === "APPEASEMENT") {return translate("Appeasement");}

  return describe(returnRecord.value?.returnHeaderTypeId);
});
const facilityLabel = computed(() => {
  const facilityId = returnRecord.value?.destinationFacilityId;

  return facilityId ? seed.facilityName(facilityId) || facilityId : translate("Not specified");
});
const channelLabel = computed(() => {
  const channelId = returnRecord.value?.returnChannelEnumId;

  return channelId ? seed.enumDescription(channelId) || channelId : translate("Not specified");
});
const syncError = computed(() => {
  const sync = returnRecord.value?.shopifySync;
  if(!sync) {return "";}

  return sync.exchangeProcessErrorMessage ||
    sync.exchangePushErrorMessage ||
    sync.closePushErrorMessage ||
    sync.pushErrorMessage ||
    "";
});
const returnStatusColorAliases: Record<string, string> = {
  RETURN_REQUESTED: "ORDER_CREATED",
  RETURN_APPROVED: "ORDER_APPROVED",
  RETURN_ACCEPTED: "ORDER_APPROVED",
  RETURN_AUTHORIZED: "PAYMENT_AUTHORIZED",
  RETURN_RECEIVED: "SHIPMENT_SHIPPED",
  RETURN_COMPLETED: "ORDER_COMPLETED",
  RETURN_REJECTED: "ORDER_REJECTED",
  RETURN_CANCELLED: "ORDER_CANCELLED"
};
const shopifyStatusColorAliases: Record<string, string> = {
  OPEN: "ORDER_CREATED",
  REQUESTED: "ORDER_CREATED",
  APPROVED: "ORDER_APPROVED",
  AUTHORIZED: "PAYMENT_AUTHORIZED",
  COMPLETED: "ORDER_COMPLETED",
  CLOSED: "ORDER_COMPLETED",
  REJECTED: "ORDER_REJECTED",
  CANCELED: "ORDER_CANCELLED",
  CANCELLED: "ORDER_CANCELLED"
};
const returnTimelineEvents = computed(() => {
  const record = returnRecord.value;
  if(!record) {return [];}

  const events: Array<{ id: string; label: string; detail: string; date: string; icon: string; order: number }> = [];
  if(record.entryDate) {
    events.push({
      id: "requested",
      label: translate("Requested"),
      detail: translate("Whole return"),
      date: record.entryDate,
      icon: arrowUndoOutline,
      order: 0
    });
  }
  if(record.returnDate) {
    events.push({
      id: "return-date",
      label: translate("Return date"),
      detail: translate("Whole return"),
      date: record.returnDate,
      icon: calendarOutline,
      order: 1
    });
  }

  record.statuses.forEach((status, index) => {
    const isHeaderRequested = status.statusId === "RETURN_REQUESTED" &&
      (!status.returnItemSeqId || status.returnItemSeqId === "_NA_") &&
      sameMoment(status.statusDate, record.entryDate);
    if(isHeaderRequested) {return;}

    const item = statusItem(status);
    const isConfirmedRestock = status.statusId === "RETURN_RECEIVED" && Boolean(item && Number(item.receivedQuantity) > 0);
    events.push({
      id: `status-${status.statusId}-${status.returnItemSeqId || "HEADER"}-${status.statusDate}-${index}`,
      label: returnTimelineLabel(status, isConfirmedRestock),
      detail: timelineScopeLabel(status),
      date: status.statusDate,
      icon: returnTimelineIcon(status.statusId, isConfirmedRestock),
      order: index + 2
    });
  });

  return events.sort((left, right) => {
    const leftMillis = parseDate(left.date)?.toMillis();
    const rightMillis = parseDate(right.date)?.toMillis();
    if(leftMillis == null || rightMillis == null || leftMillis === rightMillis) {return left.order - right.order;}

    return leftMillis - rightMillis;
  });
});

onIonViewWillEnter(loadReturn);
watch(() => props.returnId, loadReturn);

async function loadReturn() {
  await returnsStore.loadReturn(props.returnId);
  const productIds = returnRecord.value?.items.map((item) => item.productId).filter(Boolean) as string[] | undefined;
  if(productIds?.length) {void productMaster.prefetch(productIds);}
  await Promise.all(sourceOrderIds.value.map((orderId) => orderDetailStore.fetchOrder(orderId)));
  await Promise.all(exchangeOriginalOrderIds.value.map((orderId) => orderDetailStore.fetchOrder(orderId)));
}

function describe(value?: string) {
  return value ? seed.describe(value) || value : translate("Not specified");
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(value);
}

function isAmountOnlyAppeasementItem(item: ReturnItemDetail) {
  return returnRecord.value?.returnHeaderTypeId === "APPEASEMENT" && !item.productId && item.returnPrice != null;
}

function itemAmount(item: ReturnItemDetail) {
  if(item.returnPrice == null) {return translate("Not available");}
  const amount = isAmountOnlyAppeasementItem(item) ? item.returnPrice : item.returnPrice * item.returnQuantity;

  return money(amount, returnRecord.value?.currencyUomId);
}

function itemLabel(item: ReturnItemDetail) {
  return item.productName || item.description || item.sku || item.productId || translate("Return item");
}

function itemReferenceLabel(item: ReturnItemDetail) {
  return [
    `${translate("Return item")} ${item.returnItemSeqId}`,
    item.orderItemSeqId ? `${translate("Order item")} ${item.orderItemSeqId}` : "",
    item.productId ? `${translate("Product")} ${item.productId}` : ""
  ].filter(Boolean).join(" · ");
}

function inventoryStatusLabel(statusId: string) {
  const labels: Record<string, string> = {
    INV_RETURNED: "Return to inventory",
    INV_NOT_RETURNED: "Do not return to inventory"
  };

  return labels[statusId] ? translate(labels[statusId]) : describe(statusId);
}

function returnStatusColor(statusId: string) {
  return commonUtil.getStatusColor(returnStatusColorAliases[statusId] || statusId);
}

function shopifyStatusColor(statusId: string) {
  return commonUtil.getStatusColor(shopifyStatusColorAliases[statusId] || returnStatusColorAliases[statusId] || statusId);
}

function restockState(item: ReturnItemDetail) {
  const receivedQuantity = item.receivedQuantity;
  const terminalStatuses = ["RETURN_COMPLETED", "RETURN_CANCELLED", "RETURN_REJECTED"];
  if(receivedQuantity != null && receivedQuantity > 0) {
    return { label: translate("Restocked"), color: commonUtil.getStatusColor("ORDER_COMPLETED") };
  }
  if(item.expectedItemStatus === "INV_NOT_RETURNED" || item.returnItemTypeId === "RET_LOST_ITEM" ||
    ["RETURN_CANCELLED", "RETURN_REJECTED"].includes(returnRecord.value?.statusId || "")) {
    return { label: translate("Not restocked"), color: commonUtil.getStatusColor("ORDER_CANCELLED") };
  }
  if(item.expectedItemStatus === "INV_RETURNED" || item.returnItemTypeId === "RET_FPROD_ITEM") {
    const isTerminal = terminalStatuses.includes(item.statusId || "") || terminalStatuses.includes(returnRecord.value?.statusId || "");

    return isTerminal
      ? { label: translate("Restock not confirmed"), color: commonUtil.getStatusColor("ORDER_HOLD") }
      : { label: translate("Restock pending"), color: commonUtil.getStatusColor("ORDER_CREATED") };
  }
  if(receivedQuantity === 0) {
    return { label: translate("Not restocked"), color: commonUtil.getStatusColor("ORDER_CANCELLED") };
  }

  return { label: translate("Restock not confirmed"), color: commonUtil.getStatusColor("ORDER_HOLD") };
}

function itemGroupLabel(group: { orderId?: string; orderName?: string }) {
  const orderLabel = group.orderName || group.orderId;

  return orderLabel ? `${translate("Items from order")} ${orderLabel}` : translate("Items without linked order");
}

function timelineScopeLabel(status: ReturnStatusHistory) {
  if(!status.returnItemSeqId || status.returnItemSeqId === "_NA_") {return translate("Whole return");}
  const item = returnRecord.value?.items.find((candidate) => candidate.returnItemSeqId === status.returnItemSeqId);
  const itemLabel = item?.productName || item?.description || item?.sku || item?.productId || status.returnItemSeqId;

  return `${translate("Item")} · ${itemLabel}`;
}

function statusItem(status: ReturnStatusHistory) {
  if(!status.returnItemSeqId || status.returnItemSeqId === "_NA_") {return undefined;}

  return returnRecord.value?.items.find((candidate) => candidate.returnItemSeqId === status.returnItemSeqId);
}

function returnTimelineIcon(statusId: string, isConfirmedRestock = false) {
  if(isConfirmedRestock || statusId === "RETURN_RECEIVED") {return cubeOutline;}
  if(["RETURN_APPROVED", "RETURN_ACCEPTED", "RETURN_AUTHORIZED", "RETURN_COMPLETED"].includes(statusId)) {return checkmarkDoneOutline;}
  if(["RETURN_CANCELLED", "RETURN_REJECTED"].includes(statusId)) {return closeCircleOutline;}
  if(statusId === "RETURN_REQUESTED") {return documentTextOutline;}

  return pulseOutline;
}

function returnTimelineLabel(status: ReturnStatusHistory, isConfirmedRestock: boolean) {
  if(isConfirmedRestock) {return translate("Restocked");}
  if(status.statusId === "RETURN_COMPLETED") {
    return statusItem(status) ? translate("Item completed") : translate("Return completed");
  }

  return describe(status.statusId);
}

function sameMoment(left?: string | number, right?: string | number) {
  const leftMillis = parseDate(left)?.toMillis();
  const rightMillis = parseDate(right)?.toMillis();

  return leftMillis != null && rightMillis != null && leftMillis === rightMillis;
}

function parseDate(value?: string | number) {
  if(!value) {return undefined;}
  const stringValue = String(value);
  const numericValue = Number(value);
  if(/^\d+$/.test(stringValue)) {return DateTime.fromMillis(stringValue.length <= 10 ? numericValue * 1000 : numericValue);}
  const isoDate = DateTime.fromISO(stringValue);

  return isoDate.isValid ? isoDate : DateTime.fromSQL(stringValue);
}

function formatLongDate(value?: string | number) {
  const date = parseDate(value);

  return date?.isValid ? date.toLocaleString(DateTime.DATETIME_MED) : String(value ?? "");
}

function syncColor(state: ReturnSyncState) {
  return { synced: "success", pending: "warning", failed: "danger", not_synced: "medium" }[state];
}

function syncLabel(state: ReturnSyncState) {
  return translate({ synced: "Synced", pending: "Pending", failed: "Failed", not_synced: "Not synced" }[state]);
}
</script>

<style scoped>
.return-detail-header {
  display: grid;
  gap: var(--spacer-base);
}

.return-detail-identity {
  min-width: 0;
}

.return-detail-header-details {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: start;
  min-width: 0;
}

.return-detail-header-details ion-card {
  flex: 1 1 300px;
  max-width: 375px;
}

.return-detail-timeline {
  min-width: 0;
  border-block-start: var(--border-medium);
}

.return-detail-timeline ion-note {
  max-width: 12rem;
  text-align: end;
  white-space: normal;
}

.return-items-list {
  padding-block-start: var(--spacer-sm);
}

.return-order-header {
  border-block-end: var(--border-medium);
}

.return-item-row {
  --columns-desktop: 4;
  --columns-tablet: 4;
  width: 100%;
  min-height: 6rem;
  padding-inline-end: var(--spacer-xs);
}

.return-item-accordion-header {
  --inner-padding-end: var(--spacer-xs);
  --padding-start: 0;
  border-block-start: var(--border-medium);
}

.return-item-key {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  padding-inline-start: var(--spacer-sm);
}

.return-item-key ion-thumbnail {
  flex: 0 0 auto;
  margin-inline-end: var(--spacer-sm);
}

.return-item-quantity,
.return-item-status {
  text-align: center;
}

.return-item-amount {
  min-width: 7rem;
}

.return-item-restock {
  margin-block-start: var(--spacer-xs);
}

.return-item-details {
  background: var(--ion-color-step-50, #f7f7f7);
  padding: var(--spacer-sm);
}

.return-item-details-panel {
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150, #e0e0e0);
  border-radius: 8px;
  background: var(--ion-background-color, #ffffff);
}

.return-item-reason {
  padding: var(--spacer-sm) var(--spacer-base);
  border-block-end: 1px solid var(--ion-color-step-100, #e6e6e6);
}

.return-item-detail-label,
.return-item-fact dt {
  margin: 0 0 4px;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.return-item-detail-value,
.return-item-references p,
.return-item-fact dd {
  margin: 0;
  line-height: 1.4;
}

.return-item-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacer-base);
  margin: 0;
  padding: var(--spacer-sm) var(--spacer-base);
}

.return-item-fact {
  min-width: 0;
}

.return-item-fact dd {
  font-weight: 500;
}

.return-item-references {
  padding: var(--spacer-xs) var(--spacer-base) var(--spacer-sm);
  border-block-start: 1px solid var(--ion-color-step-100, #e6e6e6);
  color: var(--ion-color-step-600, #666666);
  font-size: 0.875rem;
}

.return-item-references .return-item-detail-label {
  padding-block-start: var(--spacer-xs);
}

.return-financial-summary {
  display: grid;
  align-items: start;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
}

.grand-total-row {
  --background: rgba(255, 255, 255, 0.06);
}

/* Match Order Detail: keep the payment outcome in the header's actions column. */
.payment-card ion-card-header ion-card-subtitle {
  grid-area: actions;
  align-self: center;
  margin: 0;
}

@media (min-width: 900px) {
  .return-detail-header {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
    grid-template-rows: auto 1fr;
  }

  .return-detail-identity {
    grid-column: 1;
    grid-row: 1;
  }

  .return-detail-header-details {
    grid-column: 1;
    grid-row: 2;
  }

  .return-detail-timeline {
    grid-column: 2;
    grid-row: 1 / span 2;
    border-block-start: 0;
    border-inline-start: var(--border-medium);
  }
}

@media (max-width: 699px) {
  .return-financial-summary {
    grid-template-columns: 1fr;
  }
}
</style>
