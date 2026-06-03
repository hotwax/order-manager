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
      <div class="facets ion-padding">
        <!-- 
          BUSINESS LOGIC COMMENT:
          Bind the selected product store ID to a reactive variable.
          Example: v-model="selectedStoreId"
        -->
        <ion-radio-group value="store-1">
          <ion-list lines="none">
            <!-- 
              BUSINESS LOGIC COMMENT:
              Loop over the product stores that the user is linked to.
              Example: v-for="store in productStores" :key="store.productStoreId"
            -->
            <ion-item class="facet-item">
              <ion-radio value="store-1" label-placement="end">Store Name 1</ion-radio>
            </ion-item>
            <ion-item class="facet-item">
              <ion-radio value="store-2" label-placement="end">Store Name 2</ion-radio>
            </ion-item>
          </ion-list>
        </ion-radio-group>
      </div>

      <!-- Page Heading: Shows based on selected product store -->
      <!-- 
        BUSINESS LOGIC COMMENT:
        Display name of the selected product store dynamically based on active selection.
      -->
      <ion-item lines="none" class="selected-store-header">
        <ion-icon slot="start" :icon="globeOutline" />
        <ion-label>
          <h1>Store Name 1</h1>
        </ion-label>
      </ion-item>

      <!-- Global Stat Card -->
      <ion-card class="global-stat">
        <ion-card-content>
          <div class="total-orders ion-text-center">
            <!-- Date Today -->
            <p class="overline">Today</p>
            <!-- Order Count today -->
            <h1 class="big-number">1,248</h1>
            <!-- Time since day start -->
            <p class="time-elapsed">12 hours since day start</p>
          </div>

          <div class="metrics">
            <div class="metric">
              <!-- Brokering Status -->
              <div class="metric-label">
                <p>Brokering status</p>
                <p>85%</p>
              </div>
              <ion-progress-bar :value="0.85"></ion-progress-bar>
            </div>
            <div class="metric">
              <!-- Picked and Packed -->
              <div class="metric-label">
                <p>Picked and packed</p>
                <p>62%</p>
              </div>
              <ion-progress-bar :value="0.62" color="success"></ion-progress-bar>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Drilldown Section -->
      <section class="drilldown ion-padding">
        <!-- Card 1: Open Orders -->
        <!-- BUSINESS LOGIC COMMENT: Navigate to Open Orders list on click -->
        <ion-card button class="drilldown-card">
          <ion-card-content>
            <p class="overline">Open Orders</p>
            <!-- orders where status is approved -->
            <h1 class="big-number">345</h1>
            <!-- order date from 1st result where status is approved sorted by order date ascending -->
            <p class="card-detail">Oldest: May 30, 2026 10:15 AM</p>
          </ion-card-content>
        </ion-card>

        <!-- Card 2: Unfillable -->
        <!-- BUSINESS LOGIC COMMENT: Navigate to Unfillable Orders list on click -->
        <ion-card button class="drilldown-card">
          <ion-card-content>
            <p class="overline">Unfillable</p>
            <!-- number of orders where facility id equals unfillable -->
            <h1 class="big-number">42</h1>
            <!-- animated spark line graph -->
            <div class="sparkline-container">
              <svg class="sparkline" viewBox="0 0 100 30" width="100%" height="30" stroke="var(--ion-color-danger)" stroke-width="2" fill="none">
                <polyline points="0,25 10,22 20,28 30,15 40,20 50,5 60,18 70,12 80,22 90,8 100,10" />
              </svg>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Card 3: Order Hold Tasks -->
        <!-- BUSINESS LOGIC COMMENT: Display list of tasks requiring resolution -->
        <ion-card class="drilldown-card">
          <ion-card-content>
            <p class="overline">Order Hold Tasks</p>
            <!-- number of orders with hold tasks -->
            <h1 class="big-number">32</h1>
            
            <ion-list lines="none" class="hold-tasks-list">
              <!-- Substitute workefforts -->
              <ion-item button detail="true">
                <ion-label>
                  <h2>Substitute</h2>
                  <!-- number of workefforts where purpose type is substitute -->
                  <p>12 tasks</p>
                </ion-label>
              </ion-item>
              
              <!-- Bad Address workefforts -->
              <ion-item button detail="true">
                <ion-label>
                  <h2>Bad Address</h2>
                  <!-- number of workefforts where purpose type is bad address -->
                  <p>15 tasks</p>
                </ion-label>
              </ion-item>
              
              <!-- Fraud Risk workefforts -->
              <ion-item button detail="true">
                <ion-label>
                  <h2>Fraud Risk</h2>
                  <!-- number of workefforts where purpose type is fraud -->
                  <p>5 tasks</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
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
        <ion-radio-group value="facility-1">
          <!-- Facility 1 (highest ranking, 100% progress) -->
          <!-- BUSINESS LOGIC COMMENT: progress bar value is computed as: metric count / max count in result set -->
          <ion-item lines="none" class="facility-radio-item">
            <ion-radio value="facility-1" justify="space-between" label-placement="start">
              <div class="facility-radio-content">
                <div class="facility-radio-header">
                  <h2>Main Warehouse</h2>
                  <ion-note>450 orders</ion-note>
                </div>
                <ion-progress-bar :value="1.0" color="primary"></ion-progress-bar>
              </div>
            </ion-radio>
          </ion-item>

          <!-- Facility 2 (e.g., 300 orders -> 66% progress) -->
          <ion-item lines="none" class="facility-radio-item">
            <ion-radio value="facility-2" justify="space-between" label-placement="start">
              <div class="facility-radio-content">
                <div class="facility-radio-header">
                  <h2>Dallas Fulfillment</h2>
                  <ion-note>300 orders</ion-note>
                </div>
                <ion-progress-bar :value="300 / 450" color="primary"></ion-progress-bar>
              </div>
            </ion-radio>
          </ion-item>

          <!-- Facility 3 (e.g., 150 orders -> 33% progress) -->
          <ion-item lines="none" class="facility-radio-item">
            <ion-radio value="facility-3" justify="space-between" label-placement="start">
              <div class="facility-radio-content">
                <div class="facility-radio-header">
                  <h2>Seattle Store</h2>
                  <ion-note>150 orders</ion-note>
                </div>
                <ion-progress-bar :value="150 / 450" color="primary"></ion-progress-bar>
              </div>
            </ion-radio>
          </ion-item>
        </ion-radio-group>
      </ion-list>

      <!-- Fill Rate and Fulfillment Dashboard at selected Facility -->
      <div class="fulfillment-dashboard-section ion-padding">
        <h1 class="section-title">Fill rate at Facility Name</h1>

        <!-- 
          BUSINESS LOGIC COMMENT:
          Copy fulfillment dashboard from fulfillment app to here.
          Displays key fulfillment KPIs, graphs, or detailed tables.
        -->
        <div class="fulfillment-dashboard-grid">
          <!-- KPI 1: Fill Rate -->
          <ion-card class="kpi-card">
            <ion-card-content>
              <p class="overline">Weekly Fill Rate</p>
              <h2 class="kpi-value text-success">94.2%</h2>
              <ion-progress-bar :value="0.942" color="success"></ion-progress-bar>
              <p class="kpi-subtext">Target: 95.0%</p>
            </ion-card-content>
          </ion-card>

          <!-- KPI 2: Fulfillment Cycle Time -->
          <ion-card class="kpi-card">
            <ion-card-content>
              <p class="overline">Avg Cycle Time</p>
              <h2 class="kpi-value">3.8 hrs</h2>
              <ion-progress-bar :value="0.76" color="primary"></ion-progress-bar>
              <p class="kpi-subtext">Order received to shipping label</p>
            </ion-card-content>
          </ion-card>

          <!-- KPI 3: Rejection Rate -->
          <ion-card class="kpi-card">
            <ion-card-content>
              <p class="overline">Rejection Rate</p>
              <h2 class="kpi-value text-danger">1.8%</h2>
              <ion-progress-bar :value="0.18" color="danger"></ion-progress-bar>
              <p class="kpi-subtext">8 orders rejected today</p>
            </ion-card-content>
          </ion-card>

          <!-- KPI 4: Pending Pick -->
          <ion-card class="kpi-card">
            <ion-card-content>
              <p class="overline">Pending Pick</p>
              <h2 class="kpi-value">45</h2>
              <ion-progress-bar :value="0.45" color="warning"></ion-progress-bar>
              <p class="kpi-subtext">Awaiting picking assignment</p>
            </ion-card-content>
          </ion-card>
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
import {
  airplaneOutline,
  alertCircleOutline,
  cubeOutline,
  playCircleOutline,
  shieldHalfOutline,
  globeOutline,
  businessOutline
} from 'ionicons/icons';
import { computed } from 'vue';
import { translate } from '@common';
import { useCustomerServiceStore } from '@/store/customerService';

