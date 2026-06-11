<template>
  <TaskCardShell
    :title="task.orderName"
    :subtitle="task.orderDate"
    :amount="money(task.grandTotal)"
    :chip-label="task.workEffortId"
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

    <ion-radio-group v-if="editableAddresses" v-model="selectedAddressType" class="address-task-addresses">
      <ion-list lines="none">
        <ion-item lines="none">
          <ion-label>{{ translate('Original Address') }}</ion-label>
          <ion-radio slot="end" value="original">{{ translate('Keep original') }}</ion-radio>
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Address Line 1')" label-placement="stacked" v-model="editableAddresses.original.address1" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Address Line 2')" label-placement="stacked" v-model="editableAddresses.original.address2" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('City')" label-placement="stacked" v-model="editableAddresses.original.city" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Postal Code')" label-placement="stacked" v-model="editableAddresses.original.postalCode" />
        </ion-item>
        <ion-item>
          <ion-select :label="translate('Country')" label-placement="stacked" v-model="editableAddresses.original.countryGeoId" interface="popover" @ionChange="editableAddresses.original.stateProvinceGeoId = ''">
            <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId">{{ country.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select :label="translate('State')" label-placement="stacked" v-model="editableAddresses.original.stateProvinceGeoId" interface="popover">
            <ion-select-option v-for="state in states" :key="state.geoId" :value="state.geoId">{{ state.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <ion-list lines="none">
        <ion-item lines="none">
          <ion-label>{{ translate('Suggested Address') }}</ion-label>
          <ion-radio slot="end" value="suggested">{{ translate('Use suggested') }}</ion-radio>
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Address Line 1')" label-placement="stacked" v-model="editableAddresses.suggested.address1" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Address Line 2')" label-placement="stacked" v-model="editableAddresses.suggested.address2" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('City')" label-placement="stacked" v-model="editableAddresses.suggested.city" />
        </ion-item>
        <ion-item>
          <ion-input :label="translate('Postal Code')" label-placement="stacked" v-model="editableAddresses.suggested.postalCode" />
        </ion-item>
        <ion-item>
          <ion-select :label="translate('Country')" label-placement="stacked" v-model="editableAddresses.suggested.countryGeoId" interface="popover" @ionChange="editableAddresses.suggested.stateProvinceGeoId = ''">
            <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId">{{ country.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select :label="translate('State')" label-placement="stacked" v-model="editableAddresses.suggested.stateProvinceGeoId" interface="popover">
            <ion-select-option v-for="state in states" :key="state.geoId" :value="state.geoId">{{ state.geoName }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>
    </ion-radio-group>

    <template #actions>
      <ion-button fill="clear" color="primary" @click="saveAndReleaseHold()">{{ translate('Save and release hold') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="cancelOrder()">{{ translate('Cancel order') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="parkOrder()">{{ translate('Park') }}</ion-button>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
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

const countries = computed(() => seedStore.getCountries);
const states = computed(() => seedStore.getStates);
const getGeoIdByCode = (code: string) => seedStore.getGeoIdByCode(code);

interface AddressForm {
  address1: string;
  address2: string;
  city: string;
  postalCode: string;
  stateProvinceGeoId: string;
  countryGeoId: string;
  contactMechId: string;
  contactMechPurposeTypeId: string;
  partyId: string;
  isEdited: boolean;
}

interface EditableAddress {
  original: AddressForm;
  suggested: AddressForm;
}

const selectedAddressType = ref<string>('original');
const editableAddresses = ref<EditableAddress | null>(null);

watch(() => props.task, (task) => {
  if (!task) return;
  selectedAddressType.value = 'original';
  editableAddresses.value = {
    original: addressFormFrom(task.shippingAddress, task),
    suggested: suggestedAddressFormFrom(task),
  };
}, { immediate: true });

function addressFormFrom(src: any, task: any): AddressForm {
  return {
    address1: src?.address1 ?? '',
    address2: src?.address2 ?? '',
    city: src?.city ?? '',
    postalCode: src?.postalCode ?? '',
    stateProvinceGeoId: src?.stateProvinceGeoId ?? '',
    countryGeoId: src?.countryGeoId ?? '',
    contactMechId: task?.shippingAddress?.contactMechId ?? '',
    contactMechPurposeTypeId: task?.shippingAddress?.contactMechPurposeTypeId || 'SHIPPING_LOCATION',
    partyId: task?.customer?.partyId ?? '',
    isEdited: true,
  };
}

function suggestedAddressFormFrom(task: any): AddressForm {
  let parsed: any = {};
  try {
    parsed = task.locationDesc ? JSON.parse(task.locationDesc) : {};
  } catch {
    parsed = {};
  }
  return {
    address1: parsed.address1 ?? '',
    address2: parsed.address2 ?? '',
    city: parsed.city ?? '',
    postalCode: parsed.postalCode ?? '',
    stateProvinceGeoId: getGeoIdByCode(parsed.stateOrProvinceCode ?? ''),
    countryGeoId: getGeoIdByCode(parsed.countryCode ?? ''),
    contactMechId: task?.shippingAddress?.contactMechId ?? '',
    contactMechPurposeTypeId: task?.shippingAddress?.contactMechPurposeTypeId || 'SHIPPING_LOCATION',
    partyId: task?.customer?.partyId ?? '',
    isEdited: true,
  };
}

function validateAddress(address: AddressForm): string | null {
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

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// Returns the validation error for the currently selected address, or null if valid.
function validate(): string | null {
  const type = selectedAddressType.value as 'original' | 'suggested';
  const address = editableAddresses.value?.[type];
  if (!address) return null;
  return validateAddress(address);
}

async function submitSaveAndRelease() {
  const task = props.task;
  const type = selectedAddressType.value as 'original' | 'suggested';
  const address = editableAddresses.value![type];
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
  await orderTaskStore.parkOrder(task.orderId, task.shipGroupSeqId, facilityId);
  await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_PARKED');
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
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
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

  const modal = await modalController.create({
    component: FacilityModal,
  });
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

.address-task-addresses ion-item {
  --border-width: 0;
  --inner-border-width: 0;
}

@media (max-width: 640px) {
  .address-task-addresses>ion-list:not(:first-child) {
    border-inline-start: 0;
  }
}
</style>
