import { defineStore } from 'pinia';
import { useOrderStore } from '@/store/order';
import type {
  BulkActionDefinition,
  WorkflowBucket,
  WorkflowFilters
} from '@/types/customerService';

const PRODUCT_STORES = [
  { id: 'STORE_US', name: 'HotWax US' },
  { id: 'STORE_EU', name: 'HotWax EU' },
  { id: 'STORE_CA', name: 'HotWax CA' }
];

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

export const useCustomerServiceStore = defineStore('customerService', {
  state: () => ({
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
    filteredOrders() {
      return (bucket: WorkflowBucket) => {
        const orderStore = useOrderStore();
        if (bucket === 'open' || bucket === 'inflight' || bucket === 'packed') {
          return orderStore.workflowOrders[bucket];
        }
        return [];
      };
    },
    bucketCounts: () => {
      const { workflowOrders } = useOrderStore();
      return {
        unfillable: 0,
        fraud: 0,
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
