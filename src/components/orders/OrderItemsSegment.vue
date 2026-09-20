<template>
  <div class="order-items">
    <ion-list lines="none" class="order-items-list">
      <ion-item lines="full" class="order-items-toolbar">
        <ion-checkbox
          :checked="areAllSelected"
          justify="start"
          label-placement="end"
          @ionChange="$emit('toggle-select-all', $event.detail.checked)"
        >
          {{ translate('Select all') }}
        </ion-checkbox>
        <ion-button
          v-if="!['ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(order?.statusId)"
          slot="end"
          fill="outline"
          color="medium"
          @click="$emit('open-add-item')"
        >
          {{ translate('Add items') }}
        </ion-button>
      </ion-item>
      <ion-accordion-group>
        <template v-for="{ group, soleItem } in itemGroups" :key="group.externalId">
          <!-- Nothing to roll up when the group is a single order item, so the item row is
               rendered directly with the product identity the rolled up header would carry. -->
          <OrderItemListRow
            v-if="soleItem"
            :primary="groupPrimaryIdentifier(group)"
            :secondary="groupSecondaryIdentifier(group)"
            :badge-label="isKit(group) ? translate('Kit') : ''"
            :features="productFeatureLabel(group.productId)"
            :image-url="getProduct(group.productId)?.mainImageUrl"
            :preview-product="getProduct(group.productId)"
            :selected="soleItem.selected"
            :quantity="soleItem.quantity"
            :quantity-label="translate('qty')"
            :facility-label="soleItem.facilityName"
            :facility-disabled="isItemFacilityActionDisabled(soleItem)"
            :attributes-label="attributeChipLabel(soleItem.attributeCount)"
            :statuses="soleItem.statuses"
            :status-detail="itemStatusDetail(soleItem)"
            :amount="money(itemLineTotal(soleItem), order.currency)"
            :adjustments="getItemAdjustmentRows(soleItem)"
            @update:selected="soleItem.selected = $event"
            @facility-click="$emit('reject-and-release', soleItem)"
            @attributes-click="$emit('open-item-attributes', soleItem)"
          >
            <template #actions>
              <ion-button
                v-if="canRequestInventoryTransfer && isInventoryTransferRequestEligible(soleItem)"
                fill="clear"
                size="small"
                @click.stop="$emit('request-inventory-transfer', soleItem)"
              >
                {{ translate('Request transfer') }}
              </ion-button>
              <ion-button
                v-if="isItemCancelAllowed(soleItem)"
                fill="clear"
                size="small"
                color="danger"
                @click.stop="$emit('cancel-single-item', soleItem)"
              >
                {{ translate('Cancel') }}
              </ion-button>
            </template>
          </OrderItemListRow>
          <ion-accordion v-else :value="group.externalId">
            <OrderItemListRow
              slot="header"
              :select-on-row-click="false"
              :primary="groupPrimaryIdentifier(group)"
              :secondary="groupSecondaryIdentifier(group)"
              :badge-label="isKit(group) ? translate('Kit') : ''"
              :features="productFeatureLabel(group.productId)"
              :image-url="getProduct(group.productId)?.mainImageUrl"
              :preview-product="getProduct(group.productId)"
              :selected="group.selected"
              :quantity="group.totalQty"
              :quantity-label="translate('qty')"
              :facility-label="groupLocationLabel(group)"
              :facility-disabled="true"
              :statuses="group.statuses"
              :amount="money(group.totalPrice, order.currency)"
              :adjustments="getGroupAdjustmentRows(group)"
              @update:selected="group.selected = $event"
            />
            <div slot="content">
              <ion-list lines="none">
                <OrderItemListRow
                  v-for="item in group.items"
                  :key="item.orderItemSeqId"
                  class="order-item-detail-entry"
                  :primary="`${translate('Item')} ${item.orderItemSeqId}`"
                  :secondary="item.externalId && item.externalId !== 'null' ? `${translate('External ID')}: ${item.externalId}` : ''"
                  :selected="item.selected"
                  :quantity="item.quantity"
                  :quantity-label="translate('qty')"
                  :show-quantity="false"
                  :facility-label="item.facilityName"
                  :facility-disabled="isItemFacilityActionDisabled(item)"
                  :attributes-label="attributeChipLabel(item.attributeCount)"
                  :statuses="item.statuses"
                  :status-detail="itemStatusDetail(item)"
                  :amount="money(itemLineTotal(item), order.currency)"
                  :adjustments="getItemAdjustmentRows(item)"
                  @update:selected="item.selected = $event"
                  @facility-click="$emit('reject-and-release', item)"
                  @attributes-click="$emit('open-item-attributes', item)"
                >
                  <template #actions>
                    <ion-button
                      v-if="canRequestInventoryTransfer && isInventoryTransferRequestEligible(item)"
                      fill="clear"
                      size="small"
                      @click.stop="$emit('request-inventory-transfer', item)"
                    >
                      {{ translate('Request transfer') }}
                    </ion-button>
                    <ion-button
                      v-if="isItemCancelAllowed(item)"
                      fill="clear"
                      size="small"
                      color="danger"
                      @click.stop="$emit('cancel-single-item', item)"
                    >
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

    <!-- Totals Card -->
    <div class="order-summary">
      <ion-card class="payment-card">
        <ion-card-header>
          <ion-card-title>{{ translate('Payment') }}</ion-card-title>
          <ion-card-subtitle v-if="order.payments.length" :color="paymentNetColor">
            {{ translate('Net') }} {{ money(paymentNetAmount, order.currency) }}
          </ion-card-subtitle>
        </ion-card-header>
        <ion-list lines="none">
          <template v-for="section in paymentSections" :key="section.statusId">
            <ion-item-divider color="light">
              <ion-label>{{ section.label }}</ion-label>
              <ion-label slot="end">{{ money(section.total, order.currency) }}</ion-label>
            </ion-item-divider>
            <ion-item v-for="(payment, index) in section.payments" :key="payment.id || `${payment.paymentMethodTypeId}-${index}`">
              <ion-label>
                <p class="overline">{{ payment.paymentMethodTypeId || payment.method }}</p>
                {{ payment.paymentMethodTypeDesc || payment.method }}
                <p>{{ payment.statusDesc || payment.status || payment.statusId }}</p>
                <p v-if="payment.createdDate">{{ formatDateTime(payment.createdDate) }}</p>
                <template v-if="canViewReturns">
                  <ion-button
                    v-for="returnId in carriedOverReturnIds(payment)"
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
                </template>
              </ion-label>
              <ion-label slot="end">{{ money(payment.amount, order.currency) }}</ion-label>
            </ion-item>
          </template>
          <ion-item v-if="!order.payments.length">
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
            <ion-label slot="end">{{ money(orderTotals.subtotal, order.currency) }}</ion-label>
          </ion-item>
          <ion-item v-for="adjustment in (orderTotals.adjustmentRows || [])" :key="adjustment.label">
            <ion-label>
              {{ adjustment.label }}
              <p v-if="adjustment.detail">{{ adjustment.detail }}</p>
            </ion-label>
            <ion-note slot="end" :color="adjustment.isIncluded ? 'medium' : undefined">
              {{ money(adjustment.amount, order.currency) }}
              <template v-if="adjustment.isIncluded"> ({{ translate('included') }})</template>
            </ion-note>
          </ion-item>
          <ion-item class="grand-total-row">
            <ion-label>{{ translate('Grand total') }}</ion-label>
            <ion-label slot="end" color="dark">{{ money(orderTotals.total, order.currency) }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate('Payment received') }}</ion-label>
            <ion-label slot="end">{{ money(paymentReceivedTotal, order.currency) }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/vue';
import { openOutline } from 'ionicons/icons';
import OrderItemListRow from '@/components/orders/OrderItemListRow.vue';

defineProps<{
  order: any;
  areAllSelected: boolean;
  itemGroups: any[];
  orderTotals: any;
  paymentReceivedTotal: number;
  paymentSections: any[];
  paymentNetAmount: number;
  paymentNetColor: string;
  canViewReturns: boolean;
  canRequestInventoryTransfer: boolean;
  isKit: (g: any) => boolean;
  getProduct: (productId: string) => any;
  productFeatureLabel: (productId: string) => string;
  groupPrimaryIdentifier: (g: any) => string;
  groupSecondaryIdentifier: (g: any) => string;
  groupLocationLabel: (g: any) => string;
  attributeChipLabel: (c: number) => string;
  isItemFacilityActionDisabled: (item: any) => boolean;
  itemStatusDetail: (item: any) => string;
  itemLineTotal: (item: any) => number;
  getItemAdjustmentRows: (item: any) => any[];
  getGroupAdjustmentRows: (group: any) => any[];
  isInventoryTransferRequestEligible: (item: any) => boolean;
  isItemCancelAllowed: (item: any) => boolean;
  carriedOverReturnIds: (payment: any) => string[];
  money: (amount: any, currency?: string) => string;
  formatDateTime: (dt: any) => string;
  translate: (key: string) => string;
}>();

defineEmits<{
  (e: 'toggle-select-all', checked: boolean): void;
  (e: 'open-add-item'): void;
  (e: 'reject-and-release', item: any): void;
  (e: 'open-item-attributes', item: any): void;
  (e: 'request-inventory-transfer', item: any): void;
  (e: 'cancel-single-item', item: any): void;
}>();
</script>

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
