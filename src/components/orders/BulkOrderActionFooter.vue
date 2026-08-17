<template>
  <ion-footer>
    <ion-toolbar>
      <ion-title size="small">{{ props.orderIds.length }} {{ translate('selected') }}</ion-title>
      <ion-buttons slot="end" class="bulk-action-buttons">
        <slot name="actions-start" />
        <ion-button
          v-for="action in visibleActions"
          :key="action.key"
          :disabled="!props.orderIds.length || submitting"
          @click="runAction(action.key)"
        >
          {{ translate(action.label) }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonFooter, IonTitle, IonToolbar, modalController, useIonRouter } from '@ionic/vue';
import { computed, ref } from 'vue';
import { logger, translate } from '@common';
import AddOrderTaskModal from '@/components/tasks/AddOrderTaskModal.vue';
import CancelOpenItemsModal from '@/components/orders/CancelOpenItemsModal.vue';
import EditShipDatesModal from '@/components/orders/EditShipDatesModal.vue';
import EditShippingMethodModal from '@/components/fulfillment/EditShippingMethodModal.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import {
  BULK_ACTION_CONFIGS,
  cancelOpenItemsRecords,
  createOrderTaskRecords,
  parkOrderRecords,
  submitBulkActionMdmFile,
  updateFacilityRecords,
  updateShipDatesRecords,
  updateShipMethodRecords,
  type BulkActionKey,
  type BulkActionRecord
} from '@/services/bulkActions';
import { showToast, showToastWithAction } from '@/utils';

/**
 * The bulk action bar shared by every order list and find page.
 *
 * Each action collects its own input in a modal, turns the selection into one MDM record per
 * order, and uploads the batch as a single file. Nothing is applied inline, so the page never
 * waits on N mutations and the operator may leave as soon as the upload is acknowledged.
 */

const ACTION_LABELS: Record<BulkActionKey, string> = {
  park: 'Park orders',
  facility: 'Change facility',
  shipMethod: 'Edit shipping method',
  shipDates: 'Edit ship dates',
  cancelItems: 'Cancel open items',
  createTasks: 'Add task'
};

const props = defineProps<{
  orderIds: string[];
  actions: BulkActionKey[];
}>();

const emit = defineEmits<{
  (e: 'submitted', action: BulkActionKey): void;
}>();

const ionRouter = useIonRouter();
const submitting = ref(false);

const visibleActions = computed(() =>
  props.actions.map((key) => ({ key, label: ACTION_LABELS[key] }))
);

async function runAction(action: BulkActionKey) {
  const orderIds = [...props.orderIds];
  if (!orderIds.length || submitting.value) return;

  const records = await collectRecords(action, orderIds);
  // A null result means the operator dismissed the modal; that is not a failure.
  if (!records) return;

  submitting.value = true;
  try {
    await submitBulkActionMdmFile(BULK_ACTION_CONFIGS[action], records, action);
    // The work is now MDM's; point the operator at where they can watch it finish.
    await showToastWithAction(
      translate('Bulk request submitted for {count} order(s). View progress in Bulk actions.', { count: orderIds.length }),
      translate('View'),
      () => ionRouter.push('/bulk-actions')
    );
    emit('submitted', action);
  } catch (error) {
    logger.error(`Failed to submit bulk ${action} request`, error);
    await showToast(translate('Failed to submit bulk request. Please try again.'));
  } finally {
    submitting.value = false;
  }
}

async function collectRecords(action: BulkActionKey, orderIds: string[]): Promise<BulkActionRecord[] | null> {
  if (action === 'park') {
    const facilityId = await pickFacility('virtual', translate('Park orders'));
    return facilityId ? parkOrderRecords(orderIds, facilityId) : null;
  }

  if (action === 'facility') {
    const facilityId = await pickFacility('physical', translate('Change facility'));
    return facilityId ? updateFacilityRecords(orderIds, facilityId) : null;
  }

  if (action === 'shipMethod') {
    const data = await promptModal(EditShippingMethodModal);
    return data ? updateShipMethodRecords(orderIds, data.carrierPartyId, data.shipmentMethodTypeId) : null;
  }

  if (action === 'shipDates') {
    const data = await promptModal(EditShipDatesModal, { orderCount: orderIds.length });
    return data ? updateShipDatesRecords(orderIds, data.shipByDate) : null;
  }

  if (action === 'cancelItems') {
    const data = await promptModal(CancelOpenItemsModal, { orderCount: orderIds.length });
    return data ? cancelOpenItemsRecords(orderIds, data.reason, data.comment) : null;
  }

  const task = await promptModal(AddOrderTaskModal);
  return task
    ? createOrderTaskRecords(orderIds, {
      workEffortTypeId: task.workEffortTypeId,
      workEffortPurposeTypeId: task.workEffortPurposeTypeId,
      workEffortName: task.workEffortName,
      description: task.description
    })
    : null;
}

// FacilityModal dismisses with the bare facility id and no role, so it cannot go through
// promptModal's role check.
async function pickFacility(scope: 'virtual' | 'physical', title: string): Promise<string | null> {
  const modal = await modalController.create({
    component: FacilityModal,
    componentProps: { scope, title }
  });
  await modal.present();
  const { data } = await modal.onWillDismiss();
  return data || null;
}

async function promptModal(component: any, componentProps: Record<string, any> = {}): Promise<any | null> {
  const modal = await modalController.create({ component, componentProps });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  return role === 'confirm' && data ? data : null;
}
</script>

<style scoped>
.bulk-action-buttons {
  overflow-x: auto;
}
</style>
