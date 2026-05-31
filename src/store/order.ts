import { defineStore } from 'pinia';
import {
  searchOrders as searchOrderService,
  type OrderSearchParams
} from '@/services/order';
import type { Customer, Order, ReturnRecord, Shipment } from '@/types/order';

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
  },
  persist: true,
});
