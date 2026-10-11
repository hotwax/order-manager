<template>
  <div class="order-items">
    <ion-list lines="none" class="order-items-list">
      <!-- Like each item row, only the checkbox selects, so it sits beside the item rather than in
           it and lines up with the row checkboxes below. -->
      <div v-if="!isTerminal" class="order-items-toolbar">
        <ion-checkbox :checked="areAllSelected" :aria-label="translate('Select all')"
          @ionChange="selectItems(allItems, $event.detail.checked)" />
        <ion-item lines="none">
          <ion-label>{{ translate('Select all') }}</ion-label>
        </ion-item>
      </div>
      <ion-accordion-group>
        <template v-for="group in order.groupedItems" :key="group.externalId">
          <!-- Nothing to roll up when the group is a single order item, so the item row is
               rendered directly with the product identity the rolled up header would carry. -->
          <OrderItemListRow v-if="group.items.length === 1" v-bind="itemRow(group.items[0], productRowProps(group))">
            <template #details>
              <OrderItemTransferChip :transfers="group.items[0].transfers" @click="emit('open-item-transfers', group.items[0])" />
            </template>
          </OrderItemListRow>
          <ion-accordion v-else :value="group.externalId">
            <OrderItemListRow
              slot="header"
              :selectable="!isTerminal"
              v-bind="productRowProps(group)"
              :selected="group.items.every(isSelected)"
              :quantity="group.totalQty"
              :quantity-label="translate('qty')"
              :facility-label="group.locationLabel"
              :facility-warning="group.items.some((item) => shortStock?.[item.orderItemSeqId] !== undefined)"
              :facility-disabled="true"
              :statuses="group.statuses"
              :amount="money(group.totalPrice)"
              :adjustments="group.adjustments.map((adj) => ({ label: adj.isIncluded ? translate('{label} (included)', { label: adj.label }) : adj.label, amount: money(adj.amount) }))"
              @update:selected="selectItems(group.items, $event)"
            />
            <div slot="content">
              <ion-list lines="none">
                <OrderItemListRow
                  v-for="item in group.items"
                  :key="item.orderItemSeqId"
                  v-bind="itemRow(item, itemIdentity(item))"
                >
                  <template #details>
                    <OrderItemTransferChip :transfers="item.transfers" @click="emit('open-item-transfers', item)" />
                  </template>
                </OrderItemListRow>
              </ion-list>
            </div>
          </ion-accordion>
        </template>
      </ion-accordion-group>
    </ion-list>

    <div class="order-summary">
      <ion-card class="payment-card">
        <ion-card-header>
          <ion-card-title>{{ translate('Payment') }}</ion-card-title>
          <ion-card-subtitle v-if="order.payments.list.length" :color="order.payments.netColor">
            {{ translate('Net {amount}', { amount: money(order.payments.netAmount) }) }}
          </ion-card-subtitle>
        </ion-card-header>
        <ion-list lines="none">
          <template v-for="section in order.payments.sections" :key="section.statusId">
            <ion-item-divider color="light">
              <ion-label>{{ section.label }}</ion-label>
              <ion-label slot="end">{{ money(section.total) }}</ion-label>
            </ion-item-divider>
            <ion-item v-for="(payment, index) in section.payments" :key="payment.id || `${payment.paymentMethodTypeId}-${index}`">
              <ion-label>
                <p class="overline">{{ payment.paymentMethodTypeId }}</p>
                {{ payment.paymentMethodTypeDesc }}
                <p>{{ payment.statusDesc || payment.statusId }}</p>
                <p v-if="payment.createdDate">{{ formatDateTime(payment.createdDate) }}</p>
                <ion-button
                  v-for="returnId in paymentReturnIds[payment.id] || []"
                  :key="returnId"
                  fill="clear"
                  size="small"
                  class="payment-return-link"
                  :router-link="`/returns/${returnId}`"
                  @click.stop
                >
                  {{ translate('Return {id}', { id: returnId }) }}
                </ion-button>
              </ion-label>
              <ion-label slot="end">{{ money(payment.amount) }}</ion-label>
            </ion-item>
          </template>
          <ion-item v-if="!order.payments.list.length">
            <ion-label>{{ translate('No payment preference records') }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-card>
      <ion-card class="totals">
        <ion-card-header>
          <ion-card-title>{{ translate('Total') }}</ion-card-title>
        </ion-card-header>
        <ion-list lines="full">
          <ion-item>
            <ion-label>{{ translate('Subtotal') }}</ion-label>
            <ion-label slot="end">{{ money(order.totals.subtotal) }}</ion-label>
          </ion-item>
          <ion-item v-for="adjustment in order.totals.adjustmentRows" :key="adjustment.label">
            <ion-label>
              {{ adjustment.label }}
              <p v-if="adjustment.detail">{{ adjustment.detail }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end">
              {{ money(adjustment.amount) }}
              <p v-if="adjustment.isIncluded">{{ translate('Included') }}</p>
            </ion-label>
          </ion-item>
          <ion-item class="grand-total-row">
            <ion-label>{{ translate('Grand total') }}</ion-label>
            <ion-label slot="end" color="dark">{{ money(order.totals.total) }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate('Payment received') }}</ion-label>
            <ion-label slot="end">{{ money(order.payments.receivedTotal) }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonAccordion, IonAccordionGroup, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonItem, IonItemDivider, IonLabel, IonList } from '@ionic/vue';
import { translate } from '@common';
import OrderItemListRow from '@/components/orders/OrderItemListRow.vue';
import OrderItemTransferChip from '@/components/orders/OrderItemTransferChip.vue';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { isKit } from '@/utils';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/format';
import { OrderActionValidator } from '@/utils/OrderActionValidator';
import type { EnrichedItemGroup, EnrichedOrder, EnrichedOrderItem } from '@/types/orderDetail';

const props = defineProps<{
  order: EnrichedOrder;
  selectedItemIds: Set<string>;
  /** Per order item, what its row may offer — decided by the page's action validator. */
  itemActions: Record<string, { facilityDisabled: boolean }>;
  /** Returns carried over onto exchange credit/payment preferences, keyed by payment id. */
  paymentReturnIds: Record<string, string[]>;
  /** Available to promise at the item's location, for items whose location is short. Keyed by order item. */
  shortStock?: Record<string, number>;
}>();

const emit = defineEmits<{
  'update:selectedItemIds': [ids: Set<string>];
  'reject-and-release': [item: EnrichedOrderItem];
  'open-item-attributes': [item: EnrichedOrderItem];
  'open-item-transfers': [item: EnrichedOrderItem];
}>();

const { getProduct, primaryIdentifier, secondaryIdentifier, featureLabel } = useProductIdentity();

const allItems = computed(() => props.order.groupedItems.flatMap((group) => group.items));
/** A completed or cancelled order takes no item actions, so there is nothing to select or add. */
const isTerminal = computed(() => OrderActionValidator.isOrderTerminal(props.order));
const areAllSelected = computed(() => allItems.value.length > 0 && allItems.value.every(isSelected));

function isSelected(item: EnrichedOrderItem) {
  return props.selectedItemIds.has(item.orderItemSeqId);
}

function selectItems(items: EnrichedOrderItem[], selected: boolean) {
  const ids = new Set(props.selectedItemIds);
  items.forEach((item) => selected ? ids.add(item.orderItemSeqId) : ids.delete(item.orderItemSeqId));
  emit('update:selectedItemIds', ids);
}

const money = (value: number) => formatMoney(value, props.order.currency);

/** The product identity a rolled up (or sole item) row shows. */
function productRowProps(group: EnrichedItemGroup) {
  return {
    primary: primaryIdentifier(group.productId) || group.name || group.externalId,
    secondary: secondaryIdentifier(group.productId) || group.externalId,
    badgeLabel: isKit(group) ? translate('Kit') : '',
    features: featureLabel(group.productId),
    imageUrl: getProduct(group.productId)?.mainImageUrl,
  };
}

/** Inside a rolled up group the item row names the order item rather than the product. */
function itemIdentity(item: EnrichedOrderItem) {
  return {
    primary: translate('Item {id}', { id: item.orderItemSeqId }),
    secondary: item.externalId && item.externalId !== 'null' ? translate('External ID: {id}', { id: item.externalId }) : '',
    showImage: false,
    showQuantity: false,
  };
}

/** The location's name, followed by its available count when it is short, e.g. "2301 E. 51st St. (-1)". */
function facilityLabel(item: EnrichedOrderItem) {
  const available = props.shortStock?.[item.orderItemSeqId];
  return available === undefined ? item.facilityName : translate('{facility} ({available})', { facility: item.facilityName, available: formatNumber(available) });
}

/** Everything one order item's row shows and reports, under the given identity. Its buttons stay in the slot. */
function itemRow(item: EnrichedOrderItem, identity: ReturnType<typeof productRowProps> | ReturnType<typeof itemIdentity>) {
  const attributeCount = Number(item.attributeCount) || 0;
  return {
    ...identity,
    selectable: !isTerminal.value,
    selected: isSelected(item),
    quantity: item.quantity,
    quantityLabel: translate('qty'),
    facilityLabel: facilityLabel(item),
    facilityWarning: props.shortStock?.[item.orderItemSeqId] !== undefined,
    facilityDisabled: props.itemActions[item.orderItemSeqId]?.facilityDisabled,
    attributesLabel: translate('{count} attributes', { count: attributeCount }),
    statuses: item.statuses,
    statusDetail: item.shipGroupSeqId ? translate('#{id}', { id: item.shipGroupSeqId }) : '',
    amount: money(item.unitPrice * item.quantity),
    adjustments: item.adjustments.map((adj) => ({ label: adj.comment, amount: money(adj.amount) })),
    'onUpdate:selected': (selected: boolean) => selectItems([item], selected),
    onFacilityClick: () => emit('reject-and-release', item),
    onAttributesClick: () => emit('open-item-attributes', item),
  };
}

</script>

<style scoped src="./orderDetailCardHeader.css"></style>

<style scoped>
.order-items-list {
  padding-block-start: var(--spacer-sm);
}

.order-items-toolbar {
  display: flex;
  align-items: center;
  min-height: 5rem;
}

.order-items-toolbar > ion-checkbox {
  flex: none;
  margin-inline-start: var(--spacer-sm);
}

.order-items-toolbar > ion-item {
  flex: 1;
}

.order-items .order-summary {
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
}

.order-summary {
  display: grid;
  align-items: start;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacer-sm);
}

@media (max-width: 699px) {
  .order-items .order-summary {
    grid-template-columns: 1fr;
  }
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
