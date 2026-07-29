import { api, logger } from '@common';
import { defineStore } from 'pinia';
import {
  searchOrders as searchOrderService,
  fetchOrderRowEnrichment,
  type OrderSearchParams
} from '@/services/order';
import { toStringValue, toNumberValue } from '@/services/OrderService';
import type { Customer, Order, ReturnRecord, Shipment } from '@/types/order';
import type { WorkflowOrder, WorkflowFilters } from '@/types/customerService';
import type { OrderRowEnrichment } from '@/types/orderRow';
import { useSeedStore } from '@/store/seed';
import { useProductStore } from './productStore';
import { queueCountFetchers } from '@/services/navCounts';


async function fetchWorkflowPage(
  bucket: 'open' | 'inflight' | 'packed',
  filters: WorkflowFilters,
  pageIndex: number
): Promise<{ orders: WorkflowOrder[]; total: number }> {
  const params: Record<string, any> = { pageSize: import.meta.env.VITE_VIEW_SIZE, pageIndex };
  if (filters.query) params.keyword = filters.query;
  if (filters.customerName) params.customerName = filters.customerName;
  if (filters.salesChannelEnumId && filters.salesChannelEnumId !== 'All') params.salesChannelEnumId = filters.salesChannelEnumId;
  if (filters.facilityId && filters.facilityId !== 'All') params.facilityId = filters.facilityId;
  if (filters.shipmentMethodTypeId && filters.shipmentMethodTypeId !== 'All') params.shipmentMethodTypeId = filters.shipmentMethodTypeId;
  const productStore = useProductStore();
  if (productStore.currentProductStore?.productStoreId) params.productStoreId = productStore.currentProductStore.productStoreId;
  if (filters.priority !== null) params.isPriority = filters.priority;
  if (filters.dateFrom) params.orderDateFrom = `${filters.dateFrom} 00:00:00`;
  if (filters.dateThru) params.orderDateThru = `${filters.dateThru} 23:59:59`;

  const resp = await api({ url: `oms/orders/salesOrders/${bucket}`, method: 'get', params });
  const docs: any[] = resp.data?.orders || [];
  const total: number = resp.data?.ordersCount ?? docs.length;

  const seedStore = useSeedStore();
  const orders = docs.map((doc: any) => {
    return {
      orderId: toStringValue(doc.orderId),
      orderName: toStringValue(doc.orderName),
      externalId: toStringValue(doc.externalId),
      statusId: toStringValue(doc.orderStatusId) || toStringValue(doc.statusId) || 'ORDER_APPROVED',
      orderDate: toStringValue(doc.orderDate),
      productStoreId: toStringValue(doc.productStoreId),
      productStoreName: (() => { const s = seedStore.productStores.byId[toStringValue(doc.productStoreId)]; return s?.storeName || s?.companyName || toStringValue(doc.productStoreId); })(),
      salesChannelEnumId: toStringValue(doc.salesChannelEnumId),
      customerName: `${toStringValue(doc.firstName)} ${toStringValue(doc.lastName)}`,
      customerPartyId: toStringValue(doc.billToPartyId),
      grandTotal: toNumberValue(doc.grandTotal),
      currencyUomId: toStringValue(doc.currencyUom) || 'USD',
      itemCount: toNumberValue(doc.itemCount),
      shipGroupSeqId: toStringValue(doc.shipGroupSeqId),
      shipmentId: toStringValue(doc.shipmentId),
      shipmentStatusId: toStringValue(doc.shipmentStatusId),
      shippingMethodTypeId: toStringValue(doc.shipmentMethodTypeId),
      shipmentMethodDesc: (() => { const m = seedStore.shipmentMethodTypes.byId[toStringValue(doc.shipmentMethodTypeId)]; return m?.description || toStringValue(doc.shipmentMethodTypeId); })(),
      carrierPartyId: toStringValue(doc.carrierPartyId),
      priority: (() => {
        const p = Number(doc.priority);
        if (isNaN(p)) return 'NORMAL' as const;
        if (p >= 1 && p <= 3) return 'HIGH' as const;
        if (p >= 4 && p <= 6) return 'NORMAL' as const;
        return 'LOW' as const;
      })(),
      facilityId: toStringValue(doc.facilityId) || null,
      facilityName: toStringValue(doc.facilityName) || null,
      brokeringDate: null,
      picklistBinId: null,
      pickedDate: null,
      receivedAtFacility: false,
      shipBeforeDate: toStringValue(doc.shipBeforeDate) || null,
      estimatedDeliveryDate: toStringValue(doc.estimatedDeliveryDate) || toStringValue(doc.promisedDatetime) || null,
      shippingAddress1: toStringValue(doc.address1) || toStringValue(doc.shippingAddress1),
      shippingCity: toStringValue(doc.city) || toStringValue(doc.shippingCity),
      shippingStateProvinceGeoId: toStringValue(doc.stateProvinceGeoId) || toStringValue(doc.shippingStateProvinceGeoId),
      shippingPostalCode: toStringValue(doc.postalCode) || toStringValue(doc.shippingPostalCode),
      shippingCountryGeoId: toStringValue(doc.countryGeoId) || toStringValue(doc.shippingCountryGeoId),
      bucket
    } satisfies WorkflowOrder;
  });

  return { orders, total };
}

