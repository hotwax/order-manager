<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Swap') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search swap orders...')"
        @search="fetchSwapTasks()"
        @clear="clearFilters"
      >
        <ion-input v-model="dateAfter" :label="translate('Date after')" label-placement="stacked" type="date" />
        <ion-input v-model="dateBefore" :label="translate('Date before')" label-placement="stacked" type="date" />
        <ion-select v-model="orderChannel" :label="translate('Channel')" label-placement="stacked" interface="popover">
          <ion-select-option value="">{{ translate('All channels') }}</ion-select-option>
          <ion-select-option v-for="channel in salesChannels" :key="channel.enumId" :value="channel.enumId">
            {{ channel.description || channel.enumId }}
          </ion-select-option>
        </ion-select>
      </SearchFilterCard>

      <div class="swap-order-list">
        <ion-card v-if="swapTasks.length" v-for="task in swapTasks" :key="task.workEffortId">
          <ion-card-header>
            <div class="shipgroup-header-row">
              <ion-card-title>{{ seedStore.facilityName(task.facilityId) }}</ion-card-title>
              <ion-chip outline color="medium">
                {{ translate('Task') }}: {{ task.workEffortId }}
              </ion-chip>
            </div>
          </ion-card-header>

          <ion-card-content>
            <!-- Contact Details -->
            <div class="contact-details border-top ion-padding-top">
              <ion-item lines="none">
                <ion-icon slot="start" :icon="personOutline" />
                <ion-label>
                  {{ getCustomerName(task.customer) }}
                  <p>{{ translate('Customer') }}</p>
                </ion-label>
                <ion-buttons slot="end">
                  <ion-button fill="clear" :href="'tel:' + commonUtil.formatPhoneNumber(task.billingPhone?.countryCode, task.billingPhone?.areaCode, task.billingPhone?.contactNumber)">
                    <ion-icon slot="icon-only" :icon="callOutline" />
                  </ion-button>
                  <ion-button fill="clear" :href="'mailto:' + (task.billingEmail ?? task.shippingEmail)">
                    <ion-icon slot="icon-only" :icon="mailOutline" />
                  </ion-button>
                </ion-buttons>
              </ion-item>

              <ion-item lines="none" v-if="task.routingFacilityName">
                <ion-label>
                  <p>{{ translate('Order facility change routing') }}</p>
                  {{ task.routingFacilityName }}
                </ion-label>
              </ion-item>

              <ion-item lines="none" v-if="task.routingDescription">
                <ion-label>
                  <p>{{ translate('Routing facility change description') }}</p>
                  {{ task.routingDescription }}
                </ion-label>
              </ion-item>
            </div>

            <!-- Resolution -->
            <div class="resolution ion-margin-top ion-padding-top border-top" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <ion-list lines="none">
                <ion-list-header>
                  <ion-label>{{ translate('Ordered Items') }}</ion-label>
                </ion-list-header>
                <ion-item v-for="item in task.items" :key="item.orderItemSeqId">
                  <ion-thumbnail slot="start" v-image-preview="getProduct(item.productId)" :key="getProduct(item.productId)?.mainImageUrl">
                    <DxpShopifyImg :src="getProduct(item.productId).mainImageUrl" :key="getProduct(item.productId).mainImageUrl" size="small" />
                  </ion-thumbnail>
                  <ion-label>
                    <p class="overline">{{ commonUtil.getProductIdentificationValue(productIdentificationPref.secondaryId, getProduct(item.productId)) }}</p>
                    {{ commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(item.productId)) ? commonUtil.getProductIdentificationValue(productIdentificationPref.primaryId, getProduct(item.productId)) : item.productId }}
                  </ion-label>
                  <ion-note slot="end">{{ money(item.unitPrice) }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate('Original order total') }}</ion-label>
                  <ion-note slot="end" color="dark">{{ money(task.grandTotal) }}</ion-note>
                </ion-item>
              </ion-list>

              <ion-list lines="none" class="ion-margin-top" v-if="task.items?.length">
                <ion-list-header>
                  <ion-label>{{ translate('Suggested Items') }}</ion-label>
                </ion-list-header>
                <ion-item v-for="(suggested, index) in getSuggestedItems(task).list" :key="`suggested-${index}`">
                  <ion-thumbnail slot="start" :key="getProduct(suggested.productId)?.mainImageUrl">
                    <DxpShopifyImg :src="getProduct(suggested.productId)?.mainImageUrl" size="small" />
                  </ion-thumbnail>
                  <ion-label>
                    <p class="overline" v-if="suggested._isSubstitute">{{ translate('Approved swap') }}</p>
                    <p class="overline" v-else-if="suggested._noReplacement">{{ translate('No replacement in stock') }}</p>
                    {{ getProduct(suggested.productId)?.productName || suggested.productName }}
                    <p>{{ translate('SKU') }}: {{ getProduct(suggested.productId)?.internalName || suggested.internalName }}</p>
                  </ion-label>

                  <!-- Cancelled: danger badge + revert button -->
                  <template v-if="suggested._cancel">
                    <ion-badge slot="end" color="danger">{{ translate('Cancel') }}</ion-badge>
                    <ion-button slot="end" fill="clear" color="medium" @click="revertCancel(task, suggested)">
                      <ion-icon slot="icon-only" :icon="arrowUndoOutline" />
                    </ion-button>
                  </template>
                  <!-- Substitute with stock: Available badge + close circle button -->
                  <template v-else-if="suggested._isSubstitute">
                    <ion-badge slot="end" color="success">{{ translate('Available') }}</ion-badge>
                    <ion-button slot="end" fill="clear" color="danger" @click="removeSuggestedSubstitute(task, suggested)">
                      <ion-icon slot="icon-only" :icon="closeCircleOutline" />
                    </ion-button>
                  </template>
                  <!-- Available original item: Available badge only -->
                  <ion-badge v-else-if="!suggested._noReplacement" slot="end" color="success">{{ translate('Available') }}</ion-badge>
                  <!-- No replacement: Cancel badge only -->
                  <ion-badge v-else slot="end" color="danger">{{ translate('Cancel') }}</ion-badge>
                  
                  <ion-note slot="end">{{ money(suggested._isSubstitute ? suggested.price : suggested.unitPrice) }}</ion-note>
                  <ion-button slot="end" fill="clear" color="medium" @click="openSuggestedProductActionsPopover($event, suggested, task)">
                    <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
                  </ion-button>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate('New order total') }}</ion-label>
                  <ion-note slot="end" color="dark">{{ money(getSuggestedItems(task).newTotal) }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-input
                    :label="translate('Suggested refund')"
                    label-placement="start"
                    type="number"
                    :value="getSuggestedItems(task).suggestedRefund"
                    :helper-text="translate('Total available funds for refund')"
                    :clear-input="true"
                    @ionInput="task._refundAmount = $event.detail.value != null ? Number($event.detail.value) : undefined"
                    @ionClear="task._refundAmount = undefined"
                  >
                    <span slot="start">$</span>
                  </ion-input>
                </ion-item>
              </ion-list>
            </div>

            <!-- Actions -->
            <div class="actions ion-margin-top ion-padding-top border-top">
              <ion-buttons>
                <ion-button fill="solid" color="primary" @click="releaseUpdatedOrder(task)">{{ translate('Release updated order') }}</ion-button>
                <ion-button fill="outline" color="danger" @click="cancelOrder(task)">{{ translate('Cancel order') }}</ion-button>
                <ion-button fill="outline" color="medium" @click="parkOrder(task)">{{ translate('Park') }}</ion-button>
              </ion-buttons>
            </div>
          </ion-card-content>
        </ion-card>
        <div class="empty-state" v-if="!swapTasks.length">
          <p v-html="getEmptyMessage()"></p>
        </div>
      </div>

     <ion-infinite-scroll
        @ionInfinite="loadMoreSwapTasks($event)"
        threshold="100px"
        v-if="isScrollable"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading')"
        />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonMenuButton, IonNote, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, alertController, popoverController, modalController, onIonViewWillEnter } from '@ionic/vue';
