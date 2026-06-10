import { api } from '@common';
import { defineStore } from 'pinia';
import {
  searchOrders as searchOrderService,
  type OrderSearchParams
} from '@/services/order';
import { allDocs, toStringValue, toNumberValue } from '@/services/OrderService';
import type { Customer, Order, ReturnRecord, Shipment } from '@/types/order';
import type { WorkflowOrder, WorkflowFilters } from '@/types/customerService';
import { useSeedStore } from '@/store/seed';
import logger from '@/logger';


async function fetchWorkflowPage(
  bucket: 'open' | 'inflight' | 'packed',
  filters: WorkflowFilters,
  pageIndex: number
): Promise<{ orders: WorkflowOrder[]; total: number }> {
  const params: Record<string, any> = { bucket, pageSize: import.meta.env.VITE_VIEW_SIZE, pageIndex };
  if (filters.query) params.keyword = filters.query;
  if (filters.customerName) params.customerName = filters.customerName;
  if (filters.salesChannelEnumId && filters.salesChannelEnumId !== 'All') params.salesChannelEnumId = filters.salesChannelEnumId;
  if (filters.facilityId && filters.facilityId !== 'All') params.facilityId = filters.facilityId;
  if (filters.shipmentMethodTypeId && filters.shipmentMethodTypeId !== 'All') params.shipmentMethodTypeId = filters.shipmentMethodTypeId;
  if (filters.productStoreId && filters.productStoreId !== 'All') params.productStoreId = filters.productStoreId;
  if (filters.priority !== null) params.priority = filters.priority;
  if (filters.dateFrom) params.orderDateFrom = `${filters.dateFrom} 00:00:00`;
  if (filters.dateThru) params.orderDateThru = `${filters.dateThru} 23:59:59`;

  const resp = await api({ url: 'oms/orders/salesOrders', method: 'get', params });
  const docs: any[] = resp.data?.orders || [];
  const total: number = resp.data?.ordersCount ?? docs.length;

  const seedStore = useSeedStore();
  const orders = docs.map((doc: any) => {
    return {
      orderId: toStringValue(doc.orderId),
      orderName: toStringValue(doc.orderName),
      externalId: toStringValue(doc.externalId),
      statusId: 'ORDER_APPROVED',
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
      shippingMethodTypeId: toStringValue(doc.shipmentMethodTypeId),
      shipmentMethodDesc: (() => { const m = seedStore.shipmentMethodTypes.byId[toStringValue(doc.shipmentMethodTypeId)]; return m?.description || toStringValue(doc.shipmentMethodTypeId); })(),
      priority: toStringValue(doc.priority) === 'Y' ? 'HIGH' as const : 'NORMAL' as const,
      facilityId: toStringValue(doc.facilityId) || null,
      facilityName: toStringValue(doc.facilityName) || null,
      brokeringDate: null,
      picklistBinId: null,
      pickedDate: null,
      receivedAtFacility: false,
      shipBeforeDate: null,
      bucket
    } satisfies WorkflowOrder;
  });

  return { orders, total };
}

export interface OrderSearchFilters {
  status: string[];
  channel: string;
  productStoreId: string;
  dateFrom: string;
  dateThru: string;
}

export const useOrderStore = defineStore('orders', {
  state: () => ({
    searchQuery: '',
    searchFilters: {
      status: [],
      channel: 'All',
      productStoreId: 'All',
      dateFrom: '',
      dateThru: '',
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
  },
  actions: {
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
        productStoreId: this.searchFilters.productStoreId,
        dateFrom: this.searchFilters.dateFrom,
        dateThru: this.searchFilters.dateThru,
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
      try {
        const { orders, total } = await fetchWorkflowPage(bucket, filters, 0);
        this.workflowOrders[bucket] = orders;
        this.workflowOrdersTotal[bucket] = total;
        this.workflowOrdersPageIndex[bucket] = 0;
      } catch (error: any) {
        logger.error(`Failed to fetch ${bucket} orders`, error);
      } finally {
        this.workflowOrdersLoading[bucket] = false;
      }
    },
  },
  persist: true,
});
