<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>{{ translate("Shipping address") }}</ion-title>
      <ion-buttons slot="end" @click="close()">
        <ion-button>
          <ion-icon :icon="closeOutline" />
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
        <ion-select :label="translate('Province')" interface="popover" v-model="address.province">
          <ion-select-option v-for="state in states" :key="state.geoId" :value="state.geoId" >{{ state.geoName }}</ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Zipcode')" class="ion-text-right" name="zip" v-model="address.zip" id="zip"/>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Country')" class="ion-text-right" name="country" v-model="address.country" id="country"/>
      </ion-item>
      <ion-item>
        <ion-input :label="translate('Phone')" class="ion-text-right" name="phone" v-model="address.phone" id="phone"/>
      </ion-item>
    </ion-list>
    <div class="ion-text-center">
      <ion-button @click="save()">{{ translate("Save shipping address") }}</ion-button>
    </div>
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
  modalController,
  loadingController
} from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { closeOutline } from 'ionicons/icons';
import { translate } from "@common";

const address = ref({
  address1: "",
  address2: "",
  city: "",
  province: "",
  zip: "",
  country: "",
  phone: ""
})
const contactMechId = ref("")
const states = ref([])
const loader = ref(null) as any

const props = defineProps(["customerAddress"])

onMounted(async () => {
  // presentLoader()
  // await getAssociatedStates()
  prepareAddress();
  // dismissLoader()
})

async function presentLoader() {
  loader.value = await loadingController
    .create({
      message: translate("Fetching address")
    });
  await loader.value.present();
}

function dismissLoader() {
  if(loader.value) {
    loader.value.dismiss();
    loader.value = null;
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

// async function getAssociatedStates() {
//   try {
//     const payload = {
//       "viewSize": 250
//     }
//     const resp = await UtilityService.getAssociatedStates(payload);
//     if (!hasError(resp)) {
//       states.value = resp.data.states;
//       address.value.countryGeoId = resp.data.countryGeoId;
//     }
//   } catch (error) {
//     console.error(error)
//   }
// }
</script>