<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate('Bad address') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <SearchFilterCard
        v-model="searchQuery"
        :placeholder="translate('Search unfillable orders...')"
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

      <ion-item lines="none" class="select-all-item" v-if="addressValidationTasks.length">
        <ion-checkbox slot="start" v-model="selectAll" />
        <ion-label>{{ translate('Select all') }}</ion-label>
      </ion-item>

      <div class="bad-address-list">
        <ion-card v-if="addressValidationTasks.length" v-for="task in addressValidationTasks" :key="task.workEffortId">
          <ion-item lines="none">
            <ion-checkbox slot="start" v-model="selectedOrders[task.workEffortId]" />
            <ion-label>
              {{ task.orderName }}
              <p>{{ task.orderDate }}</p>
            </ion-label>
            <ion-chip slot="end" outline color="medium">
              {{ translate('Task') }}: {{ task.workEffortId }}
            </ion-chip>
            <ion-note slot="end" color="dark">{{ money(task.grandTotal) }}</ion-note>
          </ion-item>

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
            </div>

            <!-- Address Details -->
            <div class="task-details border-top ion-padding-top">
              <ion-item>
                <ion-label>
                  {{ task.description }}
                </ion-label>
              </ion-item>
              <ion-radio-group v-model="selectedAddressType[task.workEffortId]">
                <div class="address-columns">
                  <!-- Original Address -->
                  <ion-list lines="none" v-if="editableAddresses[task.workEffortId]">
                    <ion-item lines="none">
                      <ion-label>{{ translate('Original Address') }}</ion-label>
                      <ion-radio slot="end" value="original">{{ translate('Keep original') }}</ion-radio>
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Address Line 1')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].original.address1" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Address Line 2')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].original.address2" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('City')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].original.city" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Postal Code')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].original.postalCode" />
                    </ion-item>
                    <ion-item>
                      <ion-select :label="translate('Country')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].original.countryGeoId" interface="popover" @ionChange="editableAddresses[task.workEffortId].original.stateProvinceGeoId = ''">
                        <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId">{{ country.geoName }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                    <ion-item>
                      <ion-select :label="translate('State')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].original.stateProvinceGeoId" interface="popover">
                        <ion-select-option v-for="state in states" :key="state.geoId" :value="state.geoId">{{ state.geoName }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                  </ion-list>

                  <!-- Suggested Address -->
                  <ion-list lines="none" v-if="editableAddresses[task.workEffortId]">
                    <ion-item lines="none">
                      <ion-label>{{ translate('Suggested Address') }}</ion-label>
                      <ion-radio slot="end" value="suggested">{{ translate('Use suggested') }}</ion-radio>
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Address Line 1')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].suggested.address1" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Address Line 2')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].suggested.address2" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('City')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].suggested.city" />
                    </ion-item>
                    <ion-item>
                      <ion-input :label="translate('Postal Code')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].suggested.postalCode" />
                    </ion-item>
                    <ion-item>
                      <ion-select :label="translate('Country')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].suggested.countryGeoId" interface="popover" @ionChange="editableAddresses[task.workEffortId].suggested.stateProvinceGeoId = ''">
                        <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId">{{ country.geoName }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                    <ion-item>
                      <ion-select :label="translate('State')" label-placement="stacked" v-model="editableAddresses[task.workEffortId].suggested.stateProvinceGeoId" interface="popover">
                        <ion-select-option v-for="state in states" :key="state.geoId" :value="state.geoId">{{ state.geoName }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                  </ion-list>
                </div>
              </ion-radio-group>
            </div>

            <!-- Actions -->
            <div class="actions border-top ion-margin-top ion-padding-top">
              <ion-buttons>
                <ion-button fill="solid" color="primary" @click="saveAndReleaseHold(task)">{{ translate('Save and release hold') }}</ion-button>
                <ion-button fill="outline" color="danger" @click="cancelOrder(task)">{{ translate('Cancel order') }}</ion-button>
                <ion-button fill="outline" color="medium" @click="parkOrder(task)">{{ translate('Park') }}</ion-button>
              </ion-buttons>
            </div>
          </ion-card-content>
        </ion-card>
        <div class="empty-state" v-if="!addressValidationTasks.length">
          <p v-html="getEmptyMessage()"></p>
        </div>
      </div>

      <ion-infinite-scroll
        @ionInfinite="loadMoreAddressValidationTasks($event)"
        threshold="100px"
        v-if="isScrollable"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading')"
        />
      </ion-infinite-scroll>
    </ion-content>

    <ion-footer v-if="addressValidationTasks.length">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button fill="solid" color="primary" :disabled="!hasSelectedTasks" @click="bulkSaveAndReleaseHold()">{{ translate('Save and Release Hold') }}</ion-button>
          <ion-button fill="outline" color="danger" :disabled="!hasSelectedTasks" @click="bulkCancelOrder()">{{ translate('Cancel Order') }}</ion-button>
          <ion-button fill="outline" color="medium" :disabled="!hasSelectedTasks" @click="bulkParkOrder()">{{ translate('Park') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonButton, IonButtons, IonCard, IonCardContent, IonCheckbox, IonChip, IonContent, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonInput, IonItem, IonLabel, IonList, IonMenuButton, IonNote, IonPage, IonRadio, IonRadioGroup, IonSelect, IonSelectOption, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from '@ionic/vue';
import {
  personOutline,
  callOutline,
  mailOutline
} from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import { showToast } from '@/utils';
import SearchFilterCard from '@/components/common/SearchFilterCard.vue';
import FacilityModal from '@/components/fulfillment/FacilityModal.vue';
import { useOrderTaskStore } from '@/store/orderTask';
import { useSeedStore } from '@/store/seed';

const orderTaskStore = useOrderTaskStore();
const seedStore = useSeedStore();

const salesChannels = computed(() => seedStore.getEnumsByType('ORDER_SALES_CHANNEL'));
const countries = computed(() => seedStore.getCountries);
const states = computed(() => seedStore.getStates);
const getGeoIdByCode = (code: string) => seedStore.getGeoIdByCode(code);

const addressFields = [
  { key: 'address1',       label: translate('Address Line 1') },
  { key: 'address2',       label: translate('Address Line 2') },
  { key: 'city',           label: translate('City') },
  { key: 'postalCode',     label: translate('Postal Code') },
  { key: 'stateGeoName',   label: translate('State') },
  { key: 'countryGeoName', label: translate('Country') },
];

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

const searchQuery = ref('');
const dateAfter = ref('');
const dateBefore = ref('');
const orderChannel = ref('');
const selectAll = ref(false);
const selectedOrders = ref<Record<string, boolean>>({});
const selectedAddressType = ref<Record<string, string>>({});
const editableAddresses = ref<Record<string, EditableAddress>>({});

const addressValidationTasks = computed(() => orderTaskStore.getAddressValidationTasks);
const isScrollable = computed(() => orderTaskStore.isAddressValidationTasksScrollable);
const hasSelectedTasks = computed(() => Object.values(selectedOrders.value).some(Boolean));
const hasFilters = computed(() => !!(searchQuery.value || dateAfter.value || orderChannel.value));

function getEmptyMessage() {
  return hasFilters.value
    ? translate('No records found for the search criteria.')
    : translate('No records found.');
}

watch([dateAfter, dateBefore, orderChannel], () => {
  fetchAddressValidationTasks();
});

watch(selectAll, (val) => {
  addressValidationTasks.value.forEach(task => {
    selectedOrders.value[task.workEffortId] = val;
  });
});

watch(addressValidationTasks, (tasks) => {
  tasks.forEach((task: any) => {
    if (!selectedAddressType.value[task.workEffortId]) {
      selectedAddressType.value[task.workEffortId] = 'original';
    }
    if (!editableAddresses.value[task.workEffortId]) {
      editableAddresses.value[task.workEffortId] = {
        original: addressFormFrom(task.shippingAddress, task),
        suggested: suggestedAddressFormFrom(task),
      };
    }
  });
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

async function saveAndReleaseHold(task: any) {
  const type = selectedAddressType.value[task.workEffortId] as 'original' | 'suggested';
  const address = editableAddresses.value[task.workEffortId]?.[type];
  const error = validateAddress(address);
  if (error) {
    await showToast(error);
    return;
  }
  try {
    await orderTaskStore.updateShippingInformation(task.orderId, task.shipGroupSeqId, address);
    await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_COMPLETED');
    await fetchAddressValidationTasks();
  } catch {
    await showToast(translate('Failed to update shipping information. Please try again.'));
  }
}

function clearFilters() {
  searchQuery.value = '';
  dateAfter.value = '';
  dateBefore.value = '';
  orderChannel.value = '';
  fetchAddressValidationTasks();
}

function getCustomerName(customer: any): string {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || translate('Unknown');
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const fetchAddressValidationTasks = async (vSize?: any, vIndex?: any) => {
  const viewSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const viewIndex = vIndex ? vIndex : 0;
  await orderTaskStore.fetchAddressValidationTasks({
    viewSize,
    viewIndex,
    ...(dateAfter.value && { createdDate_from: new Date(dateAfter.value).getTime() }),
    ...(dateBefore.value && { createdDate_thru: new Date(dateBefore.value).getTime() }),
    ...(searchQuery.value && { orderName: searchQuery.value, orderName_op: 'like' }),
    ...(orderChannel.value && { salesChannelEnumId: orderChannel.value }),
  });
};

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
          await fetchAddressValidationTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function parkOrder(task: any) {
  const modal = await modalController.create({
    component: FacilityModal,
  });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (!facilityId) return;

  try {
    await orderTaskStore.parkOrder(task.orderId, task.shipGroupSeqId, facilityId);
    await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_PARKED');
    await showToast(translate('Order successfully moved to parking.'));
    await fetchAddressValidationTasks();
  } catch {
    await showToast(translate('Failed to park the order. Please try again.'));
  }
}

function getSelectedTasks() {
  return addressValidationTasks.value.filter((task: any) => selectedOrders.value[task.workEffortId]);
}

async function bulkSaveAndReleaseHold() {
  const tasks = getSelectedTasks();
  if (!tasks.length) return;

  const invalidTask = tasks.find((task: any) => {
    const type = selectedAddressType.value[task.workEffortId] as 'original' | 'suggested';
    return !!validateAddress(editableAddresses.value[task.workEffortId]?.[type]);
  });
  if (invalidTask) {
    const type = selectedAddressType.value[invalidTask.workEffortId] as 'original' | 'suggested';
    await showToast(validateAddress(editableAddresses.value[invalidTask.workEffortId]?.[type])!);
    return;
  }

  const alert = await alertController.create({
    header: translate('Save and release hold'),
    message: translate('Are you sure you want to save address and release hold for {count} selected order(s)?').replace('{count}', String(tasks.length)),
    buttons: [
      { text: translate('No'), role: 'cancel' },
      {
        text: translate('Yes'),
        role: 'confirm',
        handler: async () => {
          await Promise.all(tasks.map(async (task: any) => {
            const type = selectedAddressType.value[task.workEffortId] as 'original' | 'suggested';
            const address = editableAddresses.value[task.workEffortId]?.[type];
            await orderTaskStore.updateShippingInformation(task.orderId, task.shipGroupSeqId, address);
            await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_COMPLETED');
          }));
          selectedOrders.value = {};
          selectAll.value = false;
          await fetchAddressValidationTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function bulkCancelOrder() {
  const tasks = getSelectedTasks();
  if (!tasks.length) return;

  const alert = await alertController.create({
    header: translate('Cancel orders'),
    message: translate('Are you sure you want to cancel {count} selected order(s)? This action cannot be undone.').replace('{count}', String(tasks.length)),
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
          await fetchAddressValidationTasks();
        }
      }
    ]
  });
  await alert.present();
}

async function bulkParkOrder() {
  const tasks = getSelectedTasks();
  if (!tasks.length) return;

  const modal = await modalController.create({ component: FacilityModal });
  await modal.present();
  const { data: facilityId } = await modal.onWillDismiss();
  if (!facilityId) return;

  try {
    await Promise.all(tasks.map(async (task: any) => {
      await orderTaskStore.parkOrder(task.orderId, task.shipGroupSeqId, facilityId);
      await orderTaskStore.changeTaskStatus(task.workEffortId, 'TASK_PARKED');
    }));
    selectedOrders.value = {};
    selectAll.value = false;
    await showToast(translate('Orders successfully moved to parking.'));
    await fetchAddressValidationTasks();
  } catch {
    await showToast(translate('Failed to park one or more orders. Please try again.'));
  }
}

async function loadMoreAddressValidationTasks(event: any) {
  await fetchAddressValidationTasks(
    undefined,
    Math.ceil(addressValidationTasks.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)).toString()
  );
  await event.target.complete();
}

onIonViewWillEnter(() => {
  fetchAddressValidationTasks();
});
</script>

<style scoped>
.border-top {
  border-top: 1px solid var(--ion-color-light);
}

.address-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.address-columns ion-item {
  --border-width: 0;
  --inner-border-width: 0;
}
</style>
