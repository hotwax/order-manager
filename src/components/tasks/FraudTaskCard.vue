<template>
  <TaskCardShell
    :title="taskOrderTitle(task)"
    :subtitle="formatTaskDate(task.orderDate)"
    :amount="money(task.grandTotal)"
    :chip-label="task.workEffortId"
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
    <ion-list lines="full">
      <ion-list-header>
        <ion-label>{{ translate('Ordered items') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="item in task.items" :key="item.orderItemSeqId">
        <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="productImageUrl(item.productId)">
          <DxpShopifyImg :src="productImageUrl(item.productId)" :key="productImageUrl(item.productId)" size="small" />
        </ion-thumbnail>
        <ion-label>
          {{ orderedItemPrimary(item) }}
          <p>{{ orderedItemSecondary(item) }}</p>
        </ion-label>
        <ion-note slot="end">{{ item.quantity }} {{ translate('Qty') }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-list lines="full">
      <ion-list-header>
        <ion-label>{{ translate('Payment') }}</ion-label>
      </ion-list-header>
      <ion-item v-for="payment in task.payments" :key="payment.paymentMethodTypeId">
        <ion-label>
          <p class="overline">{{ payment.paymentMethodTypeId }}</p>
          {{ paymentMethodLabel(payment) }}
          <p>
            <ion-text :color="paymentStatusColor(payment)">{{ paymentStatusLabel(payment) }}</ion-text>
          </p>
        </ion-label>
        <ion-note slot="end">{{ money(payment.maxAmount) }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-list lines="none">
      <ion-list-header>
        <ion-label>{{ translate('Risk analysis') }}</ion-label>
      </ion-list-header>

      <ion-item v-for="risk in task.risks" :key="risk.providerId">
        <ion-icon slot="start" :icon="informationCircleOutline" color="medium" />
        <ion-label>
          {{ risk.providerName }} · {{ seedStore.enumDescription(risk.riskLevelEnumId) }}
          <template v-for="fact in risk.facts" :key="fact.factSeqId">
            <p>{{ fact.description }} · {{ seedStore.enumDescription(fact.sentimentEnumId) }}</p>
          </template>
        </ion-label>
      </ion-item>
    </ion-list>

    <template #actions>
      <ion-button fill="clear" color="primary" @click="resolveTask()">{{ translate('Resolve task') }}</ion-button>
      <ion-button fill="clear" color="danger" @click="cancelOrder()">{{ translate('Cancel order') }}</ion-button>
      <ion-button v-if="showViewOrderAction && task.orderId" fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
    </template>

    <template #actions-end>
      <ion-item lines="none" class="suggested-action">
        <ion-icon slot="start" :icon="hardwareChipOutline" />
        <ion-label>
          {{ translate('Suggested action') }}:
          <ion-text :color="suggestedActionColor(task)">{{ suggestedActionLabel(task) }}</ion-text>
        </ion-label>
      </ion-item>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonText, IonThumbnail, alertController } from '@ionic/vue';
import { hardwareChipOutline, informationCircleOutline } from 'ionicons/icons';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { showToast } from '@/utils';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductStore } from '@/store/productStore';
import TaskCardShell from '@/components/tasks/TaskCardShell.vue';
import { formatTaskDate, taskOrderTitle } from '@/utils/taskCardDisplay';

const props = withDefaults(defineProps<{ task: any; selectable?: boolean; selected?: boolean; showViewOrderAction?: boolean }>(), {
  selectable: false,
  selected: false,
  showViewOrderAction: false,
});

const emit = defineEmits<{
  (e: 'update:selected', value: boolean): void;
  (e: 'completed'): void;
}>();

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();
const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function productImageUrl(productId: string): string {
  return getProduct(productId)?.mainImageUrl || '';
}

function orderedItemPrimary(item: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.primaryId, getProduct(item.productId) || {})
    || item.productId;
}

function orderedItemSecondary(item: any): string {
  return commonUtil.getProductIdentificationValue(productIdentificationPref.value.secondaryId, getProduct(item.productId) || {})
    || item.internalName
    || item.itemDescription
    || '';
}

function paymentMethodLabel(payment: any): string {
  return payment.paymentMethodDescription
    || seedStore.paymentMethodDescription(payment.paymentMethodTypeId)
    || payment.paymentMethodTypeId;
}

function paymentStatusLabel(payment: any): string {
  return payment.statusDescription
    || seedStore.statusDescription(payment.statusId)
    || payment.statusId;
}

function paymentStatusColor(payment: any): string | undefined {
  const status = [payment.statusDescription, payment.statusId]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  return status.includes('PENDING') ? 'warning' : undefined;
}

function suggestedActionLabel(task: any): string {
  return task.suggestedAction
    || seedStore.enumDescription(task.riskRecommendationEnumId)
    || seedStore.enumDescription(task.recommendationEnumId)
    || translate('Review');
}

function suggestedActionColor(task: any): string | undefined {
  const recommendation = [
    task.suggestedAction,
    task.riskRecommendationEnumId,
    task.recommendationEnumId
  ].filter(Boolean).join(' ').toUpperCase();

  return recommendation.includes('CANCEL') ? 'danger' : undefined;
}

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || translate('Unknown');
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

async function resolveTask() {
  try {
    await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED');
    await showToast(translate('Task resolved successfully.'));
    emit('completed');
  } catch {
    await showToast(translate('Failed to resolve task. Please try again.'));
  }
}

async function cancelOrder() {
  const alert = await alertController.create({
    header: translate('Cancel order'),
    message: translate('Are you sure you want to cancel this order? This action cannot be undone.'),
    buttons: [
      { text: translate('Cancel'), role: 'cancel' },
      {
        text: translate('Cancel order'),
        role: 'confirm',
        handler: async () => {
          const items = (props.task.items ?? []).map((item: any) => ({
            orderItemSeqId: item.orderItemSeqId,
            shipGroupSeqId: props.task.shipGroupSeqId,
          }));
          await orderTaskStore.cancelOrder(props.task.orderId, items);
          await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_CANCELLED');
          emit('completed');
        }
      }
    ]
  });
  await alert.present();
}

// No-confirm variant for bulk resolve. Parent does not confirm resolve (matches original bulkResolve).
async function submitResolve(): Promise<void> {
  await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_COMPLETED');
}

// No-confirm variant for bulk cancel. Parent confirms once before invoking.
async function submitCancel(): Promise<void> {
  const items = (props.task.items ?? []).map((item: any) => ({
    orderItemSeqId: item.orderItemSeqId,
    shipGroupSeqId: props.task.shipGroupSeqId,
  }));
  await orderTaskStore.cancelOrder(props.task.orderId, items);
  await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_CANCELLED');
}

defineExpose({
  task: props.task,
  submitResolve,
  submitCancel,
});
</script>

<style scoped>
.suggested-action {
  width: 100%;
}
</style>
