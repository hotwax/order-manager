<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="modalController.dismiss()" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ title || translate('Select Facility') }}</ion-title>
    </ion-toolbar>
    <!-- The strip names every item being placed. With more than one it also picks which item the
         list details, so the operator can go from "can this facility cover all three" to the full
         inventory of one item without reopening the modal. -->
    <ion-toolbar v-if="items.length">
      <div class="item-chips">
        <ion-chip
          v-for="(item, index) in items"
          :key="item.orderItemSeqId"
          :outline="!isDetailedItem(index)"
          :aria-label="chipLabel(item)"
          @click="toggleDetailedItem(index)"
        >
          <ion-avatar v-if="item.imageUrl">
            <DxpShopifyImg :src="item.imageUrl" :key="item.imageUrl" size="small" />
          </ion-avatar>
          <ion-label>{{ chipLabel(item) }}</ion-label>
        </ion-chip>
      </div>
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
    <div class="empty-state" v-else-if="hasFailed">
      <p>{{ translate('Failed to fetch facility inventory. Please try again.') }}</p>
    </div>
    <div class="empty-state" v-else-if="!visibleFacilities.length">
      <p>{{ translate('No facilities found') }}</p>
    </div>
    <ion-radio-group v-else-if="isMobileViewport" v-model="selectedFacilityId">
      <ion-list>
        <ion-accordion-group>
          <ion-accordion v-for="facility in visibleFacilities" :key="facility.facilityId" :value="facility.facilityId">
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
                <template v-if="facility.detail">
                  {{ formatQuantity(facility.detail.available) }}
                  <p>{{ translate('Available') }}</p>
                </template>
                <template v-else>
                  {{ translate('{count} of {total} items', { count: facility.coveredCount, total: facility.totalCount }) }}
                  <p v-if="!facility.inStore">{{ translate('Not in store') }}</p>
                </template>
              </ion-label>
            </div>
            <ion-list slot="content" lines="none">
              <template v-if="facility.detail">
                <ion-item>
                  <ion-label>{{ translate('ATP') }}</ion-label>
                  <ion-note slot="end">{{ formatQuantity(facility.detail.atp) }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate('QOH') }}</ion-label>
                  <ion-note slot="end">{{ formatQuantity(facility.detail.qoh) }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate('Safety stock') }}</ion-label>
                  <ion-note slot="end">{{ formatQuantity(facility.detail.safetyStock) }}</ion-note>
                </ion-item>
              </template>
              <template v-else>
                <ion-item v-for="item in facility.items" :key="item.orderItemSeqId">
                  <ion-label>{{ item.name }}</ion-label>
                  <ion-note slot="end">{{ itemAvailabilityLabel(item) }}</ion-note>
                </ion-item>
              </template>
              <ion-item>
                <ion-label>{{ translate('Allow brokering') }}</ion-label>
                <ion-note slot="end">{{ facility.allowBrokering }}</ion-note>
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
        <div
          v-for="facility in visibleFacilities"
          :key="facility.facilityId"
          class="list-item"
          :class="facility.detail ? 'facility-inventory-row' : 'facility-coverage-row'"
          @click="selectedFacilityId = facility.facilityId"
        >
          <ion-item lines="none">
            <ion-radio label-placement="end" justify="start" :value="facility.facilityId">
              <ion-label>
                {{ facility.facilityName }}
                <p>{{ facility.facilityId }}</p>
                <p v-if="!facility.inStore">{{ translate('Not in store') }}</p>
              </ion-label>
            </ion-radio>
          </ion-item>
          <template v-if="facility.detail">
            <ion-label class="tablet">
              {{ formatQuantity(facility.detail.available) }}
              <p>{{ translate('Available') }}</p>
              <p v-if="facility.detail.shortBy">{{ translate('Short by {count}', { count: facility.detail.shortBy }) }}</p>
              <p v-else-if="!facility.detail.hasRecord">{{ translate('No inventory record') }}</p>
            </ion-label>
            <ion-label class="tablet">
              {{ formatQuantity(facility.detail.atp) }}
              <p>{{ translate('ATP') }}</p>
            </ion-label>
            <ion-label class="tablet">
              {{ formatQuantity(facility.detail.qoh) }}
              <p>{{ translate('QOH') }}</p>
            </ion-label>
            <ion-label class="tablet">
              {{ formatQuantity(facility.detail.safetyStock) }}
              <p>{{ translate('Safety stock') }}</p>
            </ion-label>
          </template>
          <ion-label class="tablet" v-else>
            {{ translate('{count} of {total} items', { count: facility.coveredCount, total: facility.totalCount }) }}
            <p>{{ translate('Coverage') }}</p>
            <p v-if="shortItemNames(facility)">{{ translate('Short:') }} {{ shortItemNames(facility) }}</p>
            <p v-if="unrecordedItemNames(facility)">{{ translate('No record:') }} {{ unrecordedItemNames(facility) }}</p>
          </ion-label>
          <ion-label class="tablet">
            {{ facility.allowBrokering }}
            <p>{{ translate('Brokering') }}</p>
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
      <ion-fab-button :disabled="!selectedFacilityId" :aria-label="translate('Save')" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { IonAccordion, IonAccordionGroup, IonAvatar, IonButton, IonButtons, IonChip, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonRadio, IonRadioGroup, IonSearchbar, IonSpinner, IonTitle, IonToolbar, modalController } from '@ionic/vue';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { api, DxpShopifyImg, logger, translate } from '@common';