import { arrowUndoOutline, ellipsisVerticalOutline, callOutline, closeCircleOutline, mailOutline, personOutline } from 'ionicons/icons';
import { commonUtil, DxpShopifyImg, translate } from '@common';
import { showToast } from '@/utils';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { useProductMaster } from '@/composables/useProductMaster';
import { useProductCacheStore } from '@/store/productCache';
import { useProductStore } from '@/store/productStore';
import { useStockStore } from '@/store/stock';
import SuggestedProductActionPopover from '@/components/swaps/SuggestedProductActionPopover.vue';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const getProductStock = (productId: string) => useStockStore().getProductStock(productId);

const searchQuery = ref('');
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');

const productIdentificationPref = computed(() => useProductStore().getProductIdentificationPref);
const swapTasks = computed(() => orderTaskStore.getSwapTasks);
const isScrollable = computed(() => orderTaskStore.isSwapTasksScrollable);
const hasFilters = computed(() => !!(searchQuery.value || dateAfter.value || dateBefore.value || orderChannel.value));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([dateAfter, dateBefore, orderChannel], () => {
  fetchSwapTasks();
});

function clearFilters() {
  searchQuery.value = '';
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  fetchSwapTasks();
}

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || translate('Unknown');
}

function getProduct(productId: string) {
  return useProductCacheStore().getProduct(productId);
}

