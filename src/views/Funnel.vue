<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ translate("Order Funnel") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Facets: Product Store selector -->
      <!-- Loops over the product stores the user is linked to; selection binds to selectedStoreId -->
      <div class="facets ion-padding-top">
        <RadioFacetGroup v-model="selectedStoreId" :options="storeOptions" />
      </div>

      <!-- Page Heading: Name of the selected product store -->
      <ion-item lines="none" class="selected-store-header">
        <ion-icon slot="start" :icon="globeOutline" />
        <ion-label>
          <h1>{{ selectedStoreName }}</h1>
        </ion-label>
      </ion-item>

      <!-- Global Stat Card -->
      <ion-card class="global-stat">
        <ion-card-content>
          <div class="total-orders">
            <!-- Date Today -->
            <p class="overline">Today</p>
            <!-- Order Count today -->
            <h1 class="big-number">{{ (fulfillmentProgress.totalOrdersCount || 0).toLocaleString() }}</h1>
            <!-- Time since day start -->
            <p class="time-elapsed">{{ new Date().getHours() }} hours since day start</p>
          </div>

          <div class="metrics">
            <ion-item button :detail="true" lines="none" class="metric" router-link="/open">
              <div style="width: 100%;">
                <div class="metric-label">
                  <p>Brokering status</p>
                  <p>{{ fulfillmentStats.brokeringPercentage }}%</p>
                </div>
                <ion-progress-bar :value="fulfillmentStats.brokeringPercentage / 100"></ion-progress-bar>
              </div>
            </ion-item>
            <ion-item button detail lines="none" class="metric" router-link="/packed">
              <div style="width: 100%;">
                <div class="metric-label">
                  <p>Picked and packed</p>
                  <p>{{ fulfillmentStats.pickedAndPackedText }}%</p>
                </div>
                <div class="custom-progress-track">
                  <div class="custom-progress-packed" :style="{ width: fulfillmentStats.packedPercentage + '%' }"></div>
                  <div class="custom-progress-picked" :style="{ width: fulfillmentStats.pickedPercentage + '%' }"></div>
                </div>
              </div>
            </ion-item>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Drilldown Section -->
      <section class="drilldown ion-padding">
        <!-- Card 1: Open Orders — subtitle follow-up -->
        <!-- BUSINESS LOGIC COMMENT: Navigate to Open Orders list on click -->
        <!-- stat: orders where status is approved -->
        <!-- subtitle: order date from 1st result where status is approved sorted by order date ascending -->
        <StatCard
          button
          router-link="/open"
          title="Open Orders"
          :stat="openOrders.openOrdersCount || 0"
          :subtitle="oldestOpenOrderDateStr"
        />

        <!-- Card 2: Unfillable — trendline follow-up -->
        <!-- BUSINESS LOGIC COMMENT: Navigate to Unfillable Orders list on click -->
        <!-- stat: number of orders where facility id equals unfillable -->
        <StatCard button router-link="/unfillable" title="Unfillable" :stat="totalUnfillable">
          <Sparkline :points="unfillableTrend" color="danger" />
        </StatCard>

        <!-- Card 3: Order Hold Tasks — drilldown follow-up -->
        <!-- BUSINESS LOGIC COMMENT: Display list of tasks requiring resolution -->
        <!-- stat: number of orders with hold tasks -->
        <StatCard title="Order Hold Tasks" :stat="holdTasks.holdTasksTotalCount || 0">
          <ion-list lines="none" class="hold-tasks-list">
            <!-- Substitute workefforts -->
            <ion-item button :detail="true" router-link="/unfillable">
              <ion-label>
                Substitute
                <!-- number of workefforts where purpose type is substitute -->
              </ion-label>
              <p slot="end">{{ holdTasks.holdSubstituteCount || 0 }} tasks</p>
            </ion-item>

            <!-- Bad Address workefforts -->
            <ion-item button :detail="true" router-link="/bad-address">
              <ion-label>
                Bad Address
                <!-- number of workefforts where purpose type is bad address -->
              </ion-label>
              <p slot="end">{{ holdTasks.holdBadAddressCount || 0 }} tasks</p>
            </ion-item>

            <!-- Fraud Risk workefforts -->
            <ion-item button :detail="true" router-link="/fraud">
              <ion-label>
                Fraud Risk
                <!-- number of workefforts where purpose type is fraud -->
              </ion-label>
              <p slot="end">{{ holdTasks.holdFraudRiskCount || 0 }} tasks</p>
            </ion-item>
          </ion-list>
        </StatCard>
      </section>

      <!-- Divider -->
      <hr class="divider" />

      <!-- Facility Information and Metric selection -->
      <ion-item lines="none" class="facility-header">
        <ion-icon slot="start" :icon="businessOutline" />
        <ion-label>
          <h1>{{ selectedFacilityName }}</h1>
        </ion-label>
      </ion-item>

      <div class="dimension ion-padding-horizontal">
        <!-- Search facilities -->
        <ion-searchbar v-model="searchQuery" placeholder="Search facilities"></ion-searchbar>
        
        <!-- Segment selection -->
        <ion-segment v-model="selectedDimension">
          <ion-segment-button value="volume">
            <ion-label>Order Volume</ion-label>
          </ion-segment-button>
          <ion-segment-button value="velocity">
            <ion-label>Fulfillment Velocity</ion-label>
          </ion-segment-button>
          <ion-segment-button value="partial">
            <ion-label>Partial Fulfillments</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      <!-- Facilities List -->
      <ion-list class="facilities ion-padding-top">
        <ion-list-header>
          <ion-label>Top 10 facilities by selected dimension or Search results</ion-label>
        </ion-list-header>

        <ion-radio-group v-model="selectedFacilityId">
          <ion-item v-for="item in filteredFacilities" :key="item.facilityId" lines="none" class="facility-radio-item">
            <ion-radio slot="start" :value="item.facilityId" />
            <div class="facility-metric">
              <div class="facility-metric-label">
                <ion-label>{{ item.name }}</ion-label>
                <ion-note>{{ item.label }}</ion-note>
              </div>
              <ion-progress-bar :value="maxMetricValue > 0 ? (item.value / maxMetricValue) : 0" color="primary" />
            </div>
          </ion-item>
          <ion-item v-if="filteredFacilities.length === 0" lines="none">
            <ion-label>No facilities found</ion-label>
          </ion-item>
        </ion-radio-group>
      </ion-list>

      <!-- Online Order Fulfillment Dashboard at selected Facility -->
      <div class="fulfillment-dashboard-section ion-padding">
        <h1 class="section-title">Fill rate at {{ selectedFacilityName }}</h1>

        <!-- Copied exactly from Dashboard.vue -->
        <div class="fulfillment">
          <!-- Fill Rate Card -->
          <ion-card class="fill-rate">
            <ion-item lines="none">
              <p class="overline">Today's Fill Rate</p>
              <ion-icon slot="end" :icon="informationCircleOutline" />
            </ion-item>
            <ion-list lines="none">
              <h1 class="ion-margin-start">{{ Math.round((facilityFulfillmentProgress?.fillRate || 0) * 100) }}%</h1>
              <ion-item>
                <ion-label>Order allocated</ion-label>
                <ion-label slot="end">{{ facilityFulfillmentProgress?.ordersAllocated ?? 0 }}/{{ facilityFulfillmentProgress?.capacityLimit ?? 'Unlimited' }}</ion-label>
              </ion-item>
              <ion-item>
                <ion-label>Orders packed</ion-label>
                <ion-label slot="end" color="success">{{ facilityFulfillmentProgress?.ordersPacked ?? 0 }}</ion-label>
              </ion-item>
              <ion-item>
                <ion-label>Orders rejected</ion-label>
                <ion-label slot="end" color="danger">{{ facilityFulfillmentProgress?.ordersRejected ?? 0 }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <!-- Orders Pending Fulfillment Card -->
          <ion-card class="orders">
            <p class="overline title">Orders Pending Fulfillment</p>
            <div class="pending">
              <h1>{{ facilityFulfillmentProgress?.totalPending ?? 0 }}</h1>
              <ion-item lines="none">
                <ion-label>
                  <p>Oldest order assigned</p>
                  {{ oldestAssignedRelativeStr }}
                </ion-label>
              </ion-item>
            </div>
            <div class="fulfill">
              <ion-item lines="full" :button="true" :detail="true" :router-link="workflowRoute('/open')">
                <ion-icon :icon="mailUnreadOutline" slot="start" />
                <ion-label>{{ facilityFulfillmentProgress?.openCount ?? 0 }} open</ion-label>
              </ion-item>
              <ion-item lines="none" :button="true" :detail="true" :router-link="workflowRoute('/inflight')">
                <ion-icon :icon="mailOpenOutline" slot="start" />
                <ion-label>{{ facilityFulfillmentProgress?.inProgressCount ?? 0 }} in progress</ion-label>
              </ion-item>
            </div>
          </ion-card>

          <div class="fulfillment-progress-bar custom-progress-track">
            <div class="progress-segment packed" :style="{ width: progressPercent.packed + '%' }"></div>
            <div class="progress-segment rejected" :style="{ width: progressPercent.rejected + '%' }"></div>
            <div 
              class="progress-segment allocated" 
              :style="{ 
                width: progressPercent.allocated + '%',
                borderRight: progressPercent.allocated > 0 ? '1.5px solid var(--ion-color-primary, #3880ff)' : 'none'
              }"
            ></div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonProgressBar,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonRadioGroup,
  IonRadio,
  IonNote
} from '@ionic/vue';
import { ref } from 'vue';
import {
  globeOutline,
  businessOutline,
  informationCircleOutline,
  mailUnreadOutline,
  mailOpenOutline
} from 'ionicons/icons';
import { computed, watch } from 'vue';
import { translate, RadioFacetGroup, StatCard, Sparkline, commonUtil } from '@common';
import { useCustomerServiceStore } from '@/store/customerService';
import { useProductStore } from '@/store/productStore';
import { DateTime } from 'luxon';