import { useSeedStore } from '@/store/seed';
import type { FacilityCoverageRow, FacilityItemAvailability } from '@/utils/facilityInventory';
import { buildFacilityCoverageRows, filterFacilityCoverageRows, isPhysicalFacility, sortFacilityCoverageRows } from '@/utils/facilityInventory';

export type FacilityInventoryModalItem = {
  orderItemSeqId: string;
  productId: string;
  name: string;
  imageUrl?: string;
  quantity?: number;
};

const props = defineProps<{
  items: FacilityInventoryModalItem[];
  productStoreId?: string;
  title?: string;
  excludedFacilityIds?: string[];
}>();

const MAX_SHORT_NAMES = 2;

const seedStore = useSeedStore();
const isLoading = ref(false);
const hasFailed = ref(false);
const allFacilities = ref<FacilityCoverageRow[]>([]);
const filteredFacilities = ref<FacilityCoverageRow[]>([]);
const selectedFacilityId = ref('');
const queryString = ref('');
const isMobileViewport = ref(false);
// A single item is always detailed; with more than one the strip decides.
const detailedItemIndex = ref(props.items.length === 1 ? 0 : -1);

let mobileMediaQuery: MediaQueryList | null = null;

const productIds = computed(() => Array.from(new Set(props.items.map((item) => item.productId).filter(Boolean))));

function save() {
  if (selectedFacilityId.value) {
    modalController.dismiss(selectedFacilityId.value);
  }
}

function filterFacilities() {
  filteredFacilities.value = filterFacilityCoverageRows(allFacilities.value, queryString.value);
}

function isDetailedItem(index: number) {
  return detailedItemIndex.value === index;
}

function toggleDetailedItem(index: number) {
  if (props.items.length === 1) return;
  detailedItemIndex.value = detailedItemIndex.value === index ? -1 : index;
}

/**
 * The rows as rendered: each carries the item the list is currently detailing, or null when the
 * list is summarising several items.
 */
const visibleFacilities = computed(() =>
  sortFacilityCoverageRows(filteredFacilities.value, detailedItemIndex.value).map((facility) => ({
    ...facility,
    detail: (facility.items[detailedItemIndex.value] ?? null) as FacilityItemAvailability | null
  }))
);

function chipLabel(item: FacilityInventoryModalItem) {
  const quantity = Number(item.quantity ?? 1);
  return quantity > 1 ? `${item.name} x${quantity}` : item.name;
}

function itemNameList(items: FacilityItemAvailability[]) {
  if (!items.length) return '';
  const names = items.slice(0, MAX_SHORT_NAMES).map((item) => item.name).join(', ');
  const remaining = items.length - MAX_SHORT_NAMES;
  return remaining > 0 ? `${names} ${translate('+{count} more', { count: remaining })}` : names;
}

function shortItemNames(facility: FacilityCoverageRow) {
  return itemNameList(facility.items.filter((item) => item.hasRecord && !item.covered));
}

function unrecordedItemNames(facility: FacilityCoverageRow) {
  return itemNameList(facility.items.filter((item) => !item.hasRecord));
}

