import { defineStore } from 'pinia';
import { DateTime } from 'luxon';
import { useOrderStore } from '@/store/order';
import type {
  BulkActionDefinition,
  WorkflowBucket,
  WorkflowFilters,
  WorkflowOrder
} from '@/types/customerService';

const PRODUCT_STORES = [
  { id: 'STORE_US', name: 'HotWax US' },
  { id: 'STORE_EU', name: 'HotWax EU' },
  { id: 'STORE_CA', name: 'HotWax CA' }
];

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
    const store = pick(rng, PRODUCT_STORES);
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
    customerName: '',
    productStoreId: 'All',
    salesChannelEnumId: 'All',
    facilityId: 'All',
    shipmentMethodTypeId: 'All',
    priority: null,
    dateFrom: '',
    dateThru: ''
  };
}

function matchesFilters(order: WorkflowOrder, filters: WorkflowFilters): boolean {
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const haystack = `${order.orderName} ${order.externalId} ${order.orderId}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.customerName) {
    if (!order.customerName.toLowerCase().includes(filters.customerName.toLowerCase())) return false;
  }
  if (filters.productStoreId !== 'All' && order.productStoreId !== filters.productStoreId) return false;
  if (filters.salesChannelEnumId !== 'All' && order.salesChannelEnumId !== filters.salesChannelEnumId) return false;
  if (filters.facilityId !== 'All' && order.facilityId !== filters.facilityId) return false;
  if (filters.shipmentMethodTypeId !== 'All' && order.shippingMethodTypeId !== filters.shipmentMethodTypeId) return false;
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
    productStores: () => PRODUCT_STORES,
    facilities: () => FACILITIES,
    channels: () => CHANNELS,
    priorities: () => ['HIGH', 'NORMAL', 'LOW'],
    ordersInBucket: (state) => (bucket: WorkflowBucket) =>
      state.orders.filter((order) => inBucket(order, bucket)),
    filteredOrders(state) {
      return (bucket: WorkflowBucket) => {
        const orderStore = useOrderStore();
        if (bucket === 'open' || bucket === 'inflight' || bucket === 'packed') {
          return orderStore.workflowOrders[bucket];
        }
        const filters = state.filters[bucket];
        return state.orders.filter((order) => inBucket(order, bucket) && matchesFilters(order, filters));
      };
    },
    bucketCounts: (state) => {
      const { workflowOrders } = useOrderStore();
      return {
        unfillable: state.orders.filter((order) => inBucket(order, 'unfillable')).length,
        fraud: state.orders.filter((order) => inBucket(order, 'fraud')).length,
        open: workflowOrders.open.length,
        inflight: workflowOrders.inflight.length,
        packed: workflowOrders.packed.length
      };
    }
  },
  actions: {
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
      // TODO: API-backed buckets (open/inflight/packed) need real endpoints to execute bulk actions
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