const store = useCustomerServiceStore();
const productStore = useProductStore() as any;

const fulfillmentProgress = computed(() => store.getFulfillmentProgress);
const openOrders = computed(() => store.getOpenOrders);
const holdTasks = computed(() => store.getHoldTasks);
const facilityFulfillmentProgress = computed(() => store.getFacilityFulfillmentProgress);
const facilityOrderVolume = computed(() => store.getFacilityOrderVolume);
const facilityFulfillmentVelocity = computed(() => store.getFacilityFulfillmentVelocity);
const facilityPartialFulfillments = computed(() => store.getFacilityPartialFulfillments);
const unfillableTrend = computed(() => store.unfillableTrend);
const facilities = computed(() => store.facilities);

const selectedStoreId = ref('');
const selectedFacilityId = ref('WH_RNO');
const searchQuery = ref('');
const selectedDimension = ref('volume');

const oldestOpenOrderDateStr = computed(() => {
  const timestamp = openOrders.value.oldestOpenOrderDate;
  return timestamp ? 'Oldest: ' + commonUtil.getDateAndTime(timestamp) : 'No open orders';
});

const totalUnfillable = computed(() => unfillableTrend.value.reduce((sum, val) => sum + val, 0));

const storeOptions = computed(() => {
  return productStore.getProductStores.map((pStore: any) => ({
    value: pStore.productStoreId,
    primary: pStore.storeName
  }));
});

