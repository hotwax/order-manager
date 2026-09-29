<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss()" :aria-label="translate('Close')" :title="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Inventory transfer') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list v-if="item">
      <ion-item lines="full">
        <ion-thumbnail slot="start" v-image-preview="{ mainImageUrl: product?.mainImageUrl, productName: primaryIdentifier(item.productId) || item.name }" :key="`${product?.mainImageUrl} ${primaryIdentifier(item.productId) || item.name}`">
          <DxpShopifyImg :src="product?.mainImageUrl" size="small" />
        </ion-thumbnail>
        <ion-label>
          <p class="overline">{{ translate('Item {id}', { id: item.orderItemSeqId }) }}</p>
          {{ primaryIdentifier(item.productId) || item.name }}
          <p v-if="featureLabel(item.productId)">{{ featureLabel(item.productId) }}</p>
          <p v-if="secondaryIdentifier(item.productId)">{{ secondaryIdentifier(item.productId) }}</p>
        </ion-label>
        <ion-label slot="end" class="ion-text-center">
          {{ item.quantity }}
          <p>{{ translate('qty') }}</p>
        </ion-label>
      </ion-item>

      <template v-if="transfer">
        <ion-item lines="none">
          <ion-label>
            <p class="overline">{{ translate('Inventory transfer: {id}', { id: transfer.id }) }}</p>
            {{ translate('{count} qty', { count: Number(transfer.quantity) }) }}
            <p v-if="transfer.requestedDate">
              {{ translate('Requested by {source} on {date}', { source: transfer.sourceLabel, date: formatDateTime(transfer.requestedDate) }) }}
            </p>
            <p v-if="transfer.comments">{{ transfer.comments }}</p>
          </ion-label>
          <!-- Why the transfer is in its status sits with the status. -->
          <ion-label slot="end" class="ion-text-end transfer-status">
            <ion-badge :color="statusColor(transfer)">{{ transfer.status }}</ion-badge>
            <p v-if="transfer.reason">{{ transfer.reason }}</p>
          </ion-label>
        </ion-item>

        <template v-for="side in sides" :key="side.title">
          <ion-item-divider color="light">
            <ion-label>{{ side.title }}</ion-label>
          </ion-item-divider>
          <ion-item lines="none">
            <ion-label>
              {{ side.facilityName }}
              <p>{{ side.facilityId }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-stock">
              {{ stockNow(side.facilityId, 'atp') }}
              <p>{{ translate('ATP') }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-stock">
              {{ stockNow(side.facilityId, 'qoh') }}
              <p>{{ translate('QOH') }}</p>
            </ion-label>
          </ion-item>
          <!-- Only a transfer still under way has an after; a finished one already shows in "now". -->
          <ion-item v-if="transfer.isOpen" lines="none">
            <ion-label>
              <p>{{ translate('After transfer') }}</p>
            </ion-label>
            <ion-label slot="end" class="ion-text-end transfer-stock">{{ stockAfter(side.facilityId, 'atp', side.change) }}</ion-label>
            <ion-label slot="end" class="ion-text-end transfer-stock">{{ stockAfter(side.facilityId, 'qoh', side.change) }}</ion-label>
          </ion-item>
        </template>
      </template>

      <template v-if="earlierTransfers.length">
        <ion-item-divider color="light">
          <ion-label>{{ translate('Earlier transfers') }}</ion-label>
        </ion-item-divider>
        <ion-item v-for="earlier in earlierTransfers" :key="earlier.id">
          <ion-label>
            <p class="overline">{{ earlier.id }}</p>
            {{ earlier.fromFacilityName }} → {{ earlier.toFacilityName }}
            <p v-if="earlier.requestedDate">{{ formatDateTime(earlier.requestedDate) }}</p>
            <p v-if="earlier.reason">{{ earlier.reason }}</p>
          </ion-label>
          <ion-badge slot="end" :color="statusColor(earlier)">{{ earlier.status }}</ion-badge>
        </ion-item>
      </template>
    </ion-list>
  </ion-content>

  <ion-footer v-if="transfer?.isOpen && canManage">
    <ion-toolbar>
      <ion-buttons slot="end">
        <ion-button fill="outline" color="danger" :disabled="working" @click="cancelTransfer">
          {{ translate('Cancel transfer') }}
        </ion-button>
        <ion-button fill="solid" :disabled="working" @click="completeTransfer">
          {{ translate('Complete transfer') }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
</template>

<script setup lang="ts">
import {
  IonBadge, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonItemDivider, IonLabel,
  IonList, IonThumbnail, IonTitle, IonToolbar, alertController, modalController
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { computed, ref, watch } from 'vue';
import { DxpShopifyImg, logger, translate } from '@common';
import Actions from '@/authorization/actions';
import { useProductIdentity } from '@/composables/useProductIdentity';
import { cancelInventoryTransfer, executeInventoryTransfer, fetchFacilityStock } from '@/services/inventoryTransfers';
import { useOrderDetailStore } from '@/store/orderDetail';
import { useUserStore } from '@/store/user';
import { showToast } from '@/utils';
import { formatDateTime, formatNumber } from '@/utils/format';
import type { EnrichedTransfer } from '@/types/orderDetail';

const props = defineProps<{
  orderId: string;
  orderItemSeqId: string;
}>();

const orderDetailStore = useOrderDetailStore();
const { getProduct, primaryIdentifier, secondaryIdentifier, featureLabel } = useProductIdentity();
const canManage = computed(() => useUserStore().hasPermission(Actions.APP_INVENTORY_TRANSFER_MANAGE));

// Read from the store, so completing or cancelling shows here once the transfers reload.
const item = computed(() => orderDetailStore.enrichedOrderByOrderId(props.orderId)?.shipGroups
  .flatMap((shipGroup) => shipGroup.items)
  .find((entry) => entry.orderItemSeqId === props.orderItemSeqId));
const product = computed(() => item.value && getProduct(item.value.productId));

/** The transfer still under way, or else the newest; the rest are history. */
const transfer = computed(() => item.value?.transfers.find((entry) => entry.isOpen) || item.value?.transfers[0]);
const earlierTransfers = computed(() => (item.value?.transfers || []).filter((entry) => entry !== transfer.value));

// While the transfer is open, each side shows where its stock stands now and where it would be once
// the transfer completes, with the change: out of the source, into the destination.
const sides = computed(() => transfer.value ? [
  { title: translate('Transfer from'), facilityId: transfer.value.fromFacilityId, facilityName: transfer.value.fromFacilityName, change: -transfer.value.quantity },
  { title: translate('Transfer to'), facilityId: transfer.value.toFacilityId, facilityName: transfer.value.toFacilityName, change: transfer.value.quantity },
] : []);

const stock = ref<Record<string, { atp: number; qoh: number }> | null>(null);
const working = ref(false);

async function loadStock() {
  if (!item.value || !transfer.value) return;
  try {
    stock.value = await fetchFacilityStock(item.value.productId, [transfer.value.fromFacilityId, transfer.value.toFacilityId]);
  } catch (error) {
    logger.error('Failed to load stock for the transfer', error);
  }
}
watch(() => transfer.value?.id, loadStock, { immediate: true });


function stockNow(facilityId: string, measure: 'atp' | 'qoh') {
  const current = stock.value?.[facilityId]?.[measure];
  return current === undefined ? '-' : String(current);
}

/** The stock once the transfer completes, with the change beside it: "37 (-1)". */
function stockAfter(facilityId: string, measure: 'atp' | 'qoh', change: number) {
  const current = stock.value?.[facilityId]?.[measure];
  return current === undefined ? '-' : `${formatNumber(current + change)} (${formatNumber(change, { signDisplay: 'always' })})`;
}

function statusColor(entry: EnrichedTransfer) {
  if (entry.isOpen) return 'primary';
  return entry.statusId === 'IXF_COMPLETE' ? 'success' : 'medium';
}

async function confirm(header: string, message: string, confirmText: string, cancelText: string) {
  const alert = await alertController.create({
    header,
    message,
    buttons: [{ text: cancelText, role: 'cancel' }, { text: confirmText, role: 'confirm' }],
  });
  await alert.present();
  return (await alert.onDidDismiss()).role === 'confirm';
}

async function runAction(action: () => Promise<unknown>, success: string, failure: string) {
  working.value = true;
  try {
    await action();
    await showToast(success);
    await orderDetailStore.fetchInventoryTransfers(props.orderId);
    await loadStock();
  } catch (error) {
    logger.error(failure, error);
    await showToast(failure);
  } finally {
    working.value = false;
  }
}

async function completeTransfer() {
  const open = transfer.value;
  if (!open) return;
  const confirmed = await confirm(
    translate('Complete transfer?'),
    translate('This moves {quantity} from {from} to {to} in OMS.', { quantity: open.quantity, from: open.fromFacilityName, to: open.toFacilityName }),
    translate('Complete transfer'),
    translate('Cancel'),
  );
  if (confirmed) await runAction(() => executeInventoryTransfer(open.id), translate('Transfer completed.'), translate('Failed to complete the transfer. Please try again.'));
}

async function cancelTransfer() {
  const open = transfer.value;
  if (!open) return;
  const confirmed = await confirm(
    translate('Cancel transfer?'),
    translate('The request is cancelled and no inventory moves.'),
    translate('Cancel transfer'),
    translate('Keep transfer'),
  );
  if (confirmed) await runAction(() => cancelInventoryTransfer(open.id), translate('Transfer cancelled'), translate('Failed to cancel the transfer. Please try again.'));
}
</script>

<style scoped>
/* A fixed width keeps the now and after columns lined up, since "37 (-1)" is wider than "38". */
.transfer-stock {
  min-width: 5rem;
}

/* A long status reason wraps under its badge rather than crowding out the transfer's details. */
.transfer-status {
  max-width: 40%;
}
</style>