function getSubstitute(item: any) {
  return item.substituteProducts?.[0];
}

function isUnavailable(item: any): boolean {
  //return item.quantityNotAvailable !== null && item.quantityNotAvailable < 0;
  return true
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
    if (isUnavailable(item) && substituteAvailable) {
      newTotal += (substitute.price ?? 0) * (item.quantity ?? 1);
      return { ...substitute, quantity: item.quantity, _isSubstitute: true, _cancel: false, _noReplacement: false, _sourceOrderItemSeqId: item.orderItemSeqId };
    }

    // Unavailable item but no substitute or substitute out of stock — show original with no replacement
    if (isUnavailable(item)) {
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

const fetchSwapTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchSwapTasks({
    viewSize,
    viewIndex,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
  });

  const productIds = swapTasks.value
    .flatMap((task: any) => task.items ?? [])
    .flatMap((item: any) => [item.productId, item.substituteProducts?.[0]?.productId])
    .filter(Boolean);

  if (productIds.length) {
    useProductMaster().init();
    await useProductMaster().prefetch(productIds);
  }

  const stockRequests = new Map();

  swapTasks.value.forEach((task: any) => {
    const facilityId = task.facilityId;

    (task.items ?? []).forEach((item: any) => {
      const productId = item.substituteProducts?.[0]?.productId;

      if (productId && facilityId) {
        const key = `${productId}|${facilityId}`;

        if (!stockRequests.has(key)) {
          stockRequests.set(key, { productId, facilityId });
        }
      }
    });
  });
  

  await Promise.all(
    [...stockRequests.values()].map((stockRequest: any) =>
      useStockStore().fetchStock(stockRequest)
    )
  );
};

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
    await fetchSwapTasks();
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
          await fetchSwapTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function parkOrder(task: any) {
  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (!facilityId) return;

  try {
    await orderTaskStore.parkOrder(task.orderId, task.shipGroupSeqId, facilityId);
    //await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_CANCELLED');
    await showToast(translate('Order successfully moved to parking.'));
    await fetchSwapTasks();
  } catch {
    await showToast(translate('Failed to park the order. Please try again.'));
  }
}

async function loadMoreSwapTasks(event: any) {
  await fetchSwapTasks(
    undefined,
    Math.ceil(swapTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  fetchSwapTasks();
});
</script>

<style scoped>
.shipgroup-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.border-top {
  border-top: 1px solid var(--ion-color-light);
}

.expand-btn {
  margin: 0;
}
</style>