watch(storeOptions, (newOptions) => {
  if (newOptions.length > 0 && !selectedStoreId.value) {
    selectedStoreId.value = newOptions[0].value;
  }
}, { immediate: true });

watch(selectedStoreId, (newStoreId) => {
  if (newStoreId) {
    store.fetchFulfillmentProgress(newStoreId);
    store.fetchOpenOrders(newStoreId);
    store.fetchUnfillable(newStoreId);
    store.fetchFacilityOrderVolume(newStoreId);
    store.fetchFacilityFulfillmentVelocity(newStoreId);
    store.fetchFacilityPartialFulfillments(newStoreId);
    store.fetchHoldTasks(newStoreId);
    if (selectedFacilityId.value) {
      store.fetchFacilityFulfillmentProgress(selectedFacilityId.value, newStoreId);
    }
  }
}, { immediate: true });

watch(selectedFacilityId, (newFacilityId) => {
  if (newFacilityId && selectedStoreId.value) {
    store.fetchFacilityFulfillmentProgress(newFacilityId, selectedStoreId.value);
  }
});

const fulfillmentStats = computed(() => {
  const fp = fulfillmentProgress.value || {};
  const total = fp.totalShipGroupsCount || 0;
  const brokered = fp.brokeredShipGroupsCount || 0;
  const picked = fp.pickedShipGroupsCount || 0;
  const packedTotal = (fp.packedShipGroupsCount || 0) + (fp.shippedShipGroupsCount || 0);

  return {
    brokeringPercentage: total ? Math.round((brokered / total) * 100) : 0,
    pickedPercentage: brokered ? (picked / brokered) * 100 : 0,
    packedPercentage: brokered ? (packedTotal / brokered) * 100 : 0,
    pickedAndPackedText: brokered ? Math.round(((picked + packedTotal) / brokered) * 100) : 0,
  };
});

