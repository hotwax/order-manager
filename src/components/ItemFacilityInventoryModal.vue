<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss()">
          <ion-icon :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Select Facility') }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-searchbar
      v-model="queryString"
      :placeholder="translate('Search facilities')"
      @ionInput="filterFacilities"
      @ionFocus="selectSearchBarText($event)"
    />

    <div class="empty-state" v-if="isLoading">
      <ion-item lines="none">
        <ion-spinner color="secondary" name="crescent" slot="start" />
        {{ translate('Fetching facilities') }}
      </ion-item>
    </div>
    <div class="empty-state" v-else-if="!filteredFacilities.length">
      <p>{{ translate('No facilities found') }}</p>
    </div>
    <ion-radio-group v-else v-model="selectedFacilityId">
      <ion-list>
        <ion-list-header>
          <ion-label>{{ translate('Facility') }}</ion-label>
          <ion-label class="ion-text-end">{{ translate('ATP') }}</ion-label>
        </ion-list-header>
        <ion-item v-for="facility in filteredFacilities" :key="facility.facilityId">
          <ion-radio label-placement="end" justify="start" :value="facility.facilityId">
            <ion-label>
              {{ facility.facilityName || facility.facilityId }}
              <p>{{ facility.facilityId }}</p>
            </ion-label>
          </ion-radio>
          <ion-note slot="end">{{ facility.lastInventoryCount ?? 0 }}</ion-note>
        </ion-item>
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
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonRadio, IonRadioGroup, IonSearchbar, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { api, logger, translate } from '@common';
import { useSeedStore } from '@/store/seed';

const props = defineProps<{ productId: string }>();

const seedStore = useSeedStore();
const isLoading = ref(false);
const allFacilities = ref<any[]>([]);
const filteredFacilities = ref<any[]>([]);
const selectedFacilityId = ref('');
const queryString = ref('');

function save() {
  if (selectedFacilityId.value) {
    modalController.dismiss(selectedFacilityId.value);
  }
}

function filterFacilities() {
  const search = queryString.value.trim().toLowerCase();
  if (!search) {
    filteredFacilities.value = allFacilities.value;
    return;
  }
  filteredFacilities.value = allFacilities.value.filter((f) =>
    (f.facilityName || '').toLowerCase().includes(search) ||
    f.facilityId.toLowerCase().includes(search)
  );
}

async function selectSearchBarText(event: any) {
  const element = await event.target.getInputElement();
  element.select();
}

async function fetchFacilitiesWithInventory() {
  isLoading.value = true;
  try {
    const resp = await api({
      url: 'oms/productFacilities',
      method: 'GET',
      params: { productId: props.productId }
    });
    const stock: any[] = Array.isArray(resp.data) ? resp.data : resp.data?.list ?? [];
    allFacilities.value = stock.map((entry) => ({
      ...entry,
      facilityName: seedStore.facilityName(entry.facilityId) || entry.facilityName || entry.facilityId
    }));
    filteredFacilities.value = allFacilities.value;
  } catch (error) {
    logger.error('Failed to fetch product facilities', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchFacilitiesWithInventory);
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}
</style>
