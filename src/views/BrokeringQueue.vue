<template>
  <OrderQueueList
    title="Brokering queue"
    search-placeholder="Order, external ID, customer, email"
    empty-title="No orders awaiting brokering"
    empty-message="Approved orders awaiting brokering and items rejected by a facility will appear here."
    :facility-ids="facilityIds"
    :status="['ORDER_CREATED', 'ORDER_APPROVED']"
    count-key="brokering"
    @clearFilters="clearFacilityFilter"
  >
    <template #filters>
      <ion-select
        v-model="selectedFacilityIds"
        :label="translate('Facility')"
        label-placement="stacked"
        fill="outline"
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
import { translate } from '@common';
import { computed, onMounted, ref, watch } from 'vue';
import router from '@/router';
import OrderQueueList from '@/components/OrderQueueList.vue';
import {
  ALL_FACILITY_OPTION_ID,
  FALLBACK_BROKERING_FACILITY_IDS,
  buildBrokeringFacilityOptions,
  fetchBrokeringFacilities,
  isUnfillableFacilityId,
} from '@/utils/brokeringFacilities';

type FacilityOption = { id: string; name: string };

const selectedFacilityIds = ref<string[]>([ALL_FACILITY_OPTION_ID]);
const lastSelectedFacilityIds = ref<string[]>([ALL_FACILITY_OPTION_ID]);
const virtualFacilities = ref<FacilityOption[]>([]);
const route = router.currentRoute.value;
const facilityIds = computed(() => {
  if (selectedFacilityIds.value.includes(ALL_FACILITY_OPTION_ID) || !selectedFacilityIds.value.length) {
    return virtualFacilityIds.value.length ? virtualFacilityIds.value : FALLBACK_BROKERING_FACILITY_IDS;
  }

  return selectedFacilityIds.value;
});
const virtualFacilityIds = computed(() => virtualFacilities.value
  .map((facility) => facility.id)
  .filter((id) => id && id !== ALL_FACILITY_OPTION_ID && !isUnfillableFacilityId(id)));

function dedupeAndSort(values: string[]) {
  return [...new Set(values.filter((value) => value && value !== ALL_FACILITY_OPTION_ID && !isUnfillableFacilityId(value)))].sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}

function clearFacilityFilter() {
  selectedFacilityIds.value = [ALL_FACILITY_OPTION_ID];
}

function routeFacilityIds(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return dedupeAndSort(values.filter((facilityId): facilityId is string => typeof facilityId === 'string'));
}

function applyRouteFacilityFilter() {
  const facilities = routeFacilityIds(route.query.facilityId);
  if (!facilities.length) return;

  selectedFacilityIds.value = facilities;
  lastSelectedFacilityIds.value = facilities;
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
  const options = buildBrokeringFacilityOptions(await fetchBrokeringFacilities());
  virtualFacilities.value = [{ id: ALL_FACILITY_OPTION_ID, name: translate('All') }, ...options];
}

watch(selectedFacilityIds, normalizeFacilitySelection, { deep: true, immediate: true });
watch(() => route.query.facilityId, applyRouteFacilityFilter, { immediate: true });

onMounted(loadVirtualFacilities);
</script>
