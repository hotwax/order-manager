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

    <ion-radio-group v-if="editableAddresses" v-model="selectedAddressType" class="address-task-addresses">
      <ion-list v-for="addressOption in addressOptions" :key="addressOption.type" lines="full">
        <ion-list-header>
          <ion-label>{{ addressOption.title }}</ion-label>
          <ion-note slot="end">{{ addressOption.actionLabel }}</ion-note>
          <ion-radio slot="end" :value="addressOption.type" :aria-label="addressOption.actionLabel" />
        </ion-list-header>

        <ion-item
          v-for="row in addressRows(addressOption.type)"
          :key="row.field"
          :button="!isEditingAddressField(addressOption.type, row.field)"
          detail="false"
          @click="editAddressField(addressOption.type, row.field)"
        >
          <template v-if="isEditingAddressField(addressOption.type, row.field)">
            <ion-input
              v-if="row.control === 'text'"
              class="address-task-field-control"
              :label="row.label"
              label-placement="stacked"
              :value="fieldValue(addressOption.type, row.field)"
              @click.stop
              @ionInput="setAddressField(addressOption.type, row.field, String($event.detail.value ?? ''))"
              @ionBlur="clearEditingAddressField"
            />
            <ion-select
              v-else
              class="address-task-field-control"
              :label="row.label"
              label-placement="stacked"
              interface="popover"
              :value="fieldValue(addressOption.type, row.field)"
              @click.stop
              @ionChange="setAddressField(addressOption.type, row.field, String($event.detail.value ?? '')); clearEditingAddressField()"
            >
              <ion-select-option
                v-for="geo in row.control === 'country' ? countries : states"
                :key="geo.geoId"
                :value="geo.geoId"
              >
                {{ geo.geoName }}
              </ion-select-option>
            </ion-select>
          </template>
          <ion-label v-else>
            <p class="overline">{{ row.label }}</p>
            {{ row.value || '-' }}
          </ion-label>
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
  IonListHeader,
  IonNote,
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

type AddressType = 'original' | 'suggested';
type AddressField = 'address1' | 'address2' | 'city' | 'postalCode' | 'stateProvinceGeoId' | 'countryGeoId';
type AddressControl = 'text' | 'state' | 'country';

interface AddressOption {
  type: AddressType;
  title: string;
  actionLabel: string;
}

interface AddressRow {
  field: AddressField;
  label: string;
  value: string;
  control: AddressControl;
}

const selectedAddressType = ref<AddressType>('original');
const editableAddresses = ref<EditableAddress | null>(null);
const activeAddressField = ref<{ type: AddressType; field: AddressField } | null>(null);

const addressOptions = computed<AddressOption[]>(() => ([
  { type: 'original', title: translate('Original address'), actionLabel: translate('keep original') },
  { type: 'suggested', title: translate('Suggested address'), actionLabel: translate('use suggested') },
]));

watch(() => props.task, (task) => {
  if (!task) return;
  const suggested = suggestedAddressFormFrom(task);
  selectedAddressType.value = hasAddressValue(suggested) ? 'suggested' : 'original';
  editableAddresses.value = {
    original: addressFormFrom(task.shippingAddress, task),
    suggested,
  };
  activeAddressField.value = null;
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

function hasAddressValue(address: AddressForm): boolean {
  return [address.address1, address.address2, address.city, address.postalCode, address.stateProvinceGeoId, address.countryGeoId].some(Boolean);
}

function addressRows(type: AddressType): AddressRow[] {
  const address = editableAddresses.value?.[type];
  if (!address) return [];

  return [
    { field: 'address1', label: translate('Address line 1'), value: address.address1, control: 'text' },
    { field: 'address2', label: translate('Address line 2'), value: address.address2, control: 'text' },
    { field: 'city', label: translate('City'), value: address.city, control: 'text' },
    { field: 'postalCode', label: translate('Postal code'), value: address.postalCode, control: 'text' },
    { field: 'stateProvinceGeoId', label: translate('State'), value: seedStore.geoName(address.stateProvinceGeoId), control: 'state' },
    { field: 'countryGeoId', label: translate('Country'), value: seedStore.geoName(address.countryGeoId), control: 'country' },
  ];
}

function fieldValue(type: AddressType, field: AddressField): string {
  return editableAddresses.value?.[type]?.[field] ?? '';
}

function setAddressField(type: AddressType, field: AddressField, value: string) {
  const address = editableAddresses.value?.[type];
  if (!address) return;

  address[field] = value;

  if (field === 'countryGeoId') {
    address.stateProvinceGeoId = '';
  }
}

function editAddressField(type: AddressType, field: AddressField) {
  selectedAddressType.value = type;
  activeAddressField.value = { type, field };
}

function clearEditingAddressField() {
  activeAddressField.value = null;
}

function isEditingAddressField(type: AddressType, field: AddressField): boolean {
  return activeAddressField.value?.type === type && activeAddressField.value?.field === field;
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

function taskItemSummary(task: any): string {
  const items = task.items ?? [];
  const itemCount = items.length;
  const unitCount = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  return `${itemCount} ${itemCount === 1 ? translate('item') : translate('items')} ${unitCount} ${unitCount === 1 ? translate('unit') : translate('units')}`;
}

// Returns the validation error for the currently selected address, or null if valid.
function validate(): string | null {
  const address = editableAddresses.value?.[selectedAddressType.value];
  if (!address) return null;
  return validateAddress(address);
}

async function submitSaveAndRelease() {
  const task = props.task;
  const address = editableAddresses.value![selectedAddressType.value];
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

.address-task-field-control {
  width: 100%;
}

@media (max-width: 640px) {
  .address-task-addresses>ion-list:not(:first-child) {
    border-inline-start: 0;
  }
}
</style>
