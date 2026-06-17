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
            <ion-item lines="none" class="title">
              <ion-label>
                <p class="overline">Orders Pending Fulfillment</p>
              </ion-label>
            </ion-item>
            <div class="pending">
              <ion-item lines="none" style="width: 100%;">
                <h1 slot="start" style="margin: 0 16px 0 0; font-size: 28px;">{{ facilityFulfillmentProgress?.totalPending ?? 0 }}</h1>
                <ion-label>
                  <p>Oldest order assigned</p>
                  {{ oldestAssignedRelativeStr }}
                </ion-label>
              </ion-item>
            </div>
            <ion-list class="fulfill">
              <ion-item lines="full" :button="true" :detail="true" :router-link="workflowRoute('/open')">
                <ion-icon :icon="mailUnreadOutline" slot="start" />
                <ion-label>{{ facilityFulfillmentProgress?.openCount ?? 0 }} open</ion-label>
              </ion-item>
              <ion-item lines="none" :button="true" :detail="true" :router-link="workflowRoute('/inflight')">
                <ion-icon :icon="mailOpenOutline" slot="start" />
                <ion-label>{{ facilityFulfillmentProgress?.inProgressCount ?? 0 }} in progress</ion-label>
              </ion-item>
            </ion-list>
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

        <!-- Fulfillment Sync Settings & Queue Section -->
        <div class="fulfillment-sync ion-margin-top" v-if="fulfillmentSyncData">
          <!-- Left Card: Fulfillment Sync Settings & Rate Limiting -->
          <ion-card class="ion-no-margin">
            <ion-card-header>
              <ion-card-subtitle class="overline">{{ translate("PENDING SYNC") }}</ion-card-subtitle>
              <ion-card-title class="big-number">{{ fulfillmentSyncData.settings?.pendingSyncCount ?? 0 }}</ion-card-title>
            </ion-card-header>

            <ion-card-content class="ion-no-padding">
              <!-- Sort Section -->
              <ion-item-divider>
                <ion-label>{{ translate("Sort") }}</ion-label>
                <ion-button id="add-sort-rule-trigger" fill="outline" size="small" slot="end" :disabled="availableSortOptions.length === 0">
                  {{ translate("ADD") }}
                  <ion-icon slot="end" :icon="addCircleOutline" />
                </ion-button>
              </ion-item-divider>

              <!-- Popover with available rules -->
              <ion-popover trigger="add-sort-rule-trigger" trigger-action="click" dismiss-on-select>
                <ion-content>
                  <ion-list>
                    <ion-item 
                      v-for="option in availableSortOptions" 
                      :key="option.enumId" 
                      button 
                      lines="none" 
                      @click="addSortRule(option.enumCode)"
                    >
                      <ion-label>{{ option.description || option.enumCode }}</ion-label>
                    </ion-item>
                  </ion-list>
                </ion-content>
              </ion-popover>

              <!-- Reorderable List of rules -->
              <ion-list lines="full" class="ion-no-padding">
                <ion-reorder-group :disabled="false" @ionItemReorder="handleReorder">
                  <ion-item v-for="rule in sortRules" :key="rule.id">
                    <ion-label>{{ rule.name }}</ion-label>
                    <ion-button slot="end" fill="clear" color="danger" @click="removeSortRule(rule.id)">
                      <ion-icon slot="icon-only" :icon="closeOutline" />
                    </ion-button>
                    <ion-reorder slot="end" />
                  </ion-item>
                </ion-reorder-group>
              </ion-list>

              <!-- Ratelimit Section -->
              <ion-item-divider>
                <ion-label>{{ translate("Ratelimit") }}</ion-label>
              </ion-item-divider>

              <!-- Batch size -->
              <ion-item lines="full">
                <ion-label>
                  <h2>{{ translate("Batch size") }}</h2>
                  <p>{{ translate("Orders per run") }}</p>
                </ion-label>
                <ion-input slot="end" type="number" :value="fulfillmentSyncData.settings?.batchSize" class="ion-text-end" style="max-width: 100px" @ionChange="handleBatchSizeChange" />
              </ion-item>

              <!-- Frequency -->
              <ion-item lines="none">
                <ion-label>
                  <h2>{{ translate("Frequency") }}</h2>
                  <p>{{ fulfillmentSyncData.settings?.paused === 'Y' ? translate('Paused') : translate(fulfillmentSyncData.settings?.frequency) }}</p>
                </ion-label>
                <ion-button fill="outline" slot="end" @click="openScheduleModal()">
                  {{ fulfillmentSyncData.settings?.paused === 'Y' ? translate('Paused') : fulfillmentSyncData.settings?.cronExpression }}
                </ion-button>
              </ion-item>
            </ion-card-content>
          </ion-card>

          <!-- Schedule Modal -->
          <ion-modal :is-open="isScheduleModalOpen" @didDismiss="closeScheduleModal">
            <ion-header>
              <ion-toolbar>
                <ion-buttons slot="start">
                  <ion-button @click="closeScheduleModal">
                    <ion-icon :icon="closeOutline" />
                  </ion-button>
                </ion-buttons>
                <ion-title>{{ translate("Schedule") }}</ion-title>
              </ion-toolbar>
            </ion-header>

            <ion-content class="ion-padding">
              <!-- Expression Input -->
              <ion-item class="expression-input-item">
                <ion-label position="stacked">{{ translate("Expression") }}</ion-label>
                <ion-input v-model="cronExpressionInput" placeholder="0 */15 * ? * *"></ion-input>
                <ion-icon :icon="informationCircleOutline" slot="end" class="info-icon" />
              </ion-item>

              <!-- Description, Next Run and Active Status -->
              <ion-list lines="none" class="schedule-info-list ion-margin-top">
                <ion-item>
                  <ion-icon :icon="refreshOutline" slot="start" />
                  <ion-label>{{ cronDescription }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon :icon="timeOutline" slot="start" />
                  <ion-label>{{ nextRunTime }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon :icon="powerOutline" slot="start" />
                  <ion-label>{{ translate("Active") }}</ion-label>
                  <ion-toggle slot="end" v-model="isJobActive" />
                </ion-item>
              </ion-list>

              <!-- Pre-made Options -->
              <h3 class="options-header ion-margin-top">{{ translate("Schedule Options") }}</h3>
              <ion-radio-group v-model="selectedScheduleOption" @ionChange="handleScheduleOptionChange">
                <ion-item v-for="option in scheduleOptions" :key="option.value">
                  <ion-radio slot="start" :value="option.value" />
                  <ion-label>{{ option.label }}</ion-label>
                </ion-item>
              </ion-radio-group>

              <!-- Floating Save Button -->
              <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                <ion-fab-button @click="saveSchedule">
                  <ion-icon :icon="saveOutline" />
                </ion-fab-button>
              </ion-fab>
            </ion-content>
          </ion-modal>

          <!-- Right side: Queue progress & timeline -->
          <div class="sync-queue-container">
            <template v-if="sortRules.length > 0">
              <!-- Queue Head/Tail Info Labels -->
              <div class="queue-header-labels">
                <ion-note class="overline">{{ translate("Last to Process") }}</ion-note>
                <ion-note class="overline">{{ translate("Next to Process") }} →</ion-note>
              </div>
              <!-- Progress Bar -->
              <div class="queue-progress-bar-container">
                <div 
                  v-for="segment in queueSegments" 
                  :key="segment.id" 
                  class="queue-segment" 
                  :class="segment.color?.startsWith('#') ? '' : segment.color" 
                  :style="{ 
                    width: segment.percentWidth + '%', 
                    minWidth: segment.orderCount > 0 ? '8px' : '0px',
                    backgroundColor: segment.color?.startsWith('#') ? segment.color : undefined,
                    opacity: hoveredSegmentId && hoveredSegmentId !== segment.id ? 0.35 : 1,
                    transform: hoveredSegmentId === segment.id ? 'scaleY(1.2) scaleX(1.05)' : 'none',
                    boxShadow: hoveredSegmentId === segment.id ? '0 0 6px rgba(255, 255, 255, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.5)' : 'none',
                    zIndex: hoveredSegmentId === segment.id ? 2 : 1,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }" 
                  :title="`${segment.label}: ${segment.orderCount} ${translate('orders')} (${segment.estimatedTime})`"
                  @mouseenter="hoveredSegmentId = segment.id"
                  @mouseleave="hoveredSegmentId = null"
                />
              </div>

              <!-- Segments Legend Grid Header -->
              <div class="queue-header-labels ion-margin-top">
                <ion-note class="overline">{{ translate("Queue Breakdown") }}</ion-note>
              </div>

              <!-- Segments Legend Grid -->
              <div class="legend-grid">
                <div 
                  v-for="(segment, visibleIndex) in queueSegments.filter(s => s.orderCount > 0)" 
                  :key="segment.id"
                  class="legend-card"
                  :class="{ 'active-card': hoveredSegmentId === segment.id }"
                  :style="{ 
                    borderLeftColor: segment.color === 'standard' ? '#9aa0a6' : segment.color === 'next-day' ? '#3880ff' : segment.color === 'same-day' ? '#ffd534' : segment.color,
                    opacity: hoveredSegmentId && hoveredSegmentId !== segment.id ? 0.45 : 1
                  }"
                  @mouseenter="hoveredSegmentId = segment.id"
                  @mouseleave="hoveredSegmentId = null"
                >
                  <div class="legend-card-header">
                    <span class="legend-orders">
                      <span class="legend-position">#{{ visibleIndex + 1 }}</span>
                      {{ segment.orderCount }} {{ translate("orders") }}
                    </span>
                    <span class="legend-time">{{ segment.estimatedTime }}</span>
                  </div>
                  <div class="legend-label" :title="segment.label">{{ segment.label }}</div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="empty-state">
                <p>{{ translate("No sorting conditions configured.") }}</p>
              </div>
            </template>
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
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
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
  IonNote,
  IonReorderGroup,
  IonReorder,
  IonInput,
  IonItemDivider,
  IonPopover,
  IonModal,
  IonFab,
  IonFabButton,
  IonToggle
} from '@ionic/vue';
import { ref } from 'vue';
import {
  globeOutline,
  businessOutline,
  informationCircleOutline,
  mailUnreadOutline,
  mailOpenOutline,
  addCircleOutline,
  closeOutline,
  timeOutline,
  refreshOutline,
  saveOutline,
  powerOutline
} from 'ionicons/icons';
import { computed, watch } from 'vue';
import { translate, RadioFacetGroup, StatCard, Sparkline, commonUtil } from '@common';
import { useCustomerServiceStore } from '@/store/customerService';
import { useProductStore } from '@/store/productStore';
import { useSeedStore } from '@/store/seed';

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

