<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Select Facility') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-searchbar
      @ionFocus="selectSearchBarText($event)"
      :placeholder="translate('Search facilities')"
      v-model="queryString"
      @keyup.enter="queryString = $event.target.value; findFacility()"
      @keydown="preventSpecialCharacters($event)"
    />
    <ion-radio-group v-model="selectedFacilityId">
      <ion-list>
        <div class="empty-state" v-if="isLoading">
          <ion-item lines="none">
            <ion-spinner color="secondary" name="crescent" slot="start" />
            {{ translate('Fetching facilities') }}
          </ion-item>
        </div>
        <div class="empty-state" v-else-if="!filteredFacilities.length">
          <p>{{ translate('No facilities found') }}</p>
        </div>
        <div v-else>
          <ion-item v-for="facility in filteredFacilities" :key="facility.facilityId">
            <ion-radio label-placement="end" justify="start" :value="facility.facilityId">
              <ion-label>
                {{ facility.facilityName }}
                <p>{{ facility.facilityId }}</p>
              </ion-label>
            </ion-radio>
          </ion-item>
        </div>
      </ion-list>
    </ion-radio-group>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!selectedFacilityId" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSearchbar, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { api, logger, translate } from '@common';

type Facility = {
  facilityId: string;
  facilityName: string;
  description?: string;
};

const facilities = ref<Facility[]>([]);
const filteredFacilities = ref<Facility[]>([]);
const isLoading = ref(false);
const selectedFacilityId = ref('');
const queryString = ref('');

function closeModal(facilityId?: string) {
  modalController.dismiss(facilityId);
}

function save() {
  if (selectedFacilityId.value) {
    closeModal(selectedFacilityId.value);
  }
}

function findFacility() {
  const search = queryString.value.trim().toLowerCase();
  if (search) {
    filteredFacilities.value = facilities.value.filter((facility) =>
      facility.facilityName?.toLowerCase().includes(search) ||
      facility.facilityId?.toLowerCase().includes(search)
    );
  } else {
    filteredFacilities.value = facilities.value;
  }
}

async function selectSearchBarText(event: any) {
  const element = await event.target.getInputElement();
  element.select();
}

function preventSpecialCharacters(event: any) {
  if (/[`!@#$%^&*()_+\-=\\|,.<>?~]/.test(event.key)) event.preventDefault();
}

async function fetchPhysicalFacilities() {
  isLoading.value = true;
  try {
    const resp = await api({
      url: "oms/facilities",
      method: "GET",
      params: {
        pageSize: 500,
        facilityTypeId: "VIRTUAL_FACILITY",
        facilityTypeId_not: "Y",
        parentTypeId: "VIRTUAL_FACILITY",
        parentTypeId_not: "Y",
      }
    });
    facilities.value = resp.data || [];
    filteredFacilities.value = facilities.value;
  } catch (error) {
    logger.error('Failed to fetch physical facilities', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchPhysicalFacilities();
});
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
