<template>
  <TaskCardShell
    :title="taskOrderTitle(task)"
    :subtitle="taskOrderSubtitle(task.orderDate, translate('Ordered'))"
    :amount="formatTaskAmount(task.grandTotal)"
    :task-created-date="task.workEffortCreatedDate"
    :contact-name="getCustomerName(task.customer)"
    :contact-phone="getPhoneNumber(task)"
    :contact-phone-href="getPhoneHref(task)"
    :contact-email="getEmailAddress(task)"
    :contact-email-href="getEmailHref(task)"
    content-layout="grid"
    :selectable="selectable"
    :selected="selected"
    :actions="cardActions"
    :view-order-link="showViewOrderAction && task.orderId ? `/orders/${task.orderId}` : ''"
    @update:selected="emit('update:selected', $event)"
    @action="handleAction"
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

      <ion-item lines="full" class="suggested-action">
        <ion-icon slot="start" :icon="hardwareChipOutline" />
        <ion-label>
          {{ translate('Suggested action') }}:
          <ion-text :color="suggestedActionColor(task)">{{ suggestedActionLabel(task) }}</ion-text>
        </ion-label>
      </ion-item>

      <ion-item v-for="fact in negativeFacts" :key="fact.factSeqId" lines="none">
        <ion-icon slot="start" :icon="alertCircleOutline" color="danger" />
        <ion-label class="ion-text-wrap">{{ fact.description }}</ion-label>
      </ion-item>
      <ion-item v-if="taskFacts.length && !negativeFacts.length" lines="none">
        <ion-icon slot="start" :icon="checkmarkCircleOutline" color="success" />
        <ion-label>{{ translate('No risk-increasing signals') }}</ion-label>
      </ion-item>

      <ion-item v-if="taskFacts.length" lines="none">
        <div class="sentiment-chips">
          <ion-chip color="danger" outline>{{ counts.negative }} {{ translate('negative') }}</ion-chip>
          <ion-chip color="medium" outline>{{ counts.neutral }} {{ translate('neutral') }}</ion-chip>
          <ion-chip color="success" outline>{{ counts.positive }} {{ translate('positive') }}</ion-chip>
        </div>
        <ion-button slot="end" fill="clear" size="small" @click="openRiskDetails">{{ translate('View details') }}</ion-button>
      </ion-item>
    </ion-list>

  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonChip, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonText, IonThumbnail, alertController, modalController } from '@ionic/vue';
import { alertCircleOutline, checkmarkCircleOutline, hardwareChipOutline } from 'ionicons/icons';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { showToast, sentimentCounts } from '@/utils';
import RiskAssessmentModal from '@/components/orders/RiskAssessmentModal.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';
import { useProductMaster } from '@/composables/useProductMaster';
import { HIDE_SHOPIFY_UNSYNCED_ACTIONS } from '@/config/featureFlags';
import TaskCardShell from '@/components/tasks/TaskCardShell.vue';
import { formatTaskAmount, taskOrderSubtitle, taskOrderTitle } from '@/utils/taskCardDisplay';
import type { TaskCardAction } from '@/types/taskCard';

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
const productMaster = useProductMaster();

const cardActions = computed<TaskCardAction[]>(() => ([
  { id: 'resolve', label: translate('Resolve task'), kind: 'primary' },
  { id: 'cancel', label: translate('Cancel order'), kind: 'danger' },
] as TaskCardAction[]).filter((action) => !(HIDE_SHOPIFY_UNSYNCED_ACTIONS && action.id === 'cancel')));

const taskFacts = computed<any[]>(() => (props.task.risks || []).flatMap((risk: any) => risk.facts || []));
const negativeFacts = computed(() => taskFacts.value.filter((fact) => fact.sentimentEnumId === 'SENT_NEGATIVE'));
const counts = computed(() => sentimentCounts(taskFacts.value));

async function openRiskDetails() {
  const modal = await modalController.create({
    component: RiskAssessmentModal,
    componentProps: { risks: props.task.risks || [] },
  });
  await modal.present();
}

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
  return productMaster.primaryId(getProduct(item.productId), [item.productId]);
}

function orderedItemSecondary(item: any): string {
  return productMaster.secondaryId(getProduct(item.productId), [item.internalName, item.itemDescription]);
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
    await submitTaskStatus('TASK_COMPLETED');
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
          try {
            const items = (props.task.items ?? []).map((item: any) => ({
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: item.shipGroupSeqId,
            }));
            await orderTaskStore.cancelOrder(props.task.orderId, items);
            await orderTaskStore.changeTaskStatus(props.task.workEffortId, 'TASK_CANCELLED');
            emit('completed');
          } catch {
            await showToast(translate('Failed to cancel the order. Please try again.'));
          }
        }
      }
    ]
  });
  await alert.present();
}

function handleAction(actionId: string) {
  if (actionId === 'resolve') return resolveTask();
  if (actionId === 'cancel') return cancelOrder();
}

// No-confirm variant for bulk resolve. Parent does not confirm resolve (matches original bulkResolve).
async function submitResolve(): Promise<void> {
  await submitTaskStatus('TASK_COMPLETED');
}

async function submitCancelDomain(): Promise<void> {
  const items = (props.task.items ?? []).map((item: any) => ({
    orderItemSeqId: item.orderItemSeqId,
    shipGroupSeqId: item.shipGroupSeqId,
  }));
  await orderTaskStore.cancelOrder(props.task.orderId, items);
}

async function submitTaskStatus(statusId: 'TASK_COMPLETED' | 'TASK_CANCELLED'): Promise<void> {
  await orderTaskStore.changeTaskStatus(props.task.workEffortId, statusId);
}

// No-confirm variant used by the single-card flow. Bulk orchestration invokes
// the target mutation and each WorkEffort transition as separate phases.
async function submitCancel(): Promise<void> {
  await submitCancelDomain();
  await submitTaskStatus('TASK_CANCELLED');
}

defineExpose({
  task: props.task,
  submitResolve,
  submitCancel,
  submitCancelDomain,
  submitTaskStatus,
});
</script>

<style scoped>
.suggested-action {
  width: 100%;
}

.sentiment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
}
</style>
