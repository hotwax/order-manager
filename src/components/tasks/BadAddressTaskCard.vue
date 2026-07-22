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
        <ion-item button :detail="false" :disabled="!addressState.original.countryGeoId" @click="openStatePicker(addressState.original)">
          <ion-label class="geo-picker-field">
            <span class="geo-picker-label">{{ translate('State') }}</span>
            <span :class="{ 'geo-picker-placeholder': !stateName(addressState.original) }">{{ stateName(addressState.original) || (addressState.original.countryGeoId ? translate('Select') : translate('Select country first')) }}</span>
          </ion-label>
          <ion-icon slot="end" :icon="chevronDownOutline" color="medium" aria-hidden="true" />
        </ion-item>
        <InlineSearchableSelect
          :label="translate('Country')"
          :model-value="addressState.original.countryGeoId"
          :options="countryOptions"
          :placeholder="translate('Select')"
          :search-placeholder="translate('Search countries')"
          :empty-text="translate('No countries found')"
          @update:model-value="onCountrySelect(addressState.original, $event)"
        />
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
        <ion-item button :detail="false" :disabled="!addressState.suggested.countryGeoId" @click="openStatePicker(addressState.suggested)">
          <ion-label class="geo-picker-field">
            <span class="geo-picker-label">{{ translate('State') }}</span>
            <span :class="{ 'geo-picker-placeholder': !stateName(addressState.suggested) }">{{ stateName(addressState.suggested) || (addressState.suggested.countryGeoId ? translate('Select') : translate('Select country first')) }}</span>
          </ion-label>
          <ion-icon slot="end" :icon="chevronDownOutline" color="medium" aria-hidden="true" />
        </ion-item>
        <InlineSearchableSelect
          :label="translate('Country')"
          :model-value="addressState.suggested.countryGeoId"
          :options="countryOptions"
          :placeholder="translate('Select')"
          :search-placeholder="translate('Search countries')"
          :empty-text="translate('No countries found')"
          @update:model-value="onCountrySelect(addressState.suggested, $event)"
        />
      </ion-list>
    </ion-radio-group>

    <div v-else class="address-task-addresses" aria-hidden="true">
      <ion-list v-for="col in 2" :key="col" class="ion-no-padding" lines="full">
        <ion-list-header>
          <ion-label><ion-skeleton-text :animated="true" style="width: 45%" /></ion-label>
        </ion-list-header>
        <ion-item v-for="row in 6" :key="row" class="bad-address-skeleton-item">
          <ion-label>
            <ion-skeleton-text :animated="true" class="bad-address-skeleton-label" />
            <ion-skeleton-text :animated="true" class="bad-address-skeleton-value" />
          </ion-label>
        </ion-item>
      </ion-list>
    </div>

    <template #actions>
      <ion-button fill="clear" color="primary" @click="saveAndReleaseHold()">{{ translate('Save and release hold') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="cancelOrder()">{{ translate('Cancel order') }}</ion-button>
      <ion-button fill="clear" color="primary" @click="parkOrder()">{{ translate('Park') }}</ion-button>
      <ion-button v-if="showViewOrderAction && task.orderId" fill="clear" color="primary" :router-link="'/orders/' + task.orderId">{{ translate('View order') }}</ion-button>
    </template>
  </TaskCardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonSkeletonText,
  alertController,
  modalController,
} from '@ionic/vue';
import { chevronDownOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import { confirmParkOrder, showToast } from '@/utils';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import InlineSearchableSelect from '@/components/common/InlineSearchableSelect.vue';
import GeoSelectModal from '@/components/common/GeoSelectModal.vue';
import TaskCardShell from '@/components/tasks/TaskCardShell.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';
import { taskOrderTitle } from '@/utils/taskCardDisplay';
import { buildAddressState } from '@/utils/badAddressState';
import type { AddressState } from '@/types/order';

const props = withDefaults(defineProps<{
  task: any;
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

const countryOptions = computed(() => props.countries.map((country: any) => ({ value: country.geoId, label: country.geoName })));

// Editable per-card address form. Built lazily (see onMounted) from the task so
// the shell + skeleton paint first; stays null until then, which drives the
// skeleton placeholder and keeps the layout stable (no shift on hydrate).
const addressState = ref<AddressState | null>(null);

function hydrate() {
  if (addressState.value) return;
  const state = buildAddressState(props.task);
  if (state.original.countryGeoId) seedStore.loadGeoAssocs(state.original.countryGeoId);
  if (state.suggested.countryGeoId) seedStore.loadGeoAssocs(state.suggested.countryGeoId);
  addressState.value = state;
}

onMounted(() => {
  // Defer past the first paint so opening/returning to a list never blocks on
  // building every card's form synchronously.
  requestAnimationFrame(hydrate);
});

function stateName(address: AddressState['original']): string {
  if (!address.countryGeoId || !address.stateProvinceGeoId) return '';
  return seedStore.getStatesForCountry(address.countryGeoId).find((s: any) => s.geoId === address.stateProvinceGeoId)?.geoName || '';
}

function onCountrySelect(address: AddressState['original'], countryGeoId: string) {
  address.countryGeoId = countryGeoId;
  address.stateProvinceGeoId = '';
  if (countryGeoId) seedStore.loadGeoAssocs(countryGeoId);
}

async function openStatePicker(address: AddressState['original']) {
  if (!address.countryGeoId) return;
  const modal = await modalController.create({
    component: GeoSelectModal,
    componentProps: { title: translate('Select state'), items: seedStore.getStatesForCountry(address.countryGeoId), selectedGeoId: address.stateProvinceGeoId },
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'selected') address.stateProvinceGeoId = data;
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
  hydrate();
  const state = addressState.value!;
  return validateAddress(state[state.selectedAddressType]);
}

async function submitSaveAndRelease() {
  hydrate();
  const task = props.task;
  const state = addressState.value!;
  const address = state[state.selectedAddressType];
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
          try {
            await submitCancel();
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

.geo-picker-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-picker-label {
  color: var(--ion-color-medium);
  font-size: 0.75rem;
}

.geo-picker-placeholder {
  color: var(--ion-color-medium);
}

/* Skeleton rows mimic the stacked input height so hydration causes no shift. */
.bad-address-skeleton-item {
  --min-height: 57px;
}

.bad-address-skeleton-item ion-label {
  margin-top: 8px;
  margin-bottom: 8px;
}

.bad-address-skeleton-label {
  width: 35%;
  height: 10px;
  margin-bottom: 7px;
}

.bad-address-skeleton-value {
  width: 72%;
  height: 15px;
}

@media (max-width: 640px) {
  .address-task-addresses>ion-list:not(:first-child) {
    border-inline-start: 0;
  }
}
</style>
