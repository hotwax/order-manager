<template>
  <OrderQueueList
    title="Brokering queue"
    search-placeholder="Order, external ID, customer, email"
    empty-title="No orders awaiting brokering"
    empty-message="Approved orders awaiting brokering and items rejected by a facility will appear here."
    :facility-ids="facilityIds"
    @clearFilters="clearFacilityFilter"
  >
    <template #filters>
      <ion-select
        v-model="selectedFacilityIds"
        :label="translate('Facility')"
        label-placement="stacked"
        interface="popover"
        :interface-options="{ showBackdrop: false }"
        multiple
        :placeholder="translate('All virtual facilities')"
        @ionChange="normalizeFacilitySelection"
      >
        <ion-select-option v-for="facility in virtualFacilities" :key="facility.id" :value="facility.id">
          {{ facility.name }}
        </ion-select-option>
      </ion-select>
    </template>
  </OrderQueueList>
</template>

<script setup lang="ts">
import { IonSelect, IonSelectOption } from '@ionic/vue';
import { api, translate } from '@common';
import { computed, onMounted, ref, watch } from 'vue';
import OrderQueueList from '@/components/OrderQueueList.vue';

const ALL_FACILITY_OPTION_ID = 'All';
const FALLBACK_BROKERING_FACILITY_IDS = ['_NA_', 'REJECTED_ITM_PARKING', 'REJECTED_PARKING'];

type FacilityOption = { id: string; name: string };

const selectedFacilityIds = ref<string[]>([ALL_FACILITY_OPTION_ID]);
const lastSelectedFacilityIds = ref<string[]>([ALL_FACILITY_OPTION_ID]);
const virtualFacilities = ref<FacilityOption[]>([]);
const facilityIds = computed(() => {
  if (selectedFacilityIds.value.includes(ALL_FACILITY_OPTION_ID) || !selectedFacilityIds.value.length) {
    return virtualFacilityIds.value.length ? virtualFacilityIds.value : FALLBACK_BROKERING_FACILITY_IDS;
  }

  return selectedFacilityIds.value;
});
const virtualFacilityIds = computed(() => virtualFacilities.value
  .map((facility) => facility.id)
  .filter((id) => id && id !== ALL_FACILITY_OPTION_ID));

function normalizeFacilityName(facility: any) {
  return facility?.facilityName || facility?.facilityId || facility?.name || facility?.id;
}

function buildFacilityList(facilities: any[]) {
  const map = new Map<string, string>();
  facilities.forEach((facility) => {
    const id = facility?.facilityId || facility?.id;
    if (!id) return;

    map.set(id, normalizeFacilityName(facility));
  });

  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function dedupeAndSort(values: string[]) {
  return [...new Set(values.filter((value) => value && value !== ALL_FACILITY_OPTION_ID))].sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}
function clearFacilityFilter() {
  selectedFacilityIds.value = [ALL_FACILITY_OPTION_ID];
}
function normalizeFacilitySelection(event?: any) {
  const emittedValues = Array.isArray(event)
    ? event
    : Array.isArray(event?.detail?.value)
      ? event.detail.value
      : undefined;
  const selectedValues = emittedValues ?? (Array.isArray(selectedFacilityIds.value) ? selectedFacilityIds.value : []);
  const selectedSpecificFacilities = dedupeAndSort(selectedValues);
  const allWasSelected = lastSelectedFacilityIds.value.includes(ALL_FACILITY_OPTION_ID);
  const allIsSelected = selectedValues.includes(ALL_FACILITY_OPTION_ID);
  const normalized = allIsSelected && !allWasSelected
    ? [ALL_FACILITY_OPTION_ID]
    : selectedSpecificFacilities.length
      ? selectedSpecificFacilities
      : [ALL_FACILITY_OPTION_ID];

  if (normalized.join('|') !== selectedFacilityIds.value.join('|')) {
    selectedFacilityIds.value = normalized;
  }
  lastSelectedFacilityIds.value = normalized;
}

async function loadVirtualFacilities() {
  try {
    const resp = await api({ url: 'admin/facilities', method: 'GET', params: { parentTypeId: 'VIRTUAL_FACILITY' } });
    const facilities = Array.isArray(resp.data) ? resp.data : [];
    const options = buildFacilityList(facilities);
    virtualFacilities.value = [{ id: ALL_FACILITY_OPTION_ID, name: translate('All') }, ...options];
  } catch {
    virtualFacilities.value = [{ id: ALL_FACILITY_OPTION_ID, name: translate('All') }];
  }
}

watch(selectedFacilityIds, normalizeFacilitySelection, { deep: true, immediate: true });

onMounted(loadVirtualFacilities);
</script>