const store = useCustomerServiceStore();
const counts = computed(() => store.bucketCounts);

const totalBlocked = computed(() => {
  return counts.value['unfillable'] + counts.value['fraud'];
});

const totalInProgress = computed(() => {
  return counts.value['open'] + counts.value['inflight'] + counts.value['packed'];
});

const totalOrders = computed(() => totalBlocked.value + totalInProgress.value);
</script>

<style scoped>
.facets {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.facets ion-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  background: transparent;
  padding: 0;
}

.facet-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  margin: 0;
}

.selected-store-header {
  --background: transparent;
  margin-top: 8px;
  margin-bottom: 8px;
}

.global-stat {
  margin: 16px;
}

.total-orders {
  margin-bottom: 24px;
}

.big-number {
  margin: 8px 0;
}

.time-elapsed {
  color: var(--ion-color-medium);
  margin: 0;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metric-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.metric-label p {
  margin: 0;
}

.drilldown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.drilldown-card {
  margin: 0;
}

.card-detail {
  color: var(--ion-color-medium);
  margin-top: 8px;
  margin-bottom: 0;
}

.sparkline-container {
  margin-top: 12px;
  display: flex;
  align-items: center;
  height: 30px;
}

.hold-tasks-list {
  background: transparent;
  padding: 0;
}

.divider {
  border: 0;
  border-top: 1px solid var(--ion-color-step-150, #d7d8da);
  margin: 24px 0;
}

.facility-header {
  --background: transparent;
}

.dimension {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.facility-radio-item {
  --padding-start: 0;
  --inner-padding-end: 0;
}

.facility-radio-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}

.facility-radio-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  width: 100%;
}

.facility-radio-header h2 {
  margin: 0;
}

.fulfillment-dashboard-section {
  margin-top: 24px;
}

.section-title {
  margin-bottom: 16px;
}

.fulfillment-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.kpi-card {
  margin: 0;
}

.kpi-value {
  margin: 8px 0;
}

.kpi-subtext {
  color: var(--ion-color-medium);
  margin-top: 8px;
  margin-bottom: 0;
}

.text-success {
  color: var(--ion-color-success);
}

.text-danger {
  color: var(--ion-color-danger);
}
</style>
