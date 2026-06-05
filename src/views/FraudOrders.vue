<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Fraud') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search fraud orders...')"
        @clear="clearFilters"
      >
        <ion-select v-model="recommendation" :label="translate('Recommendation')" label-placement="stacked" interface="popover">
          <ion-select-option value="">{{ translate('All recommendations') }}</ion-select-option>
          <ion-select-option v-for="rec in riskRecommendations" :key="rec.enumId" :value="rec.enumId">
            {{ rec.description || rec.enumId }}
          </ion-select-option>
        </ion-select>
        <ion-select v-model="orderChannel" :label="translate('Channel')" label-placement="stacked" interface="popover">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </ion-select>
        <ion-select v-model="severity" :label="translate('Severity')" label-placement="stacked" interface="popover">
          <ion-select-option value="">{{ translate('All severity') }}</ion-select-option>
          <ion-select-option v-for="level in riskLevels" :key="level.enumId" :value="level.enumId">
            {{ level.description || level.enumId }}
          </ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <ion-item lines="none" v-if="fraudTasks.length">
        <ion-checkbox slot="start" v-model="selectAll" />
        <ion-label>{{ translate('Select all') }}</ion-label>
      </ion-item>

      <div class="fraud-orders">
        <ion-card v-if="fraudTasks.length" v-for="task in fraudTasks" :key="task.workEffortId">
          <ion-item lines="none">
            <ion-checkbox slot="start" v-model="selectedOrders[task.workEffortId]" />
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
              <ion-button fill="clear" color="primary" @click="resolveTask(task)">{{ translate('Resolve task') }}</ion-button>
              <ion-button fill="clear" color="danger" @click="cancelOrder(task)">{{ translate('Cancel order') }}</ion-button>
              <ion-button fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
            </ion-buttons>
            <ion-item lines="none" class="suggested-action">
              <ion-icon slot="start" :icon="hardwareChipOutline" />
              <ion-label>{{ translate('Suggested action') }}: {{ task.suggestedAction }}</ion-label>
            </ion-item>
          </div>
        </ion-card>
        <div class="empty-state" v-if="!fraudTasks.length">
          <p v-html="getEmptyMessage()"></p>
        </div>
      </div>

      <ion-infinite-scroll
        @ionInfinite="loadMoreFraudTasks($event)"
        threshold="100px"
        v-if="isScrollable"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading')"
        />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="fraudTasks.length">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button color="primary" :disabled="!selectedTaskCount" @click="bulkResolve">{{ translate('Resolve') }}</ion-button>
          <ion-button color="danger" :disabled="!selectedTaskCount" @click="bulkCancel">{{ translate('Cancel orders') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCheckbox, IonChip, IonContent, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonNote, IonPage, IonSelect, IonSelectOption, IonThumbnail, IonTitle, IonToolbar, alertController, onIonViewWillEnter } from '@ionic/vue';
import { callOutline, checkmarkCircleOutline, cubeOutline, hardwareChipOutline, informationCircleOutline, mailOutline, personOutline, pricetagOutline, removeCircleOutline, warningOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate } from '@common';
import { showToast } from '@/utils';
import SearchFilterCard from '@/components/SearchFilterCard.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductMaster } from '@/composables/useProductMaster';
import { useProductCacheStore } from '@/store/productCache';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const riskRecommendations = computed(() => seedStore.getEnumsByType('ORDER_RISK_RECOMMENDATION'));
const riskLevels = computed(() => seedStore.getEnumsByType('ORDER_RISK_LEVEL'));

const searchQuery = ref('');
const recommendation = ref('');
const orderChannel = ref('');
const severity = ref('');
const selectAll = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});

const fraudTasks = computed(() => orderTaskStore.getFraudTasks);
const isScrollable = computed(() => orderTaskStore.isFraudTasksScrollable);
const selectedTaskCount = computed(() => Object.values(selectedOrders.value).filter(Boolean).length as number);
const hasFilters = computed(() => !!(searchQuery.value || recommendation.value || orderChannel.value || severity.value));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch(selectAll, (val) => {
  fraudTasks.value.forEach((task: any) => {
    selectedOrders.value[task.workEffortId] = val;
  });
});

watch([orderChannel, recommendation, severity], () => {
  fetchFraudTasks();
});

function clearFilters() {
  searchQuery.value = '';
  recommendation.value = '';
  orderChannel.value = '';
  severity.value = '';
  fetchFraudTasks();
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const fetchFraudTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchFraudTasks({
    viewSize,
    viewIndex,
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
    ...(recommendation.value && { riskRecommendationEnumId: recommendation.value }),
    ...(severity.value && { riskLevelEnumId: severity.value }),
  });

  const productIds = fraudTasks.value
    .flatMap((task: any) => task.items ?? [])
    .map((item: any) => item.productId)
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }
};

async function loadMoreFraudTasks(event: any) {
  await fetchFraudTasks(
    undefined,
    Math.ceil(fraudTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
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


function sentimentIcon(sentimentEnumId: string): string {
  const map: Record<string, string> = {
    SENT_POSITIVE: checkmarkCircleOutline,
    SENT_NEGATIVE: warningOutline,
    SENT_NEUTRAL: removeCircleOutline,
  };
  return map[sentimentEnumId] ?? informationCircleOutline;
}

function sentimentColor(sentimentEnumId: string): string {
  const map: Record<string, string> = {
    SENT_POSITIVE: 'success',
    SENT_NEGATIVE: 'danger',
    SENT_NEUTRAL: 'medium',
  };
  return map[sentimentEnumId] ?? 'medium';
}


async function resolveTask(task: any) {
  try {
    await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_COMPLETED');
    await showToast(translate('Task resolved successfully.'));
    await fetchFraudTasks();
  } catch {
    await showToast(translate('Failed to resolve task. Please try again.'));
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
          await fetchFraudTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function bulkResolve() {
  const tasks = fraudTasks.value.filter((task: any) => selectedOrders.value[task.workEffortId]);
  if (!tasks.length) return;
  try {
    await Promise.all(tasks.map((task: any) => orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_COMPLETED')));
    await showToast(translate('{count} tasks resolved.', { count: tasks.length }));
    selectedOrders.value = {};
    selectAll.value = false;
    await fetchFraudTasks();
  } catch {
    await showToast(translate('Failed to resolve some tasks. Please try again.'));
  }
}

async function bulkCancel() {
  const tasks = fraudTasks.value.filter((task: any) => selectedOrders.value[task.workEffortId]);
  if (!tasks.length) return;
  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} orders? This action cannot be undone.', { count: tasks.length }),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          await Promise.all(tasks.map(async (task: any) => {
            const items = (task.items ?? []).map((item: any) => ({
              orderItemSeqId: item.orderItemSeqId,
              shipGroupSeqId: task.shipGroupSeqId,
            }));
            await orderTaskStore.cancelOrder(task.orderId, items);
            await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_CANCELLED');
          }));
          selectedOrders.value = {};
          selectAll.value = false;
          await fetchFraudTasks();
        }
      }
    ]
  });
  await alert.present();
}

onIonViewWillEnter(() => {
  fetchFraudTasks();
});
</script>

<style scoped>
.fraud-orders {
  padding: 0 16px 16px;
}

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
  .fraud-orders {
    padding-inline: 0;
  }

  .card-actions {
    align-items: stretch;
  }

  .suggested-action {
    max-width: none;
  }
}
</style>