const selectedStoreName = computed(
  () => storeOptions.value.find((s: any) => s.value === selectedStoreId.value)?.primary ?? ''
);

function getFacilityName(facilityId: string) {
  const fac = facilities.value.find(f => f.id === facilityId);
  return fac ? fac.name : facilityId;
}

const selectedFacilityName = computed(() => {
  const selected = filteredFacilities.value.find(item => item.facilityId === selectedFacilityId.value);
  return selected ? selected.name : getFacilityName(selectedFacilityId.value);
});

const filteredFacilities = computed(() => {
  let list: any[] = [];
  if (selectedDimension.value === 'volume') {
    list = facilityOrderVolume.value.map(item => ({
      facilityId: item.facilityId,
      name: item.facilityName || getFacilityName(item.facilityId),
      value: item.lastOrderCount,
      label: `${item.lastOrderCount} orders`
    }));
  } else if (selectedDimension.value === 'velocity') {
    list = facilityFulfillmentVelocity.value.map(item => ({
      facilityId: item.facilityId,
      name: item.facilityName || getFacilityName(item.facilityId),
      value: item.fulfillmentVelocity || 0,
      label: `${Math.round((item.fulfillmentVelocity || 0) * 100)}% velocity (${item.shipGroupCount || 0}/${item.lastOrderCount || 0} orders)`
    }));
  } else if (selectedDimension.value === 'partial') {
    list = facilityPartialFulfillments.value.map(item => ({
      facilityId: item.facilityId,
      name: item.facilityName || getFacilityName(item.facilityId),
      value: item.partialFulfillmentRatio || 0,
      label: `${Math.round((item.partialFulfillmentRatio || 0) * 100)}% partial (${item.partialFulfilledOrders || 0}/${item.totalFulfilledOrders || 0} orders)`
    }));
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(item => item.name.toLowerCase().includes(query));
  }

  return list.slice(0, 10);
});

const maxMetricValue = computed(() => {
  if (filteredFacilities.value.length === 0) return 1;
  return filteredFacilities.value[0].value || 1;
});

watch(filteredFacilities, (newList) => {
  if (newList.length > 0) {
    const exists = newList.some(item => item.facilityId === selectedFacilityId.value);
    if (!exists) {
      selectedFacilityId.value = newList[0].facilityId;
    }
  }
});

const workflowRouteQuery = computed(() => ({
  productStoreId: selectedStoreId.value,
  facilityId: selectedFacilityId.value
}));

function workflowRoute(path: string) {
  return {
    path,
    query: workflowRouteQuery.value
  };
}


const oldestAssignedRelativeStr = computed(() => {
  const timestamp = facilityFulfillmentProgress.value?.oldestAssignedTime;
  return timestamp ? commonUtil.getRelativeTime(timestamp) : 'No pending orders';
});

const progressPercent = computed(() => {
  const progress = facilityFulfillmentProgress.value;
  if (!progress) return { packed: 0, rejected: 0, allocated: 0 };
  const total = progress.capacityLimit || (progress.assignedBeforeTodayCount + progress.ordersAllocated) || 1;
  const remainingAllocated = Math.max(0, progress.ordersAllocated - progress.ordersPacked - progress.ordersRejected);
  return {
    packed: (progress.ordersPacked / total) * 100,
    rejected: (progress.ordersRejected / total) * 100,
    allocated: (remainingAllocated / total) * 100
  };
});

const carrierPickupTimeStr = computed(() => {
  const time = facilityFulfillmentProgress.value?.carrierPickupTime;
  if (!time) return '04:30pm';
  return DateTime.fromFormat(time, 'HH:mm:ss').toFormat('hh:mma').toLowerCase();
});

const storeClosingTimeStr = computed(() => {
  const time = facilityFulfillmentProgress.value?.closeTime;
  if (!time) return '07:00pm';
  return DateTime.fromFormat(time, 'HH:mm:ss').toFormat('hh:mma').toLowerCase();
});

const storeCloseRemainingStr = computed(() => {
  const progress = facilityFulfillmentProgress.value;
  if (!progress || !progress.closeTime || !progress.facilityTimeZone) {
    return 'Store closes in 2 hours';
  }
  const facilityZone = progress.facilityTimeZone;
  const nowInFacility = DateTime.now().setZone(facilityZone);
  const closeTimeParts = progress.closeTime.split(':');
  const closeTimeToday = nowInFacility.set({
    hour: parseInt(closeTimeParts[0]),
    minute: parseInt(closeTimeParts[1]),
    second: parseInt(closeTimeParts[2] || '0'),
    millisecond: 0
  });
  if (nowInFacility >= closeTimeToday) {
    return 'Store is closed';
  }
  const diff = closeTimeToday.diff(nowInFacility, ['hours', 'minutes']);
  const hours = Math.floor(diff.hours);
  const minutes = Math.floor(diff.minutes);
  if (hours > 0) {
    return `Store closes in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  } else {
    return `Store closes in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
});
</script>

<style scoped>
.selected-store-header {
  margin-top: var(--spacer-xs);
  margin-bottom: var(--spacer-xs);
}

.global-stat {
  margin: var(--spacer-sm);
}

.global-stat ion-card-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--spacer-base);
  padding: var(--spacer-sm);
}

@media (min-width: 768px) {
  .global-stat ion-card-content {
    grid-template-columns: minmax(128px, 160px) minmax(0, 1fr);
    align-items: stretch;
  }
}

.total-orders {
  display: grid;
  align-content: center;
  margin: 0;
  min-width: 0;
}

.big-number {
  margin: var(--spacer-xs) 0;
}

.time-elapsed {
  margin: 0;
}

.metrics {
  display: grid;
  gap: var(--spacer-xs);
  min-width: 0;
}

.metric-label {
  display: flex;
  justify-content: space-between;
  gap: var(--spacer-sm);
  margin-bottom: var(--spacer-2xs);
}

.metric-label p {
  margin: 0;
}

.metric ion-progress-bar {
  height: var(--spacer-lg);
  border-radius: var(--spacer-xs);
  overflow: hidden;
}

