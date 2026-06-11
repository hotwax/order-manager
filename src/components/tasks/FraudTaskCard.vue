<template>
  <ion-card>
    <ion-item lines="none">
      <ion-checkbox v-if="selectable" slot="start" :checked="selected" @ionChange="onSelectChange" />
      <ion-label>
        {{ task.orderName }}
        <p>{{ task.orderDate }}</p>
      </ion-label>
      <ion-chip slot="end" outline color="medium">
        <ion-icon :icon="pricetagOutline" />
        <ion-label>{{ task.workEffortId }}</ion-label>
      </ion-chip>
      <ion-note slot="end">{{ money(task.grandTotal) }}</ion-note>
    </ion-item>

    <ion-list lines="full" class="contact-details">
      <ion-item>
        <ion-icon slot="start" :icon="personOutline" />
        <ion-label>{{ [task.customer?.firstName, task.customer?.lastName].filter(Boolean).join(' ') || translate('Unknown') }}</ion-label>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="callOutline" />
        <ion-label>{{ [task.billingPhone?.countryCode, task.billingPhone?.areaCode, task.billingPhone?.contactNumber].filter(Boolean).join(' ') || '-' }}</ion-label>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="mailOutline" />
        <ion-label>{{ (task.billingEmail ?? task.shippingEmail) || '-' }}</ion-label>
      </ion-item>
    </ion-list>

    <ion-card-content>
      <div class="fraud-card-columns">
        <ion-list lines="full">
          <ion-list-header>
            <ion-label>{{ translate('Ordered items') }}</ion-label>
          </ion-list-header>
          <ion-item v-for="item in task.items" :key="item.orderItemSeqId">
            <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="getProduct(item.productId)?.mainImageUrl">
              <DxpShopifyImg :src="getProduct(item.productId).mainImageUrl" :key="getProduct(item.productId).mainImageUrl" size="small" />
            </ion-thumbnail>
            <ion-label>
              {{ getProduct(item.productId)?.productName || item.productName || item.itemDescription }}
              <p>{{ translate('SKU') }}: {{ getProduct(item.productId)?.internalName || item.internalName }}</p>
            </ion-label>
            <ion-note slot="end">{{ money(item.unitPrice) }}</ion-note>
          </ion-item>
        </ion-list>

        <ion-list lines="full">
          <ion-list-header>
            <ion-label>{{ translate('Payment') }}</ion-label>
          </ion-list-header>
          <ion-item v-for="payment in task.payments" :key="payment.paymentMethodTypeId">
            <ion-label>
              {{ payment.paymentMethodDescription || payment.paymentMethodTypeId }}
              <p>{{ payment.paymentMethodTypeId }}</p>
              <ion-badge color="warning">{{ payment.statusId }}</ion-badge>
            </ion-label>
            <ion-note slot="end">{{ money(payment.maxAmount) }}</ion-note>
          </ion-item>
        </ion-list>

        <ion-list lines="none">
          <ion-list-header>
            <ion-label>{{ translate('Risk analysis') }}</ion-label>
          </ion-list-header>

          <ion-item v-for="risk in task.risks" :key="risk.providerId">
            <ion-icon slot="start" :icon="informationCircleOutline" :color="riskLevelColor(risk.riskLevelEnumId)" />
            <ion-label>
              {{ risk.providerName }} · {{ seedStore.enumDescription(risk.riskLevelEnumId) }}
              <template v-for="fact in risk.facts" :key="fact.factSeqId">
                <p>{{ fact.description }} · {{ seedStore.enumDescription(fact.sentimentEnumId) }}</p>
              </template>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-card-content>

    <div class="card-actions">
      <ion-buttons class="action-buttons">
        <ion-button fill="clear" color="primary" @click="resolveTask()">{{ translate('Resolve task') }}</ion-button>
        <ion-button fill="clear" color="danger" @click="cancelOrder()">{{ translate('Cancel order') }}</ion-button>
        <ion-button fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
      </ion-buttons>
      <ion-item lines="none" class="suggested-action">
        <ion-icon slot="start" :icon="hardwareChipOutline" />
        <ion-label>{{ translate('Suggested action') }}: {{ task.suggestedAction }}</ion-label>
      </ion-item>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCheckbox, IonChip, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonThumbnail, alertController } from '@ionic/vue';
import { callOutline, hardwareChipOutline, informationCircleOutline, mailOutline, personOutline, pricetagOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate } from '@common';
import { showToast } from '@/utils';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductCacheStore } from '@/store/productCache';

const props = withDefaults(defineProps<{ task: any; selectable?: boolean; selected?: boolean }>(), {
  selectable: false,
  selected: false,
});

const emit = defineEmits<{
  (e: 'update:selected', value: boolean): void;
  (e: 'completed'): void;
}>();

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

function onSelectChange(event: any) {
  emit('update:selected', event.detail.checked);
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function riskLevelColor(riskLevelEnumId: string): string {
  const map: Record<string, string> = {
    ORLVL_HIGH: 'danger',
    ORLVL_MEDIUM: 'warning',
    ORLVL_LOW: 'success',
    ORLVL_NONE: 'medium',
    ORLVL_PENDING: 'medium',
  };
  return map[riskLevelEnumId] ?? 'medium';
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
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
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
.contact-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.fraud-card-columns {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
}

.action-buttons {
  flex-wrap: wrap;
}

.suggested-action {
  flex: 1 1 260px;
  max-width: 360px;
}

.fact-item {
  --padding-start: 32px;
}

@media (max-width: 640px) {
  .card-actions {
    align-items: stretch;
  }

  .suggested-action {
    max-width: none;
  }
}
</style>
