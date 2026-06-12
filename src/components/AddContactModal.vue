<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ isEditMode ? 'Edit' : 'Add' }} {{ sectionLabel }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <!-- Email -->
      <template v-if="contactMechTypeId === 'EMAIL_ADDRESS'">
        <ion-item>
          <ion-input
            label="Email address"
            label-placement="stacked"
            type="email"
            placeholder="name@example.com"
            v-model="form.infoString"
            autocomplete="email"
          />
        </ion-item>
      </template>

      <!-- Phone -->
      <template v-else-if="contactMechTypeId === 'TELECOM_NUMBER'">
        <ion-item>
          <ion-input
            label="Country code"
            label-placement="stacked"
            type="tel"
            placeholder="1"
            v-model="form.countryCode"
          />
        </ion-item>
        <ion-item>
          <ion-input
            label="Area code"
            label-placement="stacked"
            type="tel"
            placeholder="415"
            v-model="form.areaCode"
          />
        </ion-item>
        <ion-item>
          <ion-input
            label="Phone number"
            label-placement="stacked"
            type="tel"
            placeholder="5550100"
            v-model="form.contactNumber"
          />
        </ion-item>
      </template>

      <!-- Postal address -->
      <template v-else-if="contactMechTypeId === 'POSTAL_ADDRESS'">
        <ion-item>
          <ion-input
            label="Address line 1"
            label-placement="stacked"
            placeholder="123 Main St"
            v-model="form.address1"
          />
        </ion-item>
        <ion-item>
          <ion-input
            label="Address line 2"
            label-placement="stacked"
            placeholder="Apt, suite, unit…"
            v-model="form.address2"
          />
        </ion-item>
        <ion-item>
          <ion-input
            label="City"
            label-placement="stacked"
            placeholder="New York"
            v-model="form.city"
          />
        </ion-item>
        <ion-item>
          <ion-select
            label="Country"
            label-placement="stacked"
            interface="popover"
            placeholder="Select country"
            v-model="form.countryGeoId"
            @ion-change="onCountryChange"
          >
            <ion-select-option
              v-for="country in countries"
              :key="country.geoId"
              :value="country.geoId"
            >
              {{ country.geoName }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <template v-if="stateOptions.length">
            <ion-select
              label="State / Province"
              label-placement="stacked"
              interface="popover"
              placeholder="Select state"
              v-model="form.stateProvinceGeoId"
            >
              <ion-select-option
                v-for="state in stateOptions"
                :key="state.geoId"
                :value="state.geoId"
              >
                {{ state.geoName }}
              </ion-select-option>
            </ion-select>
          </template>
          <template v-else>
            <ion-input
              label="State / Province"
              label-placement="stacked"
              placeholder="e.g. NY"
              v-model="form.stateProvinceGeoId"
            />
          </template>
        </ion-item>
        <ion-item>
          <ion-input
            label="Postal code"
            label-placement="stacked"
            placeholder="10001"
            v-model="form.postalCode"
          />
        </ion-item>
      </template>
    </ion-list>
    <ion-fab v-if="isEditMode" vertical="bottom" horizontal="start" slot="fixed">
      <ion-fab-button color="danger" @click="expire()">
        <ion-icon :icon="trashOutline" />
      </ion-fab-button>
    </ion-fab>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!isValid" @click="confirm()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  modalController
} from '@ionic/vue';
import { closeOutline, saveOutline, trashOutline } from 'ionicons/icons';
import { computed, onMounted, reactive } from 'vue';
import { useSeedStore } from '@/store/seed';
import type { CustomerContactMech } from '@/types/customer';

const props = defineProps<{
  contactMechTypeId: string;
  existingContact?: CustomerContactMech;
}>();

const seed = useSeedStore();

const isEditMode = computed(() => !!props.existingContact);

const sectionLabel = computed(() => {
  if (props.contactMechTypeId === 'EMAIL_ADDRESS') return 'Email';
  if (props.contactMechTypeId === 'TELECOM_NUMBER') return 'Phone';
  if (props.contactMechTypeId === 'POSTAL_ADDRESS') return 'Address';
  return 'Contact';
});

const purposeTypeId = computed(() => {
  if (props.contactMechTypeId === 'EMAIL_ADDRESS') return 'PRIMARY_EMAIL';
  if (props.contactMechTypeId === 'TELECOM_NUMBER') return 'PRIMARY_PHONE';
  if (props.contactMechTypeId === 'POSTAL_ADDRESS') return 'PRIMARY_LOCATION';
  return undefined;
});

const form = reactive<Record<string, string>>({
  infoString: '',
  countryCode: '',
  areaCode: '',
  contactNumber: '',
  address1: '',
  address2: '',
  city: '',
  stateProvinceGeoId: '',
  postalCode: '',
  countryGeoId: ''
});

const countries = computed(() => (seed as any).getCountries as Array<{ geoId: string; geoName: string }>);

const stateOptions = computed(() => {
  if (!form.countryGeoId) return [];
  return ((seed as any).getStatesForCountry(form.countryGeoId) as Array<{ geoId: string; geoName: string }>);
});

function onCountryChange() {
  form.stateProvinceGeoId = '';
  if (form.countryGeoId) {
    (seed as any).loadGeoAssocs(form.countryGeoId);
  }
}

onMounted(() => {
  if (props.contactMechTypeId === 'POSTAL_ADDRESS') {
    if ((seed as any).geos?.status !== 'loaded') {
      (seed as any).loadGeos?.();
    }
  }

  if (props.existingContact) {
    const c = props.existingContact;
    if (props.contactMechTypeId === 'EMAIL_ADDRESS') {
      form.infoString = c.infoString || '';
    } else if (props.contactMechTypeId === 'TELECOM_NUMBER') {
      form.countryCode = c.telecomNumber?.countryCode || '';
      form.areaCode = c.telecomNumber?.areaCode || '';
      form.contactNumber = c.telecomNumber?.contactNumber || '';
    } else if (props.contactMechTypeId === 'POSTAL_ADDRESS') {
      form.address1 = c.postalAddress?.address1 || '';
      form.address2 = c.postalAddress?.address2 || '';
      form.city = c.postalAddress?.city || '';
      form.stateProvinceGeoId = c.postalAddress?.stateProvinceGeoId || '';
      form.postalCode = c.postalAddress?.postalCode || '';
      form.countryGeoId = c.postalAddress?.countryGeoId || '';
      if (form.countryGeoId) {
        (seed as any).loadGeoAssocs(form.countryGeoId);
      }
    }
  }
});

const isValid = computed(() => {
  if (props.contactMechTypeId === 'EMAIL_ADDRESS') return form.infoString.trim().length > 0;
  if (props.contactMechTypeId === 'TELECOM_NUMBER') return form.contactNumber.trim().length > 0;
  if (props.contactMechTypeId === 'POSTAL_ADDRESS') {
    return form.address1.trim().length > 0 && form.city.trim().length > 0 && form.postalCode.trim().length > 0;
  }
  return false;
});

function dismiss() {
  modalController.dismiss(null, 'cancel');
}

function expire() {
  modalController.dismiss(null, 'expire');
}

function confirm() {
  const payload: Record<string, string> = {};
  if (purposeTypeId.value) payload.contactMechPurposeTypeId = purposeTypeId.value;

  if (props.contactMechTypeId === 'EMAIL_ADDRESS') {
    payload.infoString = form.infoString.trim();
  } else if (props.contactMechTypeId === 'TELECOM_NUMBER') {
    if (form.countryCode.trim()) payload.countryCode = form.countryCode.trim();
    if (form.areaCode.trim()) payload.areaCode = form.areaCode.trim();
    payload.contactNumber = form.contactNumber.trim();
  } else if (props.contactMechTypeId === 'POSTAL_ADDRESS') {
    payload.address1 = form.address1.trim();
    if (form.address2.trim()) payload.address2 = form.address2.trim();
    payload.city = form.city.trim();
    if (form.stateProvinceGeoId.trim()) payload.stateProvinceGeoId = form.stateProvinceGeoId.trim();
    payload.postalCode = form.postalCode.trim();
    if (form.countryGeoId.trim()) payload.countryGeoId = form.countryGeoId.trim();
  }
  modalController.dismiss(payload, 'confirm');
}
</script>
