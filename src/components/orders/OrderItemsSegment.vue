<template>
  <div class="order-items">
    <ion-list lines="none" class="order-items-list">
      <ion-item lines="full" class="order-items-toolbar">
        <ion-checkbox :checked="areAllSelected" justify="start" label-placement="end"
          @ionChange="selectItems(allItems, $event.detail.checked)">{{ translate('Select all') }}</ion-checkbox>
        <ion-button v-if="!['ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(order.statusId)" slot="end" fill="outline" color="medium" @click="emit('add-item')">
          {{ translate('Add items') }}
        </ion-button>
      </ion-item>
      <ion-accordion-group>
        <template v-for="group in order.groupedItems" :key="group.externalId">
          <!-- Nothing to roll up when the group is a single order item, so the item row is
               rendered directly with the product identity the rolled up header would carry. -->
          <OrderItemListRow
            v-if="group.items.length === 1"
            v-bind="productRowProps(group)"
            :selected="isSelected(group.items[0])"
            :quantity="group.items[0].quantity"
            :quantity-label="translate('qty')"
            :facility-label="group.items[0].facilityName"
            :facility-disabled="itemActions[group.items[0].orderItemSeqId]?.facilityDisabled"
            :attributes-label="attributeChipLabel(group.items[0].attributeCount)"
            :statuses="group.items[0].statuses"
            :status-detail="itemStatusDetail(group.items[0])"
            :amount="money(group.items[0].unitPrice * group.items[0].quantity)"
            :adjustments="itemAdjustmentRows(group.items[0])"
            @update:selected="selectItems(group.items, $event)"
            @facility-click="emit('reject-and-release', group.items[0])"
            @attributes-click="emit('open-item-attributes', group.items[0])"
          >
            <template #actions>
              <ion-button v-if="itemActions[group.items[0].orderItemSeqId]?.canTransfer" fill="clear" size="small"
                @click.stop="emit('request-inventory-transfer', group.items[0])">
                {{ translate('Request transfer') }}
              </ion-button>
              <ion-button v-if="itemActions[group.items[0].orderItemSeqId]?.canCancel" fill="clear" size="small" color="danger"
                @click.stop="emit('cancel-single-item', group.items[0])">
                {{ translate('Cancel') }}
              </ion-button>
            </template>
          </OrderItemListRow>
          <ion-accordion v-else :value="group.externalId">
            <OrderItemListRow
              slot="header"
              :select-on-row-click="false"
              v-bind="productRowProps(group)"
              :selected="group.items.every(isSelected)"
              :quantity="group.totalQty"
              :quantity-label="translate('qty')"
              :facility-label="group.locationLabel"
              :facility-disabled="true"
              :statuses="group.statuses"
              :amount="money(group.totalPrice)"
              :adjustments="group.adjustments.map((adj) => ({ label: adj.isIncluded ? `${adj.label} (${translate('included')})` : adj.label, amount: money(adj.amount) }))"
              @update:selected="selectItems(group.items, $event)"
            />
            <div slot="content">
              <ion-list lines="none">
                <OrderItemListRow
                  v-for="item in group.items"
                  :key="item.orderItemSeqId"
                  class="order-item-detail-entry"
                  :primary="`${translate('Item')} ${item.orderItemSeqId}`"
                  :secondary="item.externalId && item.externalId !== 'null' ? `${translate('External ID')}: ${item.externalId}` : ''"
                  :selected="isSelected(item)"
                  :quantity="item.quantity"
                  :quantity-label="translate('qty')"
                  :show-quantity="false"
                  :facility-label="item.facilityName"
                  :facility-disabled="itemActions[item.orderItemSeqId]?.facilityDisabled"
                  :attributes-label="attributeChipLabel(item.attributeCount)"
                  :statuses="item.statuses"
                  :status-detail="itemStatusDetail(item)"
                  :amount="money(item.unitPrice * item.quantity)"
                  :adjustments="itemAdjustmentRows(item)"
                  @update:selected="selectItems([item], $event)"
                  @facility-click="emit('reject-and-release', item)"
                  @attributes-click="emit('open-item-attributes', item)"
                >
                  <template #actions>
                    <ion-button v-if="itemActions[item.orderItemSeqId]?.canTransfer" fill="clear" size="small"
                      @click.stop="emit('request-inventory-transfer', item)">
                      {{ translate('Request transfer') }}
                    </ion-button>
                    <ion-button v-if="itemActions[item.orderItemSeqId]?.canCancel" fill="clear" size="small" color="danger"
                      @click.stop="emit('cancel-single-item', item)">
                      {{ translate('Cancel') }}
                    </ion-button>
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
            {{ translate('Net') }} {{ money(order.payments.netAmount) }}
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
                  <ion-icon slot="start" :icon="openOutline" />
                  {{ translate('Return') }} {{ returnId }}
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
import { IonAccordion, IonAccordionGroup, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonIcon, IonItem, IonItemDivider, IonLabel, IonList } from '@ionic/vue';
import { openOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import OrderItemListRow from '@/components/orders/OrderItemListRow.vue';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { isKit } from '@/utils';
import { formatDateTime } from '@/utils/orderDetailDates';
import type { EnrichedItemGroup, EnrichedOrder, EnrichedOrderItem } from '@/types/orderDetail';

const props = defineProps<{
  order: EnrichedOrder;
  selectedItemIds: Set<string>;
  /** Per order item, what its row may offer — decided by the page's action validator. */
  itemActions: Record<string, { canCancel: boolean; canTransfer: boolean; facilityDisabled: boolean }>;
  /** Returns carried over onto exchange credit/payment preferences, keyed by payment id. */
  paymentReturnIds: Record<string, string[]>;
}>();

const emit = defineEmits<{
  'update:selectedItemIds': [ids: Set<string>];
  'add-item': [];
  'reject-and-release': [item: EnrichedOrderItem];
  'open-item-attributes': [item: EnrichedOrderItem];
  'request-inventory-transfer': [item: EnrichedOrderItem];
  'cancel-single-item': [item: EnrichedOrderItem];
}>();

const { getProduct, primaryIdentifier, secondaryIdentifier, featureLabel } = useProductIdentity();

const allItems = computed(() => props.order.groupedItems.flatMap((group) => group.items));
const areAllSelected = computed(() => allItems.value.length > 0 && allItems.value.every(isSelected));

function isSelected(item: EnrichedOrderItem) {
  return props.selectedItemIds.has(item.orderItemSeqId);
}

function selectItems(items: EnrichedOrderItem[], selected: boolean) {
  const ids = new Set(props.selectedItemIds);
  items.forEach((item) => selected ? ids.add(item.orderItemSeqId) : ids.delete(item.orderItemSeqId));
  emit('update:selectedItemIds', ids);
}

const money = (value: number) => commonUtil.formatCurrency(value, props.order.currency || 'USD');

/** The product identity a rolled up (or sole item) row shows. */
function productRowProps(group: EnrichedItemGroup) {
  const product = getProduct(group.productId);
  return {
    primary: primaryIdentifier(group.productId) || group.name || group.externalId,
    secondary: secondaryIdentifier(group.productId) || group.externalId,
    badgeLabel: isKit(group) ? translate('Kit') : '',
    features: featureLabel(group.productId),
    imageUrl: product?.mainImageUrl,
    previewProduct: product,
  };
}

const attributeChipLabel = (count: number) => `${count || 0} ${Number(count) === 1 ? translate('attribute') : translate('attributes')}`;
const itemStatusDetail = (item: EnrichedOrderItem) => item.shipGroupSeqId ? `${translate('#')}${item.shipGroupSeqId}` : '';
const itemAdjustmentRows = (item: EnrichedOrderItem) => item.adjustments.map((adj) => ({ label: adj.comment, amount: money(adj.amount) }));

</script>

<style scoped src="./orderDetailCardHeader.css"></style>

<style scoped>
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