const fulfillmentSyncData = computed(() => store.getFulfillmentSyncData);

const queueSegments = computed(() => {
  const syncData = fulfillmentSyncData.value;
  if (!syncData || !syncData.settings || !syncData.rawOrderCountRecords) return [];

  const batchSize = syncData.settings.batchSize || 200;
  const cronExpression = syncData.settings.cronExpression || '0 */5 * ? * *';
  const sortRules = syncData.settings.sortRules || [];
  const records = syncData.rawOrderCountRecords || [];

  // 1. Calculate interval minutes from cron expression
  let cronIntervalMinutes = 5;
  try {
    const parsedCron = commonUtil.parseCronExpression(cronExpression);
    const next1 = parsedCron.next().getTime();
    const next2 = parsedCron.next().getTime();
    cronIntervalMinutes = Math.max(1, Math.round((next2 - next1) / (60 * 1000)));
  } catch (error) {
    console.error('Failed to parse cron expression for interval', error);
  }

  const formatEstimatedTime = (mins: number) => {
    if (mins <= 0) return '0 MIN';
    if (mins < 60) return `+${mins} MIN`;
    const hrs = Math.round(mins / 60);
    return `+${hrs} HR`;
  };

  // 2. Queue segments based on the top sorting parameter
  const topSortField = sortRules[0]?.id || 'deliveryDays';
  let segments: any[] = [];

  const seedStore = useSeedStore() as any;

  if (topSortField === 'deliveryDays' || topSortField === 'shipmentMethodTypeId') {
    // Dynamic combinations grouping
    const segmentMap = new Map<string, { deliveryDays: number; shipmentMethodTypeId: string; count: number }>();
    records.forEach((rec: any) => {
      const days = Number(rec.deliveryDays || 0);
      const methodId = String(rec.shipmentMethodTypeId || '').trim();
      const key = `${days}::${methodId}`;
      const count = Number(rec.orderCount || 0);
      
      const existing = segmentMap.get(key) || { deliveryDays: days, shipmentMethodTypeId: methodId, count: 0 };
      existing.count += count;
      segmentMap.set(key, existing);
    });

    const sortedCombinations = Array.from(segmentMap.values()).sort((a, b) => 
      a.deliveryDays !== b.deliveryDays ? a.deliveryDays - b.deliveryDays : a.shipmentMethodTypeId.localeCompare(b.shipmentMethodTypeId)
    );

    const totalCount = sortedCombinations.reduce((sum, item) => sum + item.count, 0) || 1;
    const PALETTE = ['#3880ff', '#10dc60', '#ffd534', '#ff4961', '#7044ff', '#0cd1e8', '#ff9800', '#e040fb', '#00e676', '#ff1744', '#2979ff'];

    let runningMinutes = 0;
    segments = sortedCombinations.map((item, index) => {
      const shipmentMethod = seedStore.shipmentMethodTypes?.byId?.[item.shipmentMethodTypeId];
      const label = `${item.deliveryDays}d - ${shipmentMethod?.description || item.shipmentMethodTypeId || 'None'}`;
      const segmentMinutes = Math.ceil(item.count / batchSize) * cronIntervalMinutes;
      runningMinutes += segmentMinutes;
      return {
        id: `${item.deliveryDays}_${item.shipmentMethodTypeId || 'none'}`.toLowerCase(),
        label,
        orderCount: item.count,
        estimatedTime: formatEstimatedTime(runningMinutes),
        color: PALETTE[index % PALETTE.length],
        percentWidth: (item.count / totalCount) * 100
      };
    });
  } else {
    // Unified static groupings config
    const SEGMENT_CONFIGS: Record<string, { id: string; label: string; color: string }[]> = {
      priority: [
        { id: 'high', label: 'High Priority', color: 'same-day' },
        { id: 'normal', label: 'Normal Priority', color: 'next-day' },
        { id: 'low', label: 'Low Priority', color: 'standard' }
      ],
      isRushOrder: [
        { id: 'rush', label: 'Rush Orders', color: 'same-day' },
        { id: 'non_rush', label: 'Standard Orders', color: 'standard' }
      ],
      orderDate: [
        { id: 'oldest', label: 'Overdue (>24h)', color: 'same-day' },
        { id: 'recent', label: 'Today', color: 'next-day' }
      ],
      default: [
        { id: 'standard', label: 'Standard', color: 'standard' },
        { id: 'next_day', label: 'Next day', color: 'next-day' },
        { id: 'same_day', label: 'Same day', color: 'same-day' }
      ]
    };

    const configKey = ['priority', 'isRushOrder', 'orderDate'].includes(topSortField) ? topSortField : 'default';
    const config = SEGMENT_CONFIGS[configKey];
    const counts: Record<string, number> = {};
    config.forEach(c => counts[c.id] = 0);

    records.forEach((rec: any) => {
      let key = 'normal';
      const val = rec[topSortField];
      if (topSortField === 'priority') {
        const num = Number(val);
        if (val === null || val === undefined || val === '') key = 'normal';
        else if (!isNaN(num)) {
          if (num >= 1 && num <= 3) key = 'high';
          else if (num === 0 || (num >= 7 && num <= 9)) key = 'low';
          else key = 'normal';
        } else {
          const str = String(val).toUpperCase();
          if (str === '100' || str === 'HIGH') key = 'high';
          else if (str === '0' || str === 'LOW') key = 'low';
          else key = 'normal';
        }
      } else if (topSortField === 'isRushOrder') {
        key = String(val || '').toUpperCase() === 'Y' ? 'rush' : 'non_rush';
      } else if (topSortField === 'orderDate') {
        if (!val) key = 'recent';
        else {
          const orderTime = typeof val === 'number' ? val : Date.parse(val);
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          key = (!isNaN(orderTime) && orderTime < cutoff) ? 'oldest' : 'recent';
        }
      } else {
        const methodId = rec.shipmentMethodTypeId || rec.deliveryDays;
        key = methodId === 'STANDARD' ? 'standard' : (methodId === 'EXPRESS' ? 'next_day' : 'same_day');
      }
      counts[key] = (counts[key] || 0) + Number(rec.orderCount || 0);
    });

    const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0) || 1;
    let runningMinutes = 0;
    segments = config.map(c => {
      const count = counts[c.id] || 0;
      const mins = Math.ceil(count / batchSize) * cronIntervalMinutes;
      runningMinutes += mins;
      return {
        id: c.id,
        label: c.label,
        orderCount: count,
        estimatedTime: formatEstimatedTime(runningMinutes),
        color: c.color,
        percentWidth: (count / totalCount) * 100
      };
    });
  }

  return segments;
});