function itemAvailabilityLabel(item: FacilityItemAvailability) {
  if (!item.hasRecord) return translate('No inventory record');
  if (item.shortBy) return `${formatQuantity(item.available)} (${translate('Short by {count}', { count: item.shortBy })})`;
  return formatQuantity(item.available);
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatOrderLimit(value: number | null | undefined) {
  if (value === null || value === undefined) return translate('Unlimited');
  if (value === 0) return translate('No capacity');
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

/**
 * Entity list responses cap at the page size, so one page can silently hide facilities that stock
 * an item, and understated coverage is worse than a second request.
 *
 * The real total comes back in X-Total-Count, but the OMS does not list that header in
 * Access-Control-Expose-Headers, so the browser cannot read it on these cross-origin calls. A full
 * page is therefore the only "there may be more" signal available: keep going until one comes back
 * short.
 */
async function fetchAllPages(url: string, params: Record<string, any>, pageSize = 500) {
  const rows: any[] = [];
  let pageIndex = 0;

  while (pageIndex < 20) {
    const resp: any = await api({ url, method: 'GET', params: { ...params, pageIndex, pageSize } });
    const page = responseList(resp.data);
    rows.push(...page);

    if (page.length < pageSize) break;
    pageIndex += 1;
  }

  return rows;
}

async function fetchFacilityInventory() {
  isLoading.value = true;
  hasFailed.value = false;
  try {
    await Promise.all([
      seedStore.loadFacilities(),
      props.productStoreId ? seedStore.loadProductStoreSeedData(props.productStoreId) : Promise.resolve()
    ]);

    const excludedFacilityIds = new Set(props.excludedFacilityIds || []);
    const facilities = seedDatasetRecords(seedStore.facilities)
      .filter(isPhysicalFacility)
      .filter((facility: any) => !excludedFacilityIds.has(facility.facilityId));
    const facilityIds = facilities.map((facility: any) => facility.facilityId);
    const joinedProductIds = productIds.value.join(',');

    // Inventory is the reason this modal exists, so a failure there is fatal. Quantity on hand and
    // today's consumption only decorate the row, so they degrade to a dash instead.
    const [productFacilities, inventoryResp, orderCountResp] = await Promise.all([
      fetchAllPages('oms/productFacilities', { productId: joinedProductIds, productId_op: 'in' }),
      fetchAllPages('oms/inventoryLogs', { productId: joinedProductIds, productId_op: 'in' }).catch((error) => {
        logger.error('Failed to fetch inventory logs', error);
        return [];
      }),
      // Volatile: consumption changes through the day, so it is fetched live and never cached.
      api({
        url: 'admin/facilities/orderCount',
        method: 'GET',
        params: {
          facilityId: facilityIds.join(','),
          facilityId_op: 'in',
          entryDate: todayIsoDate(),
          pageSize: Math.max(facilityIds.length, 1)
        }
      }).then((resp: any) => responseList(resp.data)).catch((error) => {
        logger.error('Failed to fetch facility order counts', error);
        return [];
      })
    ]);

    allFacilities.value = sortFacilityCoverageRows(buildFacilityCoverageRows({
      today: todayIsoDate(),
      facilities,
      items: props.items,
      productFacilities,
      inventoryItems: inventoryResp,
      facilityOrderCounts: orderCountResp,
      productStoreFacilities: props.productStoreId
        ? seedDatasetRecords(seedStore.productStoreFacilitiesByStoreId[props.productStoreId])
        : [],
      facilityName: (facilityId) => seedStore.facilityName(facilityId)
    }));
    filterFacilities();
  } catch (error) {
    hasFailed.value = true;
    logger.error('Failed to fetch facility inventory', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  setupMobileViewport();
  fetchFacilityInventory();
});

onBeforeUnmount(() => {
  teardownMobileViewport();
});
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.item-chips {
  display: flex;
  overflow-x: auto;
  padding-inline: var(--spacer-xs);
}

.item-chips ion-chip {
  flex-shrink: 0;
}

.facility-inventory-row {
  --columns-tablet: 7;
  --columns-desktop: 7;
  cursor: pointer;
  grid-template-columns: minmax(180px, 3fr) repeat(5, 1fr) max-content;
  padding-inline-end: var(--spacer-sm);
  border-bottom: var(--border-medium);
}

.facility-coverage-row {
  --columns-tablet: 4;
  --columns-desktop: 4;
  cursor: pointer;
  grid-template-columns: minmax(180px, 3fr) minmax(140px, 2fr) 1fr max-content;
  padding-inline-end: var(--spacer-sm);
  border-bottom: var(--border-medium);
}

.facility-inventory-row > ion-item,
.facility-coverage-row > ion-item,
.facility-inventory-mobile-row > ion-item {
  width: 100%;
}

.facility-inventory-row ion-radio ion-label,
.facility-coverage-row ion-radio ion-label {
  white-space: normal;
}
</style>

<style>
@media (min-width: 991px) {
  ion-modal.facility-inventory-modal {
    --width: 800px;
  }
}
</style>