export interface OrderSearchFilters {
  status: string[];
  channel: string;
  shipmentMethodTypeId: string;
  allocationState: string;
  productStoreId: string;
  dateFrom: string;
  dateThru: string;
  hasVirtualFacilityItems: boolean;
  archivedOnly: boolean;
}

export const useOrderStore = defineStore('orders', {
  state: () => ({
    searchQuery: '',
    searchFilters: {
      status: [],
      channel: 'All',
      shipmentMethodTypeId: 'All',
      allocationState: 'All',
      productStoreId: 'All',
      dateFrom: '',
      dateThru: '',
      hasVirtualFacilityItems: false,
      archivedOnly: false,
    } as OrderSearchFilters,
    searchSort: 'orderDate desc',
    searchResults: [] as Order[],
    searchTotal: 0,
    pageIndex: 0,
    pageSize: 50,
    loading: false,
    error: '',
    cache: {} as Record<string, Order>,
    shipmentList: [] as Shipment[],
    returnList: [] as ReturnRecord[],
    customerList: [] as Customer[],
    workflowOrders: {
      open: [] as WorkflowOrder[],
      inflight: [] as WorkflowOrder[],
      packed: [] as WorkflowOrder[]
    },
    workflowOrdersLoading: {
      open: false,
      inflight: false,
      packed: false
    },
    workflowOrdersTotal: {
      open: 0,
      inflight: 0,
      packed: 0
    },
    workflowOrdersPageIndex: {
      open: 0,
      inflight: 0,
      packed: 0
    },
    workflowOrderEnrichment: {
      open: {} as Record<string, OrderRowEnrichment>,
      inflight: {} as Record<string, OrderRowEnrichment>,
      packed: {} as Record<string, OrderRowEnrichment>
    },
    // Shared queue totals surfaced as menu rollup badges. Written as a byproduct
    // of each queue page fetching its own list; the menu reads them reactively.
    navCounts: {} as Record<string, number | undefined>,
    navCountPrimeRequestGeneration: 0
  }),
  getters: {
    filteredOrders: (state) => state.searchResults,
    orderList: (state) => state.searchResults,
    total: (state) => state.searchTotal,
    allOrders: (state) => Object.values(state.cache),
    hasMore: (state) => state.searchResults.length < state.searchTotal,
    openWork: (state) => Object.values(state.cache).filter((order) => order.status !== 'Completed' && order.status !== 'Cancelled'),
    getOrder: (state) => (orderId: string) => state.cache[orderId] || Object.values(state.cache).find((order) => order.externalId === orderId),
    getCustomer: (state) => (customerId: string) => state.customerList.find((customer) => customer.id === customerId),
    getShipment: (state) => (shipmentId: string) => state.shipmentList.find((shipment) => shipment.id === shipmentId),
    getReturn: (state) => (returnId: string) => state.returnList.find((returnRecord) => returnRecord.id === returnId),
    getCustomerOrders: (state) => (customerId: string) => Object.values(state.cache).filter((order) => order.customerId === customerId),
    workflowOrdersHasMore: (state) => (bucket: 'open' | 'inflight' | 'packed') =>
      state.workflowOrders[bucket].length < state.workflowOrdersTotal[bucket],
    workflowEnrichment: (state) => (bucket: 'open' | 'inflight' | 'packed', orderId: string) =>
      state.workflowOrderEnrichment[bucket][orderId],
  },
  actions: {
    setNavCount(key: string, total: number) {
      this.navCounts[key] = total;
    },
    clearNavCounts(keys: string[]) {
      keys.forEach((key) => {
        delete this.navCounts[key];
      });
    },
    clearPrimedNavCounts() {
      this.navCountPrimeRequestGeneration += 1;
      this.clearNavCounts(Object.keys(queueCountFetchers));
    },
    /**
     * Prime the nav-badge counts that no Funnel dashboard fetch already produces —
     * currently only brokering, which needs a distinct-order count over the whole
     * awaiting-brokering facility set. unfillable + the hold-task purposes are
     * published by the customer-service store; open/inflight/packed by the Funnel's
     * brokered-workload fetch. Each count uses the same query its queue page uses.
     */
    async primeNavCounts(productStoreId?: string) {
      const requestGeneration = ++this.navCountPrimeRequestGeneration;
      const storeId = productStoreId && productStoreId !== 'All' ? productStoreId : undefined;
      const countFetchers = Object.entries(queueCountFetchers);
      this.clearNavCounts(countFetchers.map(([key]) => key));
      await Promise.all(
        countFetchers.map(async ([key, fetchCount]) => {
          try {
            const count = await fetchCount(storeId);
            if (requestGeneration !== this.navCountPrimeRequestGeneration) return;

            this.setNavCount(key, count);
          } catch (error: any) {
            if (requestGeneration !== this.navCountPrimeRequestGeneration) return;

            logger.error(`Failed to prime the ${key} nav count`, error);
          }
        })
      );
    },
    async runSearch() {
      this.pageIndex = 0;
      const result = await this.fetchSearchPage(0);
      this.searchResults = result.orders;
      this.searchTotal = result.total;
      this.cacheOrders(result.orders);
    },
    async appendNextPage() {
      if (this.loading || !this.hasMore) return;

      const nextPageIndex = this.pageIndex + 1;
      const result = await this.fetchSearchPage(nextPageIndex);
      this.pageIndex = nextPageIndex;
      this.searchResults = [...this.searchResults, ...result.orders];
      this.searchTotal = result.total;
      this.cacheOrders(result.orders);
    },
    cacheOrders(orders: Order[]) {
      orders.forEach((order) => {
        this.cache[order.id] = order;
      });
    },
    async fetchSearchPage(pageIndex: number) {
      this.loading = true;
      this.error = '';

      try {
        return await searchOrderService(this.toSearchParams(pageIndex));
      } catch (error: any) {
        this.error = error?.message || 'Failed to search orders';
        return Promise.reject(error);
      } finally {
        this.loading = false;
      }
    },
    toSearchParams(pageIndex: number): OrderSearchParams {
      return {
        queryString: this.searchQuery,
        status: this.searchFilters.status,
        channel: this.searchFilters.channel,
        shipmentMethodTypeId: this.searchFilters.shipmentMethodTypeId,
        allocationState: this.searchFilters.allocationState,
        productStoreId: this.searchFilters.productStoreId,
        dateFrom: this.searchFilters.dateFrom,
        dateThru: this.searchFilters.dateThru,
        hasVirtualFacilityItems: this.searchFilters.hasVirtualFacilityItems,
        archivedOnly: this.searchFilters.archivedOnly,
        sort: this.searchSort,
        pageSize: this.pageSize,
        pageIndex,
      };
    },
    async loadWorkflowData() {
      if (!this.searchResults.length) await this.runSearch();
    },
    async searchOrders() {
      await this.runSearch();
    },
    async loadCustomerOrders(customerId: string) {
      return this.getCustomerOrders(customerId);
    },
    async loadCustomer(customerId: string) {
      return this.getCustomer(customerId);
    },
    async loadShipment(shipmentId: string) {
      return this.getShipment(shipmentId);
    },
    async loadReturn(returnId: string) {
      return this.getReturn(returnId);
    },
    async loadMoreWorkflowOrders(bucket: 'open' | 'inflight' | 'packed', filters: WorkflowFilters) {
      if (this.workflowOrdersLoading[bucket]) return;
      if (this.workflowOrders[bucket].length >= this.workflowOrdersTotal[bucket]) return;
      this.workflowOrdersLoading[bucket] = true;
      try {
        const nextPage = this.workflowOrdersPageIndex[bucket] + 1;
        const { orders, total } = await fetchWorkflowPage(bucket, filters, nextPage);
        await this.enrichWorkflowOrderPage(bucket, orders);
        this.workflowOrders[bucket] = [...this.workflowOrders[bucket], ...orders];
        this.workflowOrdersTotal[bucket] = total;
        this.workflowOrdersPageIndex[bucket] = nextPage;
      } catch (error: any) {
        logger.error(`Failed to load more ${bucket} orders`, error);
      } finally {
        this.workflowOrdersLoading[bucket] = false;
      }
    },
    async fetchWorkflowOrders(bucket: 'open' | 'inflight' | 'packed', filters: WorkflowFilters) {
      if (this.workflowOrdersLoading[bucket]) return;
      this.workflowOrdersLoading[bucket] = true;
      this.workflowOrders[bucket] = [];
      this.workflowOrdersTotal[bucket] = 0;
      this.workflowOrdersPageIndex[bucket] = 0;
      this.workflowOrderEnrichment[bucket] = {};
      try {
        const { orders, total } = await fetchWorkflowPage(bucket, filters, 0);
        await this.enrichWorkflowOrderPage(bucket, orders);
        this.workflowOrders[bucket] = orders;
        this.workflowOrdersTotal[bucket] = total;
        this.workflowOrdersPageIndex[bucket] = 0;
        this.setNavCount(bucket, total);
      } catch (error: any) {
        logger.error(`Failed to fetch ${bucket} orders`, error);
      } finally {
        this.workflowOrdersLoading[bucket] = false;
      }
    },
    async enrichWorkflowOrderPage(bucket: 'open' | 'inflight' | 'packed', orders: WorkflowOrder[]) {
      const orderIds = [...new Set(orders.map((order) => order.orderId).filter(Boolean))];
      if (!orderIds.length) return;
      try {
        const enrichment = await fetchOrderRowEnrichment(orderIds);
        this.workflowOrderEnrichment[bucket] = {
          ...this.workflowOrderEnrichment[bucket],
          ...enrichment
        };
      } catch (error: any) {
        logger.error(`Failed to enrich ${bucket} order rows`, error);
      }
    },
    async shipPackedWorkflowOrders(orderIds: string[]) {
      const selectedOrderIds = new Set(orderIds);
      const shipmentIds = [
        ...new Set(
          this.workflowOrders.packed
            .filter((order) => selectedOrderIds.has(order.orderId))
            .map((order) => order.shipmentId)
            .filter((shipmentId): shipmentId is string => !!shipmentId)
        )
      ];

      if (!shipmentIds.length) {
        throw new Error('No packed shipments found for selected orders.');
      }

      await api({
        url: 'poorti/shipments/bulkShip',
        method: 'POST',
        data: { shipmentIds }
      });
    },
  },
  persist: {
    omit: [
      'workflowOrders',
      'workflowOrdersLoading',
      'workflowOrdersTotal',
      'workflowOrdersPageIndex',
      'workflowOrderEnrichment'
    ]
  },
});
