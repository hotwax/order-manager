<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>{{ translate("Shipping address") }}</ion-title>
      <ion-buttons slot="end" @click="close()">
        <ion-button :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input :label="translate('Address 1')" class="ion-text-right" name="address1" v-model="address.address1" id="address1" type="text"/>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Address 2')" class="ion-text-right" name="address2" v-model="address.address2" id="address2" type="text"/>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('City')" class="ion-text-right" name="city" v-model="address.city" id="city" type="text"/>
      </ion-item>
      <ion-item>
        <ion-select :label="translate('Country')" interface="popover" name="country" v-model="address.country" id="country" @ionChange="onCountryChange">
          <ion-select-option v-for="country in countries" :key="country.geoId" :value="country.geoId" >{{ country.geoName }}</ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-select :label="translate('Province')" interface="popover" name="province" v-model="address.province">
          <ion-select-option v-for="state in states" :key="state.geoId" :value="state.geoId" >{{ state.geoName }}</ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Zipcode')" class="ion-text-right" name="zip" v-model="address.zip" id="zip"/>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Phone')" class="ion-text-right" name="phone" v-model="address.phone" id="phone"/>
      </ion-item>
    </ion-list>
    <ion-fab horizontal="end" vertical="bottom">
      <ion-fab-button @click="save()" :aria-label="translate('Save')">
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
  IonHeader, 
  IonIcon, 
  IonItem, 
  IonInput,
  IonList, 
  IonSelect,
  IonSelectOption,
  IonTitle, 
  IonToolbar, 
  modalController
} from '@ionic/vue';
import { computed, onMounted, ref } from 'vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { translate } from "@common";
import { useSeedStore } from '@/store/seed';

const address = ref({
  address1: "",
  address2: "",
  city: "",
  province: "",
  zip: "",
  country: "",
  phone: ""
})

const props = defineProps(["customerAddress"])
const countries = computed(() => useSeedStore().getCountries)
const states = computed(() => useSeedStore().getStatesForCountry(address.value.country))

onMounted(() => {
  prepareAddress();
})

function onCountryChange() {
  address.value.province = "";
  if(address.value.country) {
    useSeedStore().loadGeoAssocs(address.value.country);
  }
}

function prepareAddress() {
  if(props?.customerAddress) {
    address.value = props.customerAddress
  }
}

function close() {
  modalController.dismiss();
}

function save() {
  modalController.dismiss({ address: address.value })
}
</script>