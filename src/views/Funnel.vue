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
      <div class="facets ion-padding">
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
            <h1 class="big-number">1,248</h1>
            <!-- Time since day start -->
            <p class="time-elapsed">12 hours since day start</p>
          </div>

          <div class="metrics">
            <ion-item button detail="true" lines="none" class="metric" router-link="/open">
              <!-- Brokering Status -->
              <div class="metric-label">
                <p>Brokering status</p>
                <p>85%</p>
              </div>
              <ion-progress-bar :value="0.85"></ion-progress-bar>
            </ion-item>
            <ion-item button detail="true" lines="none" class="metric" router-link="/packed">
              <!-- Picked and Packed -->
              <div class="metric-label">
                <p>Picked and packed</p>
                <p>62%</p>
              </div>
              <ion-progress-bar :value="0.62" color="success"></ion-progress-bar>
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
          :stat="345"
          subtitle="Oldest: May 30, 2026 10:15 AM"
        />

        <!-- Card 2: Unfillable — trendline follow-up -->
        <!-- BUSINESS LOGIC COMMENT: Navigate to Unfillable Orders list on click -->
        <!-- stat: number of orders where facility id equals unfillable -->
        <StatCard button router-link="/unfillable" title="Unfillable" :stat="42">
          <Sparkline :points="unfillableTrend" color="danger" />
        </StatCard>

        <!-- Card 3: Order Hold Tasks — drilldown follow-up -->
        <!-- BUSINESS LOGIC COMMENT: Display list of tasks requiring resolution -->
        <!-- stat: number of orders with hold tasks -->
        <StatCard title="Order Hold Tasks" :stat="32">
          <ion-list lines="none" class="hold-tasks-list">
            <!-- Substitute workefforts -->
            <ion-item button detail="true" router-link="/unfillable">
              <ion-label>
                Substitute
                <!-- number of workefforts where purpose type is substitute -->
              </ion-label>
              <p slot="end">12 tasks</p>
            </ion-item>

            <!-- Bad Address workefforts -->
            <ion-item button detail="true" router-link="/bad-address">
              <ion-label>
                Bad Address
                <!-- number of workefforts where purpose type is bad address -->
              </ion-label>
              <p slot="end">15 tasks</p>
            </ion-item>

            <!-- Fraud Risk workefforts -->
            <ion-item button detail="true" router-link="/fraud">
              <ion-label>
                Fraud Risk
                <!-- number of workefforts where purpose type is fraud -->
              </ion-label>
              <p slot="end">5 tasks</p>
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
          <h1>Facility Name</h1>
        </ion-label>
      </ion-item>

      <div class="dimension ion-padding-horizontal">
        <!-- Search facilities -->
        <!-- BUSINESS LOGIC COMMENT: Bind value to searchQuery ref to filter facility list -->
        <ion-searchbar placeholder="Search facilities"></ion-searchbar>
        
        <!-- Segment selection -->
        <!-- BUSINESS LOGIC COMMENT: Bind segment value to dimension ref (e.g. order volume, velocity, partials) -->
        <ion-segment value="volume">
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
      <!-- BUSINESS LOGIC COMMENT: Display top 10 facilities by selected dimension or filtered search results -->
      <ion-list class="facilities ion-padding-top">
        <ion-list-header>
          <ion-label>Top 10 facilities by selected dimension or Search results</ion-label>
        </ion-list-header>

        <!-- BUSINESS LOGIC COMMENT: Bind selected facility ID to ref via ion-radio-group -->
        <ion-radio-group v-model="selectedFacilityId">
          <!-- Facility 1 (highest ranking, 100% progress) -->
          <!-- BUSINESS LOGIC COMMENT: progress bar value is computed as: metric count / max count in result set -->
          <ion-item lines="none" class="facility-radio-item">
            <ion-radio slot="start" value="WH_RNO" />
            <div class="facility-metric">
              <div class="facility-metric-label">
                <ion-label>Reno DC</ion-label>
                <ion-note>450 orders</ion-note>
              </div>
              <ion-progress-bar :value="1.0" color="primary" />
            </div>
          </ion-item>

          <!-- Facility 2 (e.g., 300 orders -> 66% progress) -->
          <ion-item lines="none" class="facility-radio-item">
            <ion-radio slot="start" value="WH_ATL" />
            <div class="facility-metric">
              <div class="facility-metric-label">
                <ion-label>Atlanta DC</ion-label>
                <ion-note>300 orders</ion-note>
              </div>
              <ion-progress-bar :value="300 / 450" color="primary" />
            </div>
          </ion-item>

          <!-- Facility 3 (e.g., 150 orders -> 33% progress) -->
          <ion-item lines="none" class="facility-radio-item">
            <ion-radio slot="start" value="WH_LDN" />
            <div class="facility-metric">
              <div class="facility-metric-label">
                <ion-label>London DC</ion-label>
                <ion-note>150 orders</ion-note>
              </div>
              <ion-progress-bar :value="150 / 450" color="primary" />
            </div>
          </ion-item>
        </ion-radio-group>
      </ion-list>

      <!-- Online Order Fulfillment Dashboard at selected Facility -->
      <div class="fulfillment-dashboard-section ion-padding">
        <h1 class="section-title">Fill rate at Facility Name</h1>

        <!-- Copied exactly from Dashboard.vue -->
        <div class="fulfillment">
          <!-- Fill Rate Card -->
          <ion-card class="fill-rate">
            <ion-item lines="none">
              <p class="overline">Today's Fill Rate</p>
              <ion-icon slot="end" :icon="informationCircleOutline" />
            </ion-item>
            <ion-list lines="none">
              <h1>94%</h1>
              <ion-item>
                <ion-label>Order allocated</ion-label>
                <ion-label slot="end">150/Unlimited</ion-label>
              </ion-item>
              <ion-item>
                <ion-label>Orders packed</ion-label>
                <ion-label slot="end" color="success">141</ion-label>
              </ion-item>
              <ion-item>
                <ion-label>Orders rejected</ion-label>
                <ion-label slot="end" color="danger">9</ion-label>
              </ion-item>
            </ion-list>
          </ion-card>

          <!-- Orders Pending Fulfillment Card -->
          <ion-card class="orders">
            <p class="overline title">Orders Pending Fulfillment</p>
            <div class="pending">
              <h1>24</h1>
              <ion-item lines="none">
                <ion-label>
                  <p>Oldest order assigned</p>
                  3 hours ago
                </ion-label>
              </ion-item>
            </div>
            <div class="fulfill">
              <ion-item lines="full" :button="true" :detail="true" :router-link="workflowRoute('/open')">
                <ion-icon :icon="mailUnreadOutline" slot="start" />
                <ion-label>14 open</ion-label>
              </ion-item>
              <ion-item lines="none" :button="true" :detail="true" :router-link="workflowRoute('/inflight')">
                <ion-icon :icon="mailOpenOutline" slot="start" />
                <ion-label>10 in progress</ion-label>
              </ion-item>
            </div>
          </ion-card>

          <ion-progress-bar class="fulfillment-progress-bar" :value="0.7" color="success" />

          <!-- Scheduling -->
          <div class="scheduling">
            <ion-item lines="none">
              <ion-icon slot="start" :icon="sendOutline" color="warning" />
              <ion-label>
                Carrier pickup scheduled
                <p>04:30pm</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-icon slot="start" :icon="storefrontOutline" color="danger" />
              <ion-label>
                Store closes in 2 hours
                <p>07:00pm</p>
              </ion-label>
            </ion-item>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
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
  airplaneOutline,
  alertCircleOutline,
  cubeOutline,
  playCircleOutline,
  shieldHalfOutline,
  globeOutline,
  businessOutline,
  informationCircleOutline,
  mailUnreadOutline,
  mailOpenOutline,
  sendOutline,
  storefrontOutline
} from 'ionicons/icons';
import { computed } from 'vue';
import { translate, RadioFacetGroup, StatCard, Sparkline } from '@common';
import { useCustomerServiceStore } from '@/store/customerService';

// Recent unfillable-order trend (mock). Higher values plot higher.
const unfillableTrend = [12, 18, 9, 24, 16, 30, 14, 22, 11, 26, 23];

const store = useCustomerServiceStore();
const counts = computed(() => store.bucketCounts);

const storeOptions = store.productStores.map((productStore) => ({
  value: productStore.id,
  primary: productStore.name
}));
const selectedStoreId = ref(storeOptions[0]?.value ?? '');
const selectedStoreName = computed(
  () => storeOptions.find((s) => s.value === selectedStoreId.value)?.primary ?? ''
);
const selectedFacilityId = ref('WH_RNO');

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

const totalBlocked = computed(() => {
  return counts.value['unfillable'] + counts.value['fraud'];
});

const totalInProgress = computed(() => {
  return counts.value['open'] + counts.value['inflight'] + counts.value['packed'];
});

const totalOrders = computed(() => totalBlocked.value + totalInProgress.value);
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
