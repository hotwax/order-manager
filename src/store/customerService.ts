import { defineStore } from 'pinia';
import { DateTime } from 'luxon';
import { api } from '@common';
import type {
  BulkActionDefinition,
  ProductStore,
  WorkflowBucket,
  WorkflowFilters,
  WorkflowOrder,
  FulfillmentProgress,
  FacilityFulfillmentProgress
} from '@/types/customerService';

const FACILITIES = [
  { id: 'WH_RNO', name: 'Reno DC' },
  { id: 'WH_ATL', name: 'Atlanta DC' },
  { id: 'WH_LDN', name: 'London DC' }
];

const CHANNELS = ['WEB_SALES_CHANNEL', 'POS_SALES_CHANNEL', 'MOBILE_SALES_CHANNEL', 'MARKETPLACE_CHANNEL'];
const SHIP_METHODS = [
  { id: 'STANDARD', desc: 'Ground · 3-5 days' },
  { id: 'EXPRESS', desc: 'Express · 2 day' },
  { id: 'OVERNIGHT', desc: 'Overnight' },
  { id: 'STORE_PICKUP', desc: 'Store pickup' }
];
const PRIORITIES: WorkflowOrder['priority'][] = ['HIGH', 'NORMAL', 'NORMAL', 'NORMAL', 'LOW'];
const FIRST_NAMES = ['Avery', 'Bhavya', 'Cole', 'Devi', 'Eli', 'Farrah', 'Gita', 'Hank', 'Indira', 'Jules', 'Kenji', 'Lalita', 'Mira', 'Noor', 'Omar', 'Priya'];
const LAST_NAMES = ['Patel', 'Nguyen', 'Garcia', 'Okafor', 'Sato', 'Kowalski', 'Andersen', 'Reyes', 'Singh', 'Cohen'];

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function generateOrders(): WorkflowOrder[] {
  const rng = makeRng(42);
  const orders: WorkflowOrder[] = [];
  const now = DateTime.now();

  for (let i = 0; i < 60; i++) {
    const store = { id: 'STORE_US', name: 'HotWax US' }; // Hardcoded for mock orders
    const channel = pick(rng, CHANNELS);
    const shipMethod = pick(rng, SHIP_METHODS);
    const bucketRoll = rng();
    const orderDate = now.minus({ hours: Math.floor(rng() * 96) }).toISO();
    const customer = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;

    let facility: { id: string; name: string } | null = null;
    let brokeringDate: string | null = null;
    let picklistBinId: string | null = null;
    let pickedDate: string | null = null;
    let receivedAtFacility = false;
    let statusId = 'ORDER_APPROVED';
    let bucket: WorkflowBucket = 'open';

    if (bucketRoll < 0.15) {
      bucket = 'unfillable';
      statusId = 'ORDER_APPROVED';
    } else if (bucketRoll < 0.45) {
      bucket = 'fraud';
      statusId = 'ORDER_HELD';
    } else if (bucketRoll < 0.75) {
      bucket = 'open';
      statusId = 'ORDER_APPROVED';
    } else if (bucketRoll < 0.9) {
      bucket = 'inflight';
      statusId = 'ORDER_APPROVED';
      facility = pick(rng, FACILITIES);
      receivedAtFacility = true;
    } else {
      bucket = 'packed';
      statusId = 'ORDER_APPROVED';
      facility = pick(rng, FACILITIES);
      receivedAtFacility = true;
    }

    orders.push({
      orderId: `ORD-${10000 + i}`,
      orderName: `#${10000 + i}`,
      externalId: `SHOP-${100000 + i}`,
      statusId,
      orderDate: orderDate ?? '',
      productStoreId: store.id,
      productStoreName: store.name,
      salesChannelEnumId: channel,
      customerName: customer,
      customerPartyId: `CUST-${1000 + i}`,
      grandTotal: Math.round(rng() * 50000) / 100 + 12,
      currencyUomId: store.id === 'STORE_EU' ? 'EUR' : store.id === 'STORE_CA' ? 'CAD' : 'USD',
      itemCount: 1 + Math.floor(rng() * 6),
      shipGroupSeqId: '00001',
      shippingMethodTypeId: shipMethod.id,
      shipmentMethodDesc: shipMethod.desc,
      priority: pick(rng, PRIORITIES),
      facilityId: facility?.id ?? null,
      facilityName: facility?.name ?? null,
      brokeringDate,
      picklistBinId,
      pickedDate,
      receivedAtFacility,
      shipBeforeDate: now.plus({ days: 1 + Math.floor(rng() * 5) }).toISO(),
      bucket
    });
  }

  return orders;
}

