<template>
  <ModalHeader :title="translate('Park order')" />

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
            <ion-radio :value="facility.facilityId">
              <ion-label>
                {{ facility.facilityName }}
                <p>{{ facility.facilityId }}</p>
              </ion-label>
            </ion-radio>
          </ion-item>
        </div>
      </ion-list>
    </ion-radio-group>

    <ModalConfirmFab />
  </ion-content>
</template>

<script setup lang="ts">
import { IonContent, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonSearchbar, IonSpinner } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { api, logger, translate } from '@common';
import ModalConfirmFab from '@/components/common/ModalConfirmFab.vue';
import ModalHeader from '@/components/common/ModalHeader.vue';
import { useModalFlow } from '@/composables/useModalFlow';

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

// Each screen that opens this parks in its own way, so the confirm path only hands back the pick.
useModalFlow({
  canConfirm: () => !!selectedFacilityId.value,
  confirm: () => selectedFacilityId.value,
});

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

async function fetchVirtualFacilities() {
  isLoading.value = true;
  try {
    const resp = await api({
      url: 'admin/facilities',
      method: 'GET',
      params: { parentTypeId: 'VIRTUAL_FACILITY' }
    });
    facilities.value = resp.data || [];
    filteredFacilities.value = facilities.value;
  } catch (error) {
    logger.error('Failed to fetch virtual facilities', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchVirtualFacilities();
});
</script>

