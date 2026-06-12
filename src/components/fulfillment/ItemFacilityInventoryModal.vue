<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate('Select Facility') }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar
        v-model="queryString"
        :placeholder="translate('Search facilities')"
        @ionInput="filterFacilities"
        @ionFocus="selectSearchBarText($event)"
      />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <template v-if="isLoading">
      <div class="empty-state">
        <ion-item lines="none">
          <ion-spinner color="secondary" name="crescent" slot="start" />
          {{ translate('Fetching facilities') }}
        </ion-item>
      </div>
    </template>
    <div class="empty-state" v-else-if="!filteredFacilities.length">
      <p>{{ translate('No facilities found') }}</p>
    </div>
    <ion-radio-group v-else-if="isMobileViewport" v-model="selectedFacilityId">
      <ion-list>
        <ion-accordion-group>
          <ion-accordion v-for="facility in filteredFacilities" :key="facility.facilityId" :value="facility.facilityId">
            <div slot="header" class="list-item facility-inventory-mobile-row">
              <ion-item lines="none">
                <ion-radio label-placement="end" justify="start" :value="facility.facilityId" @click.stop>
                  <ion-label>
                    {{ facility.facilityName }}
                    <p>{{ facility.facilityId }}</p>
                  </ion-label>
                </ion-radio>
              </ion-item>
              <ion-label class="ion-text-end">
                {{ formatQuantity(facility.available) }}
                <p>{{ translate('Available') }}</p>
              </ion-label>
            </div>
            <ion-list slot="content" lines="none">
              <ion-item>
                <ion-label>{{ translate('ATP') }}</ion-label>
                <ion-note slot="end">{{ formatQuantity(facility.atp) }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('QOH') }}</ion-label>
                <ion-note slot="end">{{ formatQuantity(facility.qoh) }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Safety stock') }}</ion-label>
                <ion-note slot="end">{{ formatQuantity(facility.safetyStock) }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Allow brokering') }}</ion-label>
                <ion-note slot="end">{{ facility.allowBrokering }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('OMS fulfillment') }}</ion-label>
                <ion-note slot="end">{{ facility.omsFulfillment }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Order limit') }}</ion-label>
                <ion-note slot="end">{{ formatOrderLimit(facility.orderLimit) }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Consumed order limit') }}</ion-label>
                <ion-note slot="end">{{ formatQuantity(facility.consumedToday) }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate('Remaining capacity') }}</ion-label>
                <ion-note slot="end">{{ formatOrderLimit(facility.remainingCapacity) }}</ion-note>
              </ion-item>
            </ion-list>
          </ion-accordion>
        </ion-accordion-group>
      </ion-list>
    </ion-radio-group>
    <ion-radio-group v-else v-model="selectedFacilityId">
      <ion-list>
        <ion-list-header>
          <ion-label class="tablet">{{ translate('Select fulfillment facility') }}</ion-label>
        </ion-list-header>
        <div v-for="facility in filteredFacilities" :key="facility.facilityId" class="list-item facility-inventory-row" @click="selectedFacilityId = facility.facilityId">
          <ion-item lines="none">
            <ion-radio label-placement="end" justify="start" :value="facility.facilityId">
              <ion-label>
                {{ facility.facilityName }}
                <p>{{ facility.facilityId }}</p>
              </ion-label>
            </ion-radio>
          </ion-item>
          <ion-label class="tablet">
            {{ formatQuantity(facility.available) }}
            <p>{{ translate('Available') }}</p>
          </ion-label>
          <ion-label class="tablet">
            {{ formatQuantity(facility.atp) }}
            <p>{{ translate('ATP') }}</p>
          </ion-label>
          <ion-label class="tablet">
            {{ formatQuantity(facility.qoh) }}
            <p>{{ translate('QOH') }}</p>
          </ion-label>
          <ion-label class="tablet">
            {{ formatQuantity(facility.safetyStock) }}
            <p>{{ translate('Safety stock') }}</p>
          </ion-label>
          <ion-label class="tablet">
            {{ facility.allowBrokering }}
            <p>{{ translate('Brokering') }}</p>
          </ion-label>
          <ion-label class="tablet">
            {{ facility.omsFulfillment }}
            <p>{{ translate('OMS fulfillment') }}</p>
          </ion-label>
          <ion-label class="ion-text-end">
            {{ formatQuantity(facility.consumedToday) }} / {{ formatOrderLimit(facility.orderLimit) }}
            <p>{{ translate('Consumed / Limit') }}</p>
            <p>{{ translate('Remaining') }} {{ formatOrderLimit(facility.remainingCapacity) }}</p>
          </ion-label>
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
import { IonAccordion, IonAccordionGroup, IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonRadio, IonRadioGroup, IonSearchbar, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { api, logger, translate } from '@common';
import { useSeedStore } from '@/store/seed';
import type { FacilityInventoryRow } from '@/utils/facilityInventory';
import { filterFacilityRows, normalizeFacilityRows, sortFacilityRows } from '@/utils/facilityInventory';

const props = defineProps<{ productId: string; productStoreId?: string }>();

const seedStore = useSeedStore();
const isLoading = ref(false);
const allFacilities = ref<FacilityInventoryRow[]>([]);
const filteredFacilities = ref<FacilityInventoryRow[]>([]);
const selectedFacilityId = ref('');
const queryString = ref('');
const isMobileViewport = ref(false);

let mobileMediaQuery: MediaQueryList | null = null;

function save() {
  if (selectedFacilityId.value) {
    modalController.dismiss(selectedFacilityId.value);
  }
}

function filterFacilities() {
  filteredFacilities.value = filterFacilityRows(allFacilities.value, queryString.value);
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatOrderLimit(value: number | null | undefined) {
  if (value === null || value === undefined) return translate('Unlimited');
  return formatQuantity(value);
}

async function selectSearchBarText(event: any) {
  const element = await event.target.getInputElement();
  element.select();
}

function responseList(data: any) {
  return Array.isArray(data) ? data : data?.entityValueList ?? data?.docs ?? data?.list ?? data?.items ?? [];
}

function todayIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function seedDatasetRecords(dataset: any) {
  return dataset?.ids?.map((id: string) => dataset.byId[id]) ?? [];
}

function syncMobileViewport() {
  isMobileViewport.value = Boolean(mobileMediaQuery?.matches);
}

function setupMobileViewport() {
  if (typeof window === 'undefined') return;

  mobileMediaQuery = window.matchMedia('(max-width: 699px)');
  syncMobileViewport();

  if (mobileMediaQuery.addEventListener) {
    mobileMediaQuery.addEventListener('change', syncMobileViewport);
  } else {
    mobileMediaQuery.addListener(syncMobileViewport);
  }
}

function teardownMobileViewport() {
  if (!mobileMediaQuery) return;

  if (mobileMediaQuery.removeEventListener) {
    mobileMediaQuery.removeEventListener('change', syncMobileViewport);
  } else {
    mobileMediaQuery.removeListener(syncMobileViewport);
  }
}

async function fetchFacilitiesWithInventory() {
  isLoading.value = true;
  try {
    if (props.productStoreId) {
      await seedStore.loadProductStoreSeedData(props.productStoreId);
    }

    const [productFacilitiesResp, inventoryResp, orderCountsResp] = await Promise.allSettled([
      api({
        url: 'oms/productFacilities',
        method: 'GET',
        params: { productId: props.productId, pageSize: 500 }
      }),
      api({
        url: 'oms/inventoryLogs',
        method: 'GET',
        params: { productId: props.productId, pageSize: 500 }
      }),
      api({
        url: 'oms/facilities/facilityOrderCounts',
        method: 'GET',
        params: { entryDate: todayIsoDate(), pageSize: 500 }
      })
    ]);

    if (productFacilitiesResp.status === 'rejected') throw productFacilitiesResp.reason;

    const productStoreFacilities = props.productStoreId
      ? seedDatasetRecords(seedStore.productStoreFacilitiesByStoreId[props.productStoreId])
      : [];
    const productFacilities = responseList(productFacilitiesResp.value.data);
    const inventoryItems = inventoryResp.status === 'fulfilled' ? responseList(inventoryResp.value.data) : [];
    const facilityOrderCounts = orderCountsResp.status === 'fulfilled' ? responseList(orderCountsResp.value.data) : [];

    allFacilities.value = sortFacilityRows(normalizeFacilityRows({
      today: todayIsoDate(),
      productFacilities,
      productStoreFacilities,
      facilityGroups: seedDatasetRecords(seedStore.facilityGroups),
      facilityGroupMembers: seedDatasetRecords(seedStore.facilityGroupMembers),
      inventoryItems,
      facilityOrderCounts,
      facilityName: (facilityId) => seedStore.facilityName(facilityId)
    }));
    filterFacilities();
  } catch (error) {
    logger.error('Failed to fetch product facilities', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  setupMobileViewport();
  fetchFacilitiesWithInventory();
});

onBeforeUnmount(() => {
  teardownMobileViewport();
});
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.facility-inventory-row {
  --columns-tablet: 8;
  --columns-desktop: 8;
  cursor: pointer;
}

.facility-inventory-row > ion-item,
.facility-inventory-mobile-row > ion-item {
  width: 100%;
}
</style>

<style>
@media (min-width: 991px) {
  ion-modal.item-facility-inventory-modal {
    --width: 800px;
  }
}
</style>