function emptyFilters(): WorkflowFilters {
  return {
    query: '',
    productStoreId: 'All',
    salesChannelEnumId: 'All',
    facilityId: 'All',
    priority: 'All',
    dateFrom: '',
    dateThru: ''
  };
}

function matchesFilters(order: WorkflowOrder, filters: WorkflowFilters): boolean {
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const haystack = `${order.orderName} ${order.externalId} ${order.orderId} ${order.customerName}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.productStoreId !== 'All' && order.productStoreId !== filters.productStoreId) return false;
  if (filters.salesChannelEnumId !== 'All' && order.salesChannelEnumId !== filters.salesChannelEnumId) return false;
  if (filters.facilityId !== 'All' && order.facilityId !== filters.facilityId) return false;
  if (filters.priority !== 'All' && order.priority !== filters.priority) return false;
  if (filters.dateFrom) {
    const from = DateTime.fromISO(filters.dateFrom).startOf('day');
    if (DateTime.fromISO(order.orderDate) < from) return false;
  }
  if (filters.dateThru) {
    const thru = DateTime.fromISO(filters.dateThru).endOf('day');
    if (DateTime.fromISO(order.orderDate) > thru) return false;
  }
  return true;
}

function inBucket(order: WorkflowOrder, bucket: WorkflowBucket): boolean {
  return order.bucket === bucket;
}

export const useCustomerServiceStore = defineStore('customerService', {
  state: () => ({
    productStores: [] as ProductStore[],
    isFetchingProductStores: false,
    fulfillmentProgress: {
      totalOrdersCount: 0,
      totalShipGroupsCount: 0,
      brokeredShipGroupsCount: 0,
      pickedShipGroupsCount: 0,
      packedShipGroupsCount: 0,
      shippedShipGroupsCount: 0
    } as FulfillmentProgress,
    openOrders: {
      openOrdersCount: 0,
      oldestOpenOrderDate: null as number | null
    },
    unfillable: {
      unfillableHourlyCounts: [] as { shipGroupDateHour: string; shipGroupCount: number }[]
    },
    holdTasks: {
      holdTasksTotalCount: 0,
      holdSubstituteCount: 0,
      holdBadAddressCount: 0,
      holdFraudRiskCount: 0
    },
    facilityOrderVolume: [] as any[],
    facilityFulfillmentVelocity: [] as any[],
    facilityPartialFulfillments: [] as any[],
    facilityFulfillmentProgress: null as FacilityFulfillmentProgress | null,
    orders: generateOrders() as WorkflowOrder[],
    filters: {
      unfillable: emptyFilters(),
      fraud: emptyFilters(),
      open: emptyFilters(),
      inflight: emptyFilters(),
      packed: emptyFilters()
    } as Record<WorkflowBucket, WorkflowFilters>,
    selection: {
      unfillable: [] as string[],
      fraud: [] as string[],
      open: [] as string[],
      inflight: [] as string[],
      packed: [] as string[]
    } as Record<WorkflowBucket, string[]>,
    lastAction: '' as string
  }),
  getters: {
    facilities: () => FACILITIES,
    channels: () => CHANNELS,
    priorities: () => ['HIGH', 'NORMAL', 'LOW'],
    ordersInBucket: (state) => (bucket: WorkflowBucket) =>
      state.orders.filter((order) => inBucket(order, bucket)),
    filteredOrders(state) {
      return (bucket: WorkflowBucket) => {
        const filters = state.filters[bucket];
        return state.orders.filter((order) => inBucket(order, bucket) && matchesFilters(order, filters));
      };
    },
    bucketCounts: (state) => ({
      unfillable: state.orders.filter((order) => inBucket(order, 'unfillable')).length,
      fraud: state.orders.filter((order) => inBucket(order, 'fraud')).length,
      open: state.orders.filter((order) => inBucket(order, 'open')).length,
      inflight: state.orders.filter((order) => inBucket(order, 'inflight')).length,
      packed: state.orders.filter((order) => inBucket(order, 'packed')).length
    }),
    unfillableTrend(state): number[] {
      const todayStr = DateTime.now().toFormat('yyyy-MM-dd');
      return Array.from({ length: 24 }, (_, h) => {
        const match = state.unfillable.unfillableHourlyCounts?.find((d) => {
          const parsed = DateTime.fromSQL(d.shipGroupDateHour).isValid
            ? DateTime.fromSQL(d.shipGroupDateHour)
            : DateTime.fromISO(d.shipGroupDateHour);
          return parsed.isValid && parsed.toFormat('yyyy-MM-dd') === todayStr && parsed.hour === h;
        });
        return match ? match.shipGroupCount : 0;
      });
    }
  },
  actions: {
    async fetchProductStores() {
      if (this.isFetchingProductStores) return;
      
      this.isFetchingProductStores = true;
      try {
        const resp = await api({
          url: 'admin/productStores',
          method: 'GET'
        });
        this.productStores = resp.data || [];
      } catch (error) {
        console.error('Failed to fetch product stores', error);
      } finally {
        this.isFetchingProductStores = false;
      }
    },
    async fetchFulfillmentProgress(productStoreId?: string) {
      try {
        const resp = await api({
          url: 'oms/orders/funnelDashboard/fulfillmentProgress',
          method: 'GET',
          params: {
            productStoreId: productStoreId,
            dateFilter: DateTime.now().toFormat('yyyy-MM-dd')
          }
        });
        if (resp.data) {
          this.fulfillmentProgress = resp.data;
        }
      } catch (error) {
        console.error('Failed to fetch fulfillment progress', error);
      }
    },
    async fetchOpenOrders(productStoreId?: string) {
      try {
        const params: any = {};
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/openOrders',
          method: 'GET',
          params
        });
        if (resp.data) this.openOrders = resp.data;
      } catch (error) {
        console.error('Failed to fetch open orders', error);
      }
    },
    async fetchUnfillable(productStoreId?: string) {
      try {
        const params: any = {};
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/unfillable',
          method: 'GET',
          params
        });
        if (resp.data) this.unfillable = resp.data;
      } catch (error) {
        console.error('Failed to fetch unfillable stats', error);
      }
    },
    async fetchHoldTasks(productStoreId?: string) {
      try {
        const params: any = {};
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/holdTasks',
          method: 'GET',
          params
        });
        if (resp.data) this.holdTasks = resp.data;
      } catch (error) {
        console.error('Failed to fetch hold task counts', error);
      }
    },
    async fetchFacilityOrderVolume(productStoreId?: string) {
      try {
        const params: any = { dateFilter: DateTime.now().toFormat('yyyy-MM-dd') };
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/facilityOrderVolume',
          method: 'GET',
          params
        });
        if (resp.data) {
          this.facilityOrderVolume = resp.data.facilities || [];
        }
      } catch (error) {
        console.error('Failed to fetch facility order volume', error);
      }
    },
    async fetchFacilityFulfillmentVelocity(productStoreId?: string) {
      try {
        const params: any = { dateFilter: DateTime.now().toFormat('yyyy-MM-dd') };
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/facilityFulfillmentVelocity',
          method: 'GET',
          params
        });
        if (resp.data) {
          this.facilityFulfillmentVelocity = resp.data.facilities || [];
        }
      } catch (error) {
        console.error('Failed to fetch facility fulfillment velocity', error);
      }
    },
    async fetchFacilityPartialFulfillments(productStoreId?: string) {
      try {
        const params: any = { dateFilter: DateTime.now().toFormat('yyyy-MM-dd') };
        if (productStoreId) params.productStoreId = productStoreId;
        const resp = await api({
          url: 'oms/orders/funnelDashboard/facilityPartialFulfillments',
          method: 'GET',
          params
        });
        if (resp.data) {
          this.facilityPartialFulfillments = resp.data.facilities || [];
        }
      } catch (error) {
        console.error('Failed to fetch facility partial fulfillments', error);
      }
    },
    async fetchFacilityFulfillmentProgress(facilityId: string, productStoreId?: string) {
      try {
        const dateFilter = DateTime.now().toFormat('yyyy-MM-dd'); // Default / demo date filter
        const startOfDayStr = DateTime.fromISO(dateFilter).startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');
        const endOfDayStr = DateTime.fromISO(dateFilter).plus({ days: 1 }).startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');

        // 1. Fetch Facility Details
        const facilityPromise = api({
          url: `oms/facilities/${facilityId}`,
          method: 'GET'
        }).catch(err => {
          console.error('Failed to fetch facility details', err);
          return { data: {} };
        });

        // 2. Fetch Allocations today
        const allocationsPromise = api({
          url: `oms/facilities/facilityOrderCounts`,
          method: 'GET',
          params: {
            facilityId: facilityId, 
            entryDate: dateFilter
          }
        }).catch(err => {
          console.error('Failed to fetch allocations', err);
          return { data: {} };
        });

        // 3. Fetch Rejections today
        const rejectionsPromise = api({
          url: 'oms/dataDocumentView',
          method: 'POST',
          data: {
            dataDocumentId: 'ORDER_FACILITY_CHANGE',
            customParametersMap: {
              fromFacilityId: facilityId,
              facilityId: 'REJECTED_ITM_PARKING',
              productStoreId,
              pageNoLimit: true,
              changeDatetime_from: startOfDayStr,
              changeDatetime_thru: endOfDayStr
            },
            fieldsToSelect: 'orderId,shipGroupSeqId',
            distinct: true
          }
        }).catch(err => {
          console.error('Failed to fetch rejections', err);
          return { data: {} };
        });

        // 5. Fetch Pending Orders and progress stats
        const progressStatsPromise = api({
          url: 'oms/orders/funnelDashboard/fulfillmentProgress',
          method: 'GET',
          params: {
            facilityId,
            productStoreId,
            dateFilter
          }
        }).catch(err => {
          console.error('Failed to fetch facility fulfillment progress stats', err);
          return { data: {} };
        });

        const [facilityResp, allocationsResp, rejectionsResp, progressStatsResp] = await Promise.all([
          facilityPromise,
          allocationsPromise,
          rejectionsPromise,
          progressStatsPromise
        ]);

        const facilityData = facilityResp.data || {};
        const capacityLimit = facilityData.maximumOrderLimit ? Number(facilityData.maximumOrderLimit) : null;
        const openTime = facilityData.openTime ? String(facilityData.openTime) : null;
        const closeTime = facilityData.closeTime ? String(facilityData.closeTime) : null;
        const facilityTimeZone = facilityData.facilityTimeZone || 'UTC';
        const carrierPickupTime = '16:30:00';

        const allocationsList = allocationsResp.data || [];
        const ordersAllocated = allocationsList.length > 0 ? Number(allocationsList[0].lastOrderCount || 0) : 0;

        const rejectionsList = rejectionsResp.data?.entityValueList || [];
        const uniqueRejected = new Set(rejectionsList.map((item: any) => `${item.orderId}-${item.shipGroupSeqId}`));
        const ordersRejected = uniqueRejected.size;

        const progressData = progressStatsResp.data || {};
        const ordersPacked = Number(progressData.packedShipGroupsCount || 0) + Number(progressData.shippedShipGroupsCount || 0);

        const totalProcessed = ordersPacked + ordersRejected;
        const fillRate = totalProcessed > 0 ? (ordersPacked / totalProcessed) : 0;

        const openCount = Number(progressData.brokeredShipGroupsCount || 0);
        const inProgressCount = Number(progressData.pickedShipGroupsCount || 0);
        const totalPending = openCount + inProgressCount;
        
        let oldestAssignedTime: number | null = null;
        if (progressData.oldestShipGroupAssignedDatetime) {
          const parsed = DateTime.fromISO(String(progressData.oldestShipGroupAssignedDatetime));
          if (parsed.isValid) {
            oldestAssignedTime = parsed.toMillis();
          } else {
            const rawMillis = Date.parse(progressData.oldestShipGroupAssignedDatetime);
            if (!isNaN(rawMillis)) oldestAssignedTime = rawMillis;
          }
        }
        const assignedBeforeTodayCount = 0;

        this.facilityFulfillmentProgress = {
          ordersAllocated,
          ordersPacked,
          ordersRejected,
          capacityLimit,
          fillRate,
          openCount,
          inProgressCount,
          totalPending,
          oldestAssignedTime,
          assignedBeforeTodayCount,
          openTime,
          closeTime,
          facilityTimeZone,
          carrierPickupTime
        };

      } catch (error) {
        console.error('Failed to fetch facility fulfillment progress', error);
      }
    },
    clearFilters(bucket: WorkflowBucket) {
      this.filters[bucket] = emptyFilters();
    },
    toggleSelection(bucket: WorkflowBucket, orderId: string) {
      const set = new Set(this.selection[bucket]);
      if (set.has(orderId)) set.delete(orderId);
      else set.add(orderId);
      this.selection[bucket] = [...set];
    },
    setSelection(bucket: WorkflowBucket, ids: string[]) {
      this.selection[bucket] = ids;
    },
    clearSelection(bucket: WorkflowBucket) {
      this.selection[bucket] = [];
    },
    runBulkAction(bucket: WorkflowBucket, actionId: string) {
      const selectedIds = new Set(this.selection[bucket]);
      if (selectedIds.size === 0) return;

      this.orders = this.orders.map((order) => {
        if (!selectedIds.has(order.orderId)) return order;

        if (actionId === 'cancel') {
          return { ...order, statusId: 'ORDER_CANCELLED', bucket: 'open' };
        }
        if (actionId === 'release') {
          return { ...order, statusId: 'ORDER_APPROVED', bucket: 'open' };
        }
        if (actionId === 'rebroker') {
          return { ...order, statusId: 'ORDER_APPROVED', bucket: 'open', facilityId: null, facilityName: null };
        }
        if (actionId === 'wave') {
          return {
            ...order,
            picklistBinId: `BIN-${Math.floor(1000 + Math.random() * 9000)}`,
            bucket: 'packed'
          };
        }
        if (actionId === 'ship') {
          return { ...order, statusId: 'ORDER_COMPLETED', bucket: 'open' };
        }
        return order;
      });

      this.orders = this.orders.filter((order) => order.statusId !== 'ORDER_CANCELLED' && order.statusId !== 'ORDER_COMPLETED');

      this.lastAction = `${actionId} · ${selectedIds.size} order${selectedIds.size === 1 ? '' : 's'}`;
      this.clearSelection(bucket);
    }
  }
});

export const BULK_ACTIONS: Record<WorkflowBucket, BulkActionDefinition[]> = {
  unfillable: [
    { id: 'rebroker', label: 'Rebroker order' },
    { id: 'cancel', label: 'Cancel', confirmText: 'Cancel selected orders?' }
  ],
  fraud: [
    { id: 'release', label: 'Release order' },
    { id: 'cancel', label: 'Cancel', confirmText: 'Cancel selected orders?' }
  ],
  open: [
    { id: 'cancel', label: 'Cancel', confirmText: 'Cancel selected orders?' }
  ],
  inflight: [
    { id: 'wave', label: 'Add to picklist' }
  ],
  packed: [
    { id: 'ship', label: 'Ship orders' }
  ]
};
