<template>
  <TaskCardShell
    :title="getCardTitle(task)"
    :subtitle="taskItemSummary(task)"
    :contact-name="getCustomerName(task.customer)"
    :contact-phone="getPhoneNumber(task)"
    :contact-phone-href="getPhoneHref(task)"
    :contact-email="getEmailAddress(task)"
    :contact-email-href="getEmailHref(task)"
    content-layout="grid"
    :selectable="selectable"
    :selected="selected"
    @update:selected="emit('update:selected', $event)"
  >
    <template #heading-end>
      <ion-note slot="end">{{ brokerageLabel(task) }}</ion-note>
    </template>

    <template #content-start>
      <ion-list lines="full" v-if="hasRoutingDetails(task)">
        <ion-item>
          <ion-icon slot="start" :icon="gitBranchOutline" />
          <ion-label>
            <p class="overline">{{ routingMovementLabel(task) }}</p>
            {{ routingPath(task) || translate('Routing details') }}
          </ion-label>
          <ion-note slot="end" v-if="routingTimestamp(task)">{{ formatRoutingTimestamp(task) }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>
            {{ translate('Routing justification') }}
            <p v-if="routingJustification(task)">{{ routingJustification(task) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </template>

    <ion-list lines="none">
      <ion-list-header>
        <ion-label>{{ translate('Ordered items') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="item in task.items" :key="item.orderItemSeqId">
        <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="getProduct(item.productId)?.mainImageUrl">
          <DxpShopifyImg :src="getProduct(item.productId).mainImageUrl" :key="getProduct(item.productId).mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ productPrimary(item) }}
          <p>{{ productSecondary(item) }}</p>
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-label>{{ translate('Original total') }}</ion-label>
        <ion-note slot="end" color="dark">{{ money(task.grandTotal) }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-list lines="none" v-if="task.items?.length">
      <ion-list-header>
        <ion-label>{{ translate('Suggested items') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="(suggested, index) in getSuggestedItems(task).list" :key="`suggested-${index}`">
        <ion-thumbnail slot="start" :key="getProduct(suggested.productId)?.mainImageUrl">
          <DxpShopifyImg :src="getProduct(suggested.productId)?.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          <p class="overline" v-if="suggested._isSubstitute">{{ translate('Approved swap') }}</p>
          <p class="overline" v-else-if="suggested._noReplacement">{{ translate('No replacement in stock') }}</p>
          {{ productPrimary(suggested) }}
          <p>{{ productSecondary(suggested) }}</p>
        </ion-label>

        <template v-if="suggested._cancel">
          <ion-badge slot="end" color="danger">{{ translate('Cancel') }}</ion-badge>
          <ion-button slot="end" fill="clear" color="medium" @click="revertCancel(task, suggested)">
            <ion-icon slot="icon-only" :icon="arrowUndoOutline" />
          </ion-button>
        </template>
        <template v-else-if="suggested._isSubstitute">
          <ion-badge slot="end" color="success">{{ translate('Available') }}</ion-badge>
          <ion-button slot="end" fill="clear" color="danger" @click="removeSuggestedSubstitute(task, suggested)">
            <ion-icon slot="icon-only" :icon="closeCircleOutline" />
          </ion-button>
        </template>
        <ion-badge v-else-if="!suggested._noReplacement" slot="end" color="success">{{ translate('Available') }}</ion-badge>
        <ion-badge v-else slot="end" color="danger">{{ translate('Cancel') }}</ion-badge>

        <ion-button slot="end" fill="clear" color="medium" @click="openSuggestedProductActionsPopover($event, suggested, task)">
          <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
        </ion-button>
      </ion-item>
      <ion-item>
        <ion-label>{{ translate('New total') }}</ion-label>
        <ion-note slot="end" color="dark">{{ money(getSuggestedItems(task).newTotal) }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-input
          :label="translate('Suggested refund')"
          label-placement="start"
          type="number"
          :value="getSuggestedItems(task).suggestedRefund"
          :helper-text="`${money(task.grandTotal)} ${translate('available to refund')}`"
          :clear-input="true"
          @ionInput="task._refundAmount = $event.detail.value != null ? Number($event.detail.value) : undefined"
          @ionClear="task._refundAmount = undefined"
        >
          <span slot="start">$</span>
        </ion-input>
      </ion-item>
    </ion-list>

    <template #actions>
      <ion-button fill="clear" color="primary" @click="releaseUpdatedOrder(task)">{{ translate('Release updated order') }}</ion-button>
      <ion-button fill="clear" color="danger" @click="cancelOrder(task)">{{ translate('Cancel order') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="parkOrder(task)">{{ translate('Park') }}</ion-button>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonBadge, IonButton, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonThumbnail, alertController, popoverController, modalController } from '@ionic/vue';
import { arrowUndoOutline, closeCircleOutline, ellipsisVerticalOutline, gitBranchOutline } from 'ionicons/icons';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { DateTime } from 'luxon';
import { confirmParkOrder, showToast } from '@/utils';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import SuggestedProductActionPopover from '@/components/swaps/SuggestedProductActionPopover.vue';
import TaskCardShell from '@/components/tasks/TaskCardShell.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductStore } from '@/store/productStore';
import { useStockStore } from '@/store/stock';
import { isSwapItemUnavailable } from '@/utils/swapItems';

const props = withDefaults(defineProps<{ task: any; selectable?: boolean; selected?: boolean }>(), {
  selectable: false,
  selected: false,
});

const emit = defineEmits<{ (e: 'update:selected', value: boolean): void; (e: 'completed'): void }>();

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || translate('Unknown');
}

function getCardTitle(task: any): string {
  return seedStore.facilityName(task.facilityId) || task.orderName;
}

function routingFacilityName(task: any): string {
  return seedStore.facilityName(task.facilityId)
    || task.routingFacilityName
    || task.facilityName
    || task.facilityId
    || '';
}

function routingMovementLabel(task: any): string {
  const facilityName = routingFacilityName(task);
  return facilityName ? `${translate('Moved to')} ${facilityName}` : translate('Moved to parking');
}

function routingPath(task: any): string {
  const routingParts = [
    task.routingGroupName || task.routingGroupId,
    task.orderRoutingName || task.orderRoutingId,
    task.routingRuleName || task.routingRuleId,
  ].filter(Boolean);

  if (routingParts.length) return routingParts.join(' > ');

  return task.routingFacilityName || task.routingDescription || '';
}

function routingJustification(task: any): string {
  return task.routingJustification
    || task.routingJustificationDescription
    || task.changeReasonDescription
    || task.changeReasonEnumId
    || '';
}

function routingTimestamp(task: any): string | number {
  return task.facilityChangeDateTime
    || task.facilityChangeDate
    || task.routingDate
    || task.lastUpdatedStamp
    || '';
}

function formatRoutingTimestamp(task: any): string {
  const value = routingTimestamp(task);
  if (!value) return '';

  const num = Number(value);
  const dt = Number.isFinite(num) && String(value).length >= 10
    ? DateTime.fromMillis(num)
    : DateTime.fromISO(String(value));

  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}

function hasRoutingDetails(task: any): boolean {
  return !!(
    task.routingFacilityName
    || task.routingDescription
    || task.routingGroupName
    || task.routingGroupId
    || task.orderRoutingName
    || task.orderRoutingId
    || task.routingRuleName
    || task.routingRuleId
    || routingJustification(task)
    || routingTimestamp(task)
  );
}

function taskItemSummary(task: any): string {
  const items = task.items ?? [];
  const itemCount = items.length;
  const unitCount = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  return `${itemCount} ${itemCount === 1 ? translate('item') : translate('items')} ${unitCount} ${unitCount === 1 ? translate('unit') : translate('units')}`;
}

function isVirtualFacility(task: any): boolean {
  return !task.facilityId
    || task.facilityParentTypeId === 'VIRTUAL_FACILITY'
    || task.facilityTypeId === 'VIRTUAL_FACILITY';
}

function brokerageLabel(task: any): string {
  return isVirtualFacility(task) ? translate('Not Brokered') : translate('Brokered');
}

function getPhoneNumber(task: any): string {
  return commonUtil.formatPhoneNumber(task.billingPhone?.countryCode, task.billingPhone?.areaCode, task.billingPhone?.contactNumber);
}

function getPhoneHref(task: any): string {
  const phone = getPhoneNumber(task);
  return phone ? `tel:${phone}` : '';
}

function getEmailAddress(task: any): string {
  return task.billingEmail ?? task.shippingEmail ?? '';
}

function getEmailHref(task: any): string {
  const email = getEmailAddress(task);
  return email ? `mailto:${email}` : '';
}

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function productPrimary(item: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.primaryId, getProduct(item.productId))
    || item.productId;
}

function productSecondary(item: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.secondaryId, getProduct(item.productId))
    || item.internalName
    || item.itemDescription
    || '';
}

function getSubstitute(item: any) {
  return item.substituteProducts?.[0];
}

function hasSubstituteStock(productId: string, facilityId: string): boolean {
  const stock = useStockStore().getProductStock(productId, facilityId);
  return (stock?.computedAtp ?? 0) > 0;
}

function getSuggestedItems(task: any): { list: any[]; newTotal: number; suggestedRefund: number } {
  const { items, grandTotal, facilityId } = task;
  let newTotal = 0;
  const list = (items ?? []).map((item: any) => {
    // Custom substitute selected by user — always show it, no stock check needed
    if (item._customSubstitute) {
      const custom = item._customSubstitute;
      newTotal += (custom.price ?? 0) * (item.quantity ?? 1);
      return { ...custom, quantity: item.quantity, _isSubstitute: true, _cancel: false, _noReplacement: false, _sourceOrderItemSeqId: item.orderItemSeqId };
    }

    const substitute = getSubstitute(item);
    const substituteAvailable = substitute && hasSubstituteStock(substitute.productId, facilityId);

    // User marked item for cancellation — show original with cancel state
    if (item._cancel) {
      newTotal += (item.unitPrice ?? 0) * (item.quantity ?? 1);
      return { ...item, _isSubstitute: false, _cancel: true, _noReplacement: false, _sourceOrderItemSeqId: item.orderItemSeqId };
    }

    // Unavailable item with a substitute that has stock — show substitute
    if (isSwapItemUnavailable(item) && substituteAvailable) {
      newTotal += (substitute.price ?? 0) * (item.quantity ?? 1);
      return { ...substitute, quantity: item.quantity, _isSubstitute: true, _cancel: false, _noReplacement: false, _sourceOrderItemSeqId: item.orderItemSeqId };
    }

    // Unavailable item but no substitute or substitute out of stock — show original with no replacement
    if (isSwapItemUnavailable(item)) {
      newTotal += (item.unitPrice ?? 0) * (item.quantity ?? 1);
      return { ...item, _isSubstitute: false, _cancel: false, _noReplacement: true, _sourceOrderItemSeqId: item.orderItemSeqId };
    }

    // Item is available — show original
    newTotal += (item.unitPrice ?? 0) * (item.quantity ?? 1);
    return { ...item, _isSubstitute: false, _cancel: false, _noReplacement: false, _sourceOrderItemSeqId: item.orderItemSeqId };
  });
  const suggestedRefund = grandTotal > newTotal ? grandTotal - newTotal : 0;
  return { list, newTotal, suggestedRefund };
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const openSuggestedProductActionsPopover = async (event: Event, item: any, task: any) => {
  const popover = await popoverController.create({
    component: SuggestedProductActionPopover,
    componentProps: { item, task },
    showBackdrop: false,
    event: event
  });
  popover.present();
};

function removeSuggestedSubstitute(task: any, suggested: any) {
  const original = (task.items ?? []).find((i: any) => i.orderItemSeqId === suggested._sourceOrderItemSeqId);
  if (original) original._cancel = true;
}

function revertCancel(task: any, suggested: any) {
  const original = (task.items ?? []).find((i: any) => i.orderItemSeqId === suggested._sourceOrderItemSeqId);
  if (original) original._cancel = false;
}

async function releaseUpdatedOrder(task: any) {
  const { list, suggestedRefund } = getSuggestedItems(task);

  // Items with an approved substitute — send to swap API
  const itemSwapList = list
    .filter((suggested: any) => suggested._isSubstitute)
    .map((suggested: any) => ({
      orderItemSeqId: suggested._sourceOrderItemSeqId,
      newProductId: suggested.productId,
    }));

  // Items marked cancelled by user OR with no replacement — send to cancel API
  const itemCancelList = list
    .filter((suggested: any) => suggested._cancel || suggested._noReplacement)
    .map((suggested: any) => ({
      orderItemSeqId: suggested._sourceOrderItemSeqId,
      shipGroupSeqId: task.shipGroupSeqId,
    }));

  if (!itemSwapList.length && !itemCancelList.length) {
    await showToast(translate('No changes to apply.'));
    return;
  }

  try {
    const refundAmount = task._refundAmount ?? suggestedRefund;

    if (itemSwapList.length) {
      await orderTaskStore.swapOrder(task.orderId, task.shipGroupSeqId, itemSwapList, refundAmount > 0 ? refundAmount : undefined);
    }

    if (itemCancelList.length) {
      await orderTaskStore.cancelOrder(task.orderId, itemCancelList);
    }

    await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_COMPLETED');
    await showToast(translate('Order successfully updated and released.'));
    emit('completed');
  } catch {
    await showToast(translate('Failed to release the updated order. Please try again.'));
  }
}

async function cancelOrder(task: any) {
  const alert = await alertController.create({
    header: translate('Cancel order'),
    message: translate('Are you sure you want to cancel this order? This action cannot be undone.'),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          const items = (task.items ?? []).map((item: any) => ({
            orderItemSeqId: item.orderItemSeqId,
            shipGroupSeqId: task.shipGroupSeqId,
          }));
          await orderTaskStore.cancelOrder(task.orderId, items);
          await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_CANCELLED');
          emit('completed');
        }
      }
    ]
  });
  await alert.present();
}

async function parkOrder(task: any) {
  const confirmed = await confirmParkOrder();
  if (!confirmed) return;

  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (!facilityId) return;

  try {
    await orderTaskStore.parkOrder(task.orderId, task.shipGroupSeqId, facilityId);
    //await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_CANCELLED');
    await showToast(translate('Order successfully moved to parking.'));
    emit('completed');
  } catch {
    await showToast(translate('Failed to park the order. Please try again.'));
  }
}

defineExpose({ task: props.task });
</script>