/* Custom 3-tier progress bar */
.custom-progress-track {
  width: 100%;
  height: var(--spacer-lg);
  background: #d4f2da; /* Light pale green for background */
  border-radius: var(--spacer-xs);
  display: flex;
  overflow: hidden;
}

.custom-progress-packed {
  background: #1e8f42; /* Dark distinct green for packed */
  height: 100%;
}

.custom-progress-picked {
  background: var(--ion-color-success, #2dd36f); /* Vibrant base green for picked */
  height: 100%;
}

@media (max-width: 767px) {
  .global-stat ion-card-content {
    grid-template-columns: 1fr;
  }

  .metrics {
    gap: var(--spacer-sm);
  }
}

.drilldown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacer-sm);
}

.hold-tasks-list {
  padding: 0;
}

.divider {
  margin: var(--spacer-base) 0;
}

.dimension {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs);
  margin-bottom: var(--spacer-sm);
}

@media (min-width: 768px) {
  .dimension {
    flex-direction: row;
    align-items: center;
  }

  .dimension ion-searchbar {
    flex: 0 1 343px;
  }

  .dimension ion-segment {
    flex: 1 1 auto;
  }
}

.facility-radio-item {
  --padding-start: var(--spacer-sm);
  --inner-padding-end: var(--spacer-sm);
}

.facility-metric {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacer-sm);
}

.facility-metric-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacer-sm);
  flex: 0 1 306px;
}

.facility-metric ion-progress-bar {
  flex: 1 1 auto;
  height: var(--spacer-lg);
  border-radius: var(--spacer-xs);
}

@media (max-width: 767px) {
  .facility-metric {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacer-xs);
  }

  .facility-metric-label {
    flex: initial;
  }
}

.fulfillment-dashboard-section {
  margin-top: var(--spacer-base);
}

.section-title {
  margin-bottom: var(--spacer-sm);
}

.fulfillment {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-base);
  padding: var(--spacer-base);
}

@media (min-width: 991px) {
  .fulfillment {
    display: grid;
    grid-template-areas: "fill-rate orders"
                        "fill-rate progress-bar"
                        "fill-rate scheduling";
    grid-template-columns: 350px 1fr;
    grid-template-rows: auto auto auto;
    align-items: start;
  }
}

.fulfillment > * {
  margin: 0;
}

.fill-rate {
  grid-area: fill-rate;
}

.orders {
  grid-area: orders;
  display: flex;
  flex-direction: column;
}

@media (min-width: 991px) {
  .orders {
    display: grid;
    grid-template-areas: "title title"
                         "pending fulfill";
    grid-template-columns: 1fr 1fr;
    grid-template-rows: min-content auto;
    align-items: end;
  }
}

.title {
  grid-area: title;
  margin-inline: var(--spacer-sm);
}

.pending {
  grid-area: pending;
  display: flex;
  align-items: center;
}

.pending ion-item {
  flex: 1;
}

.fulfill {
  grid-area: fulfill;
}

.fulfillment-progress-bar {
  grid-area: progress-bar;
  min-width: 0;
  height: var(--spacer-lg);
  border-radius: var(--spacer-xs);
}

.custom-progress-track {
  display: flex;
  background-color: var(--ion-color-step-50, #ffffff);
  border: 1px solid var(--ion-color-step-300, #b3b3b3);
  overflow: hidden;
}

.progress-segment {
  height: 100%;
}

.progress-segment.packed {
  background-color: var(--ion-color-success, #2dd36f);
}

.progress-segment.rejected {
  background-color: var(--ion-color-danger, #eb445a);
}

.progress-segment.allocated {
  background-color: #d2e0fb;
}

.scheduling {
  display: flex;
  gap: var(--spacer-base);
}

.scheduling ion-item {
  flex: 1;
  border: var(--border-medium);
  border-radius: var(--spacer-xs);
}

.scheduling ion-item::part(native) {
  --border-radius: var(--spacer-xs);
}

</style>
