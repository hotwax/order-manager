<template>
  <TaskCardShell
    :title="taskOrderTitle(task)"
    :subtitle="taskItemSummary(task)"
    :contact-name="getCustomerName(task.customer)"
    :contact-phone="getPhoneNumber(task)"
    :contact-phone-href="getPhoneHref(task)"
    :contact-email="getEmailAddress(task)"
    :contact-email-href="getEmailHref(task)"
    :selectable="selectable"
    :selected="selected"
    @update:selected="emit('update:selected', $event)"
  >
    <template #content-start>
      <ion-item v-if="task.description">
        <ion-label>{{ task.description }}</ion-label>
      </ion-item>
    </template>

    <ion-radio-group v-if="addressState" v-model="addressState.selectedAddressType" class="address-task-addresses">
      <ion-list class="ion-no-padding" lines="full">
        <ion-list-header>
          <ion-label>{{ translate('Original address') }}</ion-label>
          <ion-radio class="ion-margin-end" value="original" label-placement="start">{{ translate('keep original') }}</ion-radio>
        </ion-list-header>
        <ion-item>
          <ion-input :label="translate('Address line 1')" label-placement="stacked" v-model="addressState.original.address1" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Address line 2')" label-placement="stacked" v-model="addressState.original.address2" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('City')" label-placement="stacked" v-model="addressState.original.city" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Postal code')" label-placement="stacked" v-model="addressState.original.postalCode" />
        </ion-item>
        <ion-item>
          <ion-select :label="translate('State')" label-placement="stacked" v-model="addressState.original.stateProvinceGeoId" interface="popover">
            <ion-select-option v-for="state in originalStates" :key="state.geoId" :value="state.geoId">{{ state.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select :label="translate('Country')" label-placement="stacked" v-model="addressState.original.countryGeoId" interface="popover" @ionChange="onCountryChange(addressState.original, $event)">
            <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId">{{ country.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <ion-list class="ion-no-padding" lines="full">
        <ion-list-header>
          <ion-label>{{ translate('Suggested address') }}</ion-label>
          <ion-radio class="ion-margin-end" value="suggested" label-placement="start">{{ translate('use suggested') }}</ion-radio>
        </ion-list-header>
        <ion-item>
          <ion-input :label="translate('Address line 1')" label-placement="stacked" v-model="addressState.suggested.address1" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Address line 2')" label-placement="stacked" v-model="addressState.suggested.address2" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('City')" label-placement="stacked" v-model="addressState.suggested.city" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Postal code')" label-placement="stacked" v-model="addressState.suggested.postalCode" />
        </ion-item>
        <ion-item>
          <ion-select :label="translate('State')" label-placement="stacked" v-model="addressState.suggested.stateProvinceGeoId" interface="popover">
            <ion-select-option v-for="state in suggestedStates" :key="state.geoId" :value="state.geoId">{{ state.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select :label="translate('Country')" label-placement="stacked" v-model="addressState.suggested.countryGeoId" interface="popover" @ionChange="onCountryChange(addressState.suggested, $event)">
            <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId">{{ country.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>
    </ion-radio-group>

    <template #actions>
      <ion-button fill="clear" color="primary" @click="saveAndReleaseHold()">{{ translate('Save and release hold') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="cancelOrder()">{{ translate('Cancel order') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="parkOrder()">{{ translate('Park') }}</ion-button>
      <ion-button v-if="showViewOrderAction && task.orderId" fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  alertController,
  modalController,
} from '@ionic/vue';
import { commonUtil, translate } from '@common';
import { confirmParkOrder, showToast } from '@/utils';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import TaskCardShell from '@/components/tasks/TaskCardShell.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { taskOrderTitle } from '@/utils/taskCardDisplay';
import type { AddressState } from '@/types/order';

const props = withDefaults(defineProps<{
  task: any;
  addressState: AddressState;
  countries: any[];
  selectable?: boolean;
  selected?: boolean;
  showViewOrderAction?: boolean;
}>(), {
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

const originalStates = computed(() => seedStore.getStatesForCountry(props.addressState.original.countryGeoId));
const suggestedStates = computed(() => seedStore.getStatesForCountry(props.addressState.suggested.countryGeoId));

function onCountryChange(address: AddressState['original'], event: any) {
  address.stateProvinceGeoId = '';
  const countryGeoId = event.detail?.value;
  if (countryGeoId) seedStore.loadGeoAssocs(countryGeoId);
}

function validateAddress(address: AddressState['original']): string | null {
  if (!address.address1?.trim()) return translate('Address Line 1 is required');
  if (!address.city?.trim()) return translate('City is required');
  if (!address.postalCode?.trim()) return translate('Postal Code is required');
  if (!address.countryGeoId) return translate('Country is required');
  return null;
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

function taskItemSummary(task: any): string {
  const items = task.items ?? [];
  const itemCount = items.length;
  const unitCount = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  return `${itemCount} ${itemCount === 1 ? translate('item') : translate('items')} ${unitCount} ${unitCount === 1 ? translate('unit') : translate('units')}`;
}

function validate(): string | null {
  const address = props.addressState[props.addressState.selectedAddressType];
  return validateAddress(address);
}

async function submitSaveAndRelease() {
  const task = props.task;
  const address = props.addressState[props.addressState.selectedAddressType];
  await orderTaskStore.updateShippingInformation(task.orderId, task.shipGroupSeqId, address);
  await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_COMPLETED');
}

async function submitCancel() {
  const task = props.task;
  const items = (task.items ?? []).map((item: any) => ({
    orderItemSeqId: item.orderItemSeqId,
    shipGroupSeqId: task.shipGroupSeqId,
  }));
  await orderTaskStore.cancelOrder(task.orderId, items);
  await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_CANCELLED');
}

async function submitPark(facilityId: string) {
  const task = props.task;
  await orderTaskStore.parkOrder(task.orderId, task.shipGroupSeqId, facilityId, task.workEffortId);
}

async function saveAndReleaseHold() {
  const error = validate();
  if (error) {
    await showToast(error);
    return;
  }
  try {
    await submitSaveAndRelease();
    emit('completed');
  } catch {
    await showToast(translate('Failed to update shipping information. Please try again.'));
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
          await submitCancel();
          emit('completed');
        }
      }
    ]
  });
  await alert.present();
}

async function parkOrder() {
  const confirmed = await confirmParkOrder();
  if (!confirmed) return;

  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (!facilityId) return;

  try {
    await submitPark(facilityId);
    await showToast(translate('Order successfully moved to parking.'));
    emit('completed');
  } catch {
    await showToast(translate('Failed to park the order. Please try again.'));
  }
}

defineExpose({
  task: props.task,
  validate,
  submitSaveAndRelease,
  submitCancel,
  submitPark,
});
</script>

<style scoped>
.address-task-addresses {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.address-task-addresses>ion-list:not(:first-child) {
  border-inline-start: var(--border-medium);
}

@media (max-width: 640px) {
  .address-task-addresses>ion-list:not(:first-child) {
    border-inline-start: 0;
  }
}
</style>