const selectedStoreId = ref('');
const selectedFacilityId = ref('BROADWAY');
const hoveredSegmentId = ref<string | null>(null);
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
      store.fetchFulfillmentSyncData(selectedFacilityId.value, newStoreId);
    }
  }
}, { immediate: true });

watch(selectedFacilityId, (newFacilityId) => {
  if (newFacilityId && selectedStoreId.value) {
    store.fetchFacilityFulfillmentProgress(newFacilityId, selectedStoreId.value);
    store.fetchFulfillmentSyncData(newFacilityId, selectedStoreId.value);
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
  const seedStore = useSeedStore()
  return seedStore.facilityName(facilityId);
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


// Local state for reordering sorting rules
const sortRules = ref<any[]>([]);

watch(fulfillmentSyncData, (newData) => {
  if (newData?.settings?.sortRules) {
    sortRules.value = [...newData.settings.sortRules];
  }
}, { immediate: true });

const handleReorder = (event: any) => {
  const draggedItem = sortRules.value.splice(event.detail.from, 1)[0];
  sortRules.value.splice(event.detail.to, 0, draggedItem);
  event.detail.complete();

  store.updateSortRulesOrder(selectedFacilityId.value, sortRules.value);
};


const availableSortOptions = computed(() => {
  const seedStore = useSeedStore() as any;
  const allParams = seedStore.getEnumsByType('PP_SORT_PARAM_TYPE') || [];
  const currentIds = sortRules.value.map(r => r.id);
  return allParams.filter((e: any) => !currentIds.includes(e.enumCode));
});

function addSortRule(enumCode: string) {
  store.addSortRule(selectedFacilityId.value, enumCode);
}

function removeSortRule(enumCode: string) {
  store.removeSortRule(selectedFacilityId.value, enumCode);
}

const isScheduleModalOpen = ref(false);
const cronExpressionInput = ref('');
const selectedScheduleOption = ref('');
const isJobActive = ref(true);

const scheduleOptions = computed(() => [
  { label: translate('Every 5 minutes'), value: '0 */5 * ? * *' },
  { label: translate('Every 15 minutes'), value: '0 */15 * ? * *' },
  { label: translate('Every 30 minutes'), value: '0 */30 * ? * *' },
  { label: translate('Hourly'), value: '0 0 * ? * *' },
  { label: translate('Every six hours'), value: '0 0 */6 ? * *' },
  { label: translate('Every day at midnight'), value: '0 0 0 ? * *' }
]);

const cronDescription = computed(() => {
  if (!cronExpressionInput.value) return '';
  const desc = commonUtil.getCronString(cronExpressionInput.value);
  return desc ? translate(desc) : translate('Invalid expression');
});

const nextRunTime = computed(() => {
  if (!isJobActive.value) return translate('Paused');
  if (!cronExpressionInput.value) return '-';
  try {
    return commonUtil.getNextExecutionTime(cronExpressionInput.value);
  } catch (error) {
    return translate('Invalid expression');
  }
});

watch(cronExpressionInput, (newVal) => {
  const match = scheduleOptions.value.find(opt => opt.value === newVal);
  selectedScheduleOption.value = match ? match.value : '';
});


function openScheduleModal() {
  const currentCron = fulfillmentSyncData.value?.settings?.cronExpression || 'Paused';
  cronExpressionInput.value = currentCron;
  const paused = fulfillmentSyncData.value?.settings?.paused || 'N';
  isJobActive.value = paused !== 'Y';
  isScheduleModalOpen.value = true;
}

function closeScheduleModal() {
  isScheduleModalOpen.value = false;
}

function handleScheduleOptionChange(event: any) {
  const value = event.detail.value;
  if (value) {
    cronExpressionInput.value = value;
  }
}

async function saveSchedule() {
  const settings = fulfillmentSyncData.value?.settings;
  if (!settings || !settings.jobName) {
    commonUtil.showToast(translate('Job name not found. Cannot save.'));
    return;
  }
  
  await store.updateServiceJob(
    settings.jobName,
    cronExpressionInput.value,
    isJobActive.value ? 'N' : 'Y',
    selectedFacilityId.value,
    selectedStoreId.value
  );
  
  closeScheduleModal();
}

function handleBatchSizeChange(event: any) {
  const rawValue = event.detail?.value !== undefined ? event.detail.value : event.target?.value;
  console.log('handleBatchSizeChange rawValue:', rawValue);
  const newSize = parseInt(rawValue);
  if (!isNaN(newSize) && newSize > 0) {
    console.log('Dispatching updateBatchSize with facilityId:', selectedFacilityId.value, 'and size:', newSize);
    store.updateBatchSize(selectedFacilityId.value, newSize);
  }
}
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
                        "fill-rate progress-bar";
    grid-template-columns: 350px 1fr;
    grid-template-rows: auto auto;
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
    align-items: center;
  }
}

.title {
  grid-area: title;
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


/* Fulfillment Sync Styles */
.fulfillment-sync {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-base);
  margin-top: var(--spacer-lg);
}

@media (min-width: 991px) {
  .fulfillment-sync {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: var(--spacer-base);
    align-items: start;
  }
}

/* Sync Queue Timeline */
.sync-queue-container {
  display: flex;
  flex-direction: column;
  padding: var(--spacer-sm) var(--spacer-base) 0 var(--spacer-base);
}

.queue-progress-bar-container {
  display: flex;
  flex-direction: row-reverse;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-300, #b3b3b3);
  margin-bottom: var(--spacer-base);
  background-color: var(--ion-color-step-50, #ffffff);
}

.queue-segment {
  height: 100%;
}

.queue-segment.standard {
  background-color: #9aa0a6; /* Grey segment */
}

.queue-segment.next-day {
  background-color: #3880ff; /* Blue segment */
}

.queue-segment.same-day {
  background-color: #ffd534; /* Yellow segment */
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-top: var(--spacer-base);
}

.queue-header-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}

.queue-header-labels ion-note {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  color: var(--ion-color-step-400, #999999);
  text-transform: uppercase;
}

.legend-position {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
  margin-right: 8px;
  color: var(--ion-color-step-600, #666666);
}

.legend-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left-width: 4px;
  border-left-style: solid;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.legend-card:hover, .legend-card.active-card {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.legend-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legend-orders {
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-color-dark, #f4f5f8);
}

.legend-time {
  font-size: 12px;
  font-weight: 500;
  color: var(--ion-color-step-400, #999999);
}

.legend-label {
  font-size: 12px;
  color: var(--ion-color-step-500, #808080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expression-input-item {
  --background: transparent;
  border-bottom: 1px solid var(--ion-color-step-150, #e0e0e0);
}

.expression-input-item ion-icon {
  color: var(--ion-color-step-400, #999999);
}

.schedule-info-list ion-item {
  --background: transparent;
  --min-height: 40px;
}

.schedule-info-list ion-icon {
  margin-inline-end: 16px;
  color: var(--ion-color-step-600, #666666);
}

.options-header {
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-step-600, #666666);
  padding: 16px 16px 8px 16px;
  margin: 0;
}

.sync-queue-container .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  border: 1.5px dashed var(--ion-color-step-200, #cccccc);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  padding: var(--spacer-base);
  text-align: center;
}

.sync-queue-container .empty-state p {
  color: var(--ion-color-step-500, #808080);
  font-size: 14px;
  margin: 0;
}
</style>
