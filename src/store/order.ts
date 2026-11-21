import { api, commonUtil, logger, translate, useSolrSearch } from '@common';
import { defineStore } from 'pinia';
import {
  buildActivePhysicalFacilityOrderVolumePayload,
  buildOrderLookupPayload,
  buildOrderRowEnrichmentPayload,
  buildUnfillableOrderDateTrendPayload,
  buildUnfillableProductCandidatesPayload,
  buildUnfillableShipGroupsForProductPayload,
  buildUnfillableTrendSpanPayload,
  buildVirtualLocationCountsPayload,
  EMPTY_UNFILLABLE_TREND,
  mergeSearchOrderEnrichment,
  normalizeActivePhysicalFacilityOrderVolume,
  normalizeOrderRowEnrichment,
  normalizeOrderSolrResponse,
  normalizeUnfillableProductCandidates,
  normalizeUnfillableShipGroups,
  normalizeUnfillableTrend,
  normalizeVirtualLocationCountResponse,
  UNFILLABLE_TREND_MAX_BUCKETS,
  unfillableTrendWindow,
  type ActiveFacilityOrderVolume,
  type OrderSearchParams,
  type UnfillableProductCandidate,
  type UnfillableShipGroup,
  type UnfillableTrend,
  type VirtualLocationCountParams,
  type VirtualLocationOrderCount,
  type WorkflowOrderBucket,
  type WorkflowOrderTotals
} from '@/utils/orderSearch';
import { toStringValue, toNumberValue, type OrderSearchResult } from '@/utils/orderDocs';
import type { Customer, Order, ReturnRecord, Shipment } from '@/types/order';
import type { WorkflowOrder, WorkflowFilters } from '@/types/customerService';
import { DEFAULT_WORKFLOW_ORDER_SORT, WORKFLOW_ORDER_SORT_ORDER_BY } from '@/types/customerService';
import type { OrderRowEnrichment } from '@/types/orderRow';
import { useProductStore } from './productStore';
import { buildBrokeringFacilityOptions, FALLBACK_BROKERING_FACILITY_IDS } from '@/utils/brokeringFacilities';

// Oldest first by default: Find orders is worked down, so the operator should land on
// the orders that have been waiting longest rather than on the freshest arrivals.
export const DEFAULT_ORDER_SEARCH_SORT = 'orderDate asc';

// Brokering is the one queue badge the Funnel's existing fetches cannot reproduce:
// its dashboard virtual-location counts are per-facility, but the /brokering page
// counts DISTINCT orders across the whole awaiting-brokering facility set (an order
// spanning two parking facilities is one row on the page, two in the per-facility
// sums). So we count it the same way the page does — one grouped solr query. Every
// other badge is published as a byproduct of the Funnel's own dashboard fetches
// (open/inflight/packed from the brokered workload; unfillable + the hold-task
// purposes from the customer-service store).
const BROKERING_STATUSES = ['ORDER_CREATED', 'ORDER_APPROVED'];

async function fetchWorkflowPage(
  bucket: 'open' | 'inflight' | 'packed',
  filters: WorkflowFilters,
  pageIndex: number
): Promise<{ orders: WorkflowOrder[]; total: number }> {
  const params: Record<string, any> = {
    pageSize: import.meta.env.VITE_VIEW_SIZE,
    pageIndex,
    orderByField: WORKFLOW_ORDER_SORT_ORDER_BY[filters.sort] ?? WORKFLOW_ORDER_SORT_ORDER_BY[DEFAULT_WORKFLOW_ORDER_SORT]
  };
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

  const orders = docs.map((doc: any) => {
    return {
      orderId: toStringValue(doc.orderId),
      orderName: toStringValue(doc.orderName),
      externalId: toStringValue(doc.externalId),
      statusId: toStringValue(doc.orderStatusId) || toStringValue(doc.statusId) || 'ORDER_APPROVED',
      orderDate: toStringValue(doc.orderDate),
      productStoreId: toStringValue(doc.productStoreId),
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
    searchSort: DEFAULT_ORDER_SEARCH_SORT,
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
    // A failed first page, so the view shows the error rather than an empty queue.
    workflowOrdersError: {
      open: '',
      inflight: '',
      packed: ''
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
    navCountRequestGeneration: 0
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
    /**
     * Prime the nav-badge counts that no Funnel dashboard fetch already produces —
     * currently only brokering, which needs a distinct-order count over the whole
     * awaiting-brokering facility set. unfillable + the hold-task purposes are
     * published by the customer-service store; open/inflight/packed by the Funnel's
     * brokered-workload fetch. Each count uses the same query its queue page uses.
     */
    async primeNavCounts(productStoreId?: string) {
      const requestId = ++this.navCountRequestGeneration;
      const storeId = productStoreId && productStoreId !== 'All' ? productStoreId : undefined;
      // Nav-badge key → count fetcher for badges not covered by a Funnel dashboard fetch.
      const queueCountFetchers: Record<string, () => Promise<number>> = {
        brokering: () => this.fetchBrokeringCount(storeId)
      };
      const results = await Promise.all(
        Object.entries(queueCountFetchers).map(async ([key, fetchCount]) => {
          try {
            return { key, total: await fetchCount() };
          } catch (error: any) {
            return { key, error };
          }
        })
      );
      if (requestId !== this.navCountRequestGeneration) return;
      results.forEach((result) => {
        if ('error' in result) {
          logger.error(`Failed to prime the ${result.key} nav count`, result.error);
        } else {
          this.setNavCount(result.key, result.total);
        }
      });
    },
    /** Creates an order in Shopify; the response carries `shopifyOrderId` and `shopifyOrderName`. */
    async createShopifyOrder(payload: Record<string, any>): Promise<any> {
      return api({
        url: 'oms/orders/shopify',
        method: 'post',
        data: payload
      });
    },
    /** Every virtual facility (parking locations and the like). */
    async fetchVirtualFacilities(): Promise<any[]> {
      const resp = await api({ url: 'admin/facilities', method: 'GET', params: { parentTypeId: 'VIRTUAL_FACILITY' } });
      return Array.isArray(resp.data) ? resp.data : [];
    },
    /** The virtual facilities, the brokering queue's facility vocabulary; none when the read fails. */
    async fetchBrokeringFacilities(): Promise<any[]> {
      return this.fetchVirtualFacilities().catch(() => []);
    },
    /** The default ("All") facility id set the brokering queue searches — every
     * virtual facility except the archive and unfillable parking, or the fallback
     * parking ids when none are configured. */
    async fetchBrokeringFacilityIds(): Promise<string[]> {
      const ids = buildBrokeringFacilityOptions(await this.fetchBrokeringFacilities()).map((option) => option.id);
      return ids.length ? ids : [...FALLBACK_BROKERING_FACILITY_IDS];
    },
    async fetchBrokeringCount(productStoreId?: string): Promise<number> {
      // Solr `total` reflects only the query filters (status/facility/store), not the
      // allocation enrichment, so a single-row page yields the /brokering page's exact
      // distinct-order count. Facility types only shape the rows, so none are needed.
      const result = await this.queryOrders({
        status: BROKERING_STATUSES,
        facilityIds: await this.fetchBrokeringFacilityIds(),
        productStoreId,
        pageSize: 1,
        pageIndex: 0
      }, []);
      return result.total ?? 0;
    },
    /**
     * One Solr page of orders. `facilityTypes` are the caller's facility type rows: the rows
     * are stamped with each facility's parent type, which tells virtual locations from physical.
     */
    async queryOrders(params: OrderSearchParams, facilityTypes: any[]): Promise<OrderSearchResult> {
      const response = await useSolrSearch().runSolrQuery(buildOrderLookupPayload(params));
      if (commonUtil.hasError(response)) return Promise.reject(response.data);

      const result = normalizeOrderSolrResponse(response.data, params.allocationSummary, facilityTypes);
      if (params.allocationSummary?.mode !== 'queue-first' || !result.orders.length) return result;

      const enrichment = await this.fetchOrderRowEnrichment(result.orders.map((order) => order.id), facilityTypes);
      return {
        ...result,
        orders: result.orders.map((order) => mergeSearchOrderEnrichment(order, enrichment[order.id], params.allocationSummary!))
      };
    },
    /** `facilityTypes` are the caller's facility type rows, as for queryOrders. */
    async fetchOrderRowEnrichment(orderIds: readonly string[], facilityTypes: any[]): Promise<Record<string, OrderRowEnrichment>> {
      const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
      if (!uniqueOrderIds.length) return {};
      const response = await useSolrSearch().runSolrQuery(buildOrderRowEnrichmentPayload(uniqueOrderIds));
      if (commonUtil.hasError(response)) return Promise.reject(response.data);
      return normalizeOrderRowEnrichment(response.data, facilityTypes);
    },
    async fetchWorkflowOrderTotals(productStoreId?: string): Promise<WorkflowOrderTotals> {
      const buckets: WorkflowOrderBucket[] = ['open', 'inflight', 'packed'];
      const totals = await Promise.all(buckets.map(async (bucket) => {
        const resp = await api({
          url: `oms/orders/salesOrders/${bucket}`,
          method: 'get',
          params: {
            pageSize: 1,
            pageIndex: 0,
            ...(productStoreId ? { productStoreId } : {})
          }
        });

        return [bucket, Number(resp.data?.ordersCount ?? 0)] as const;
      }));

      return Object.fromEntries(totals) as unknown as WorkflowOrderTotals;
    },
    async fetchActivePhysicalFacilityOrderVolume(params: { productStoreId?: string } = {}): Promise<ActiveFacilityOrderVolume[]> {
      const response = await useSolrSearch().runSolrQuery(buildActivePhysicalFacilityOrderVolumePayload(params));
      if (commonUtil.hasError(response)) return Promise.reject(response.data);
      return normalizeActivePhysicalFacilityOrderVolume(response.data);
    },
    async fetchVirtualLocationOrderCounts(params: VirtualLocationCountParams): Promise<VirtualLocationOrderCount[]> {
      if (!params.facilityIds.length) return [];
      const response = await useSolrSearch().runSolrQuery(buildVirtualLocationCountsPayload(params));
      if (commonUtil.hasError(response)) return Promise.reject(response.data);
      return normalizeVirtualLocationCountResponse(response.data);
    },
    async fetchUnfillableProductCandidates(productStoreId?: string, limit = 50): Promise<UnfillableProductCandidate[]> {
      const response = await useSolrSearch().runSolrQuery(buildUnfillableProductCandidatesPayload(productStoreId, limit));
      if (commonUtil.hasError(response)) return Promise.reject(response.data);
      return normalizeUnfillableProductCandidates(response.data);
    },
    async fetchUnfillableTrend(productStoreId?: string, timeZone?: string, maxBuckets = UNFILLABLE_TREND_MAX_BUCKETS): Promise<UnfillableTrend> {
      const solr = useSolrSearch();
      const zone = timeZone || undefined;

      const spanResponse = await solr.runSolrQuery(buildUnfillableTrendSpanPayload(productStoreId));
      if (commonUtil.hasError(spanResponse)) return Promise.reject(spanResponse.data);

      const window = unfillableTrendWindow(spanResponse.data, zone, maxBuckets);
      if (!window) return EMPTY_UNFILLABLE_TREND;

      const response = await solr.runSolrQuery(
        buildUnfillableOrderDateTrendPayload(productStoreId, window.start, window.end, window.gapDays)
      );
      if (commonUtil.hasError(response)) return Promise.reject(response.data);
      return normalizeUnfillableTrend(response.data, window.gapDays, zone);
    },
    async fetchUnfillableShipGroupsForProduct(productStoreId: string, productId: string): Promise<UnfillableShipGroup[]> {
      const response = await useSolrSearch().runSolrQuery(buildUnfillableShipGroupsForProductPayload(productStoreId, productId));
      if (commonUtil.hasError(response)) return Promise.reject(response.data);
      return normalizeUnfillableShipGroups(response.data);
    },
    /** `facilityTypes` are the caller's facility type rows, as for queryOrders. */
    async runSearch(facilityTypes: any[]) {
      this.pageIndex = 0;
      const result = await this.fetchSearchPage(0, facilityTypes);
      this.searchResults = result.orders;
      this.searchTotal = result.total;
      this.cacheOrders(result.orders);
    },
    async appendNextPage(facilityTypes: any[]) {
      if (this.loading || !this.hasMore) return;

      const nextPageIndex = this.pageIndex + 1;
      const result = await this.fetchSearchPage(nextPageIndex, facilityTypes);
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
    async fetchSearchPage(pageIndex: number, facilityTypes: any[]) {
      this.loading = true;
      this.error = '';

      try {
        return await this.queryOrders(this.toSearchParams(pageIndex), facilityTypes);
      } catch (error: any) {
        this.error = error?.message || translate('Failed to search orders');
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
    /** `facilityTypes` are the caller's facility type rows, as for queryOrders. */
    async loadMoreWorkflowOrders(bucket: 'open' | 'inflight' | 'packed', filters: WorkflowFilters, facilityTypes: any[]) {
      if (this.workflowOrdersLoading[bucket]) return;
      if (this.workflowOrders[bucket].length >= this.workflowOrdersTotal[bucket]) return;
      this.workflowOrdersLoading[bucket] = true;
      try {
        const nextPage = this.workflowOrdersPageIndex[bucket] + 1;
        const { orders, total } = await fetchWorkflowPage(bucket, filters, nextPage);
        await this.enrichWorkflowOrderPage(bucket, orders, facilityTypes);
        this.workflowOrders[bucket] = [...this.workflowOrders[bucket], ...orders];
        this.workflowOrdersTotal[bucket] = total;
        this.workflowOrdersPageIndex[bucket] = nextPage;
      } catch (error: any) {
        logger.error(`Failed to load more ${bucket} orders`, error);
      } finally {
        this.workflowOrdersLoading[bucket] = false;
      }
    },
    /** `facilityTypes` are the caller's facility type rows, as for queryOrders. */
    async fetchWorkflowOrders(bucket: 'open' | 'inflight' | 'packed', filters: WorkflowFilters, facilityTypes: any[]) {
      if (this.workflowOrdersLoading[bucket]) return;
      this.workflowOrdersLoading[bucket] = true;
      this.workflowOrdersError[bucket] = '';
      this.workflowOrders[bucket] = [];
      this.workflowOrdersTotal[bucket] = 0;
      this.workflowOrdersPageIndex[bucket] = 0;
      this.workflowOrderEnrichment[bucket] = {};
      try {
        const { orders, total } = await fetchWorkflowPage(bucket, filters, 0);
        await this.enrichWorkflowOrderPage(bucket, orders, facilityTypes);
        this.workflowOrders[bucket] = orders;
        this.workflowOrdersTotal[bucket] = total;
        this.workflowOrdersPageIndex[bucket] = 0;
        this.setNavCount(bucket, total);
      } catch (error: any) {
        logger.error(`Failed to fetch ${bucket} orders`, error);
        this.workflowOrdersError[bucket] = error?.message || translate('Failed to search orders');
      } finally {
        this.workflowOrdersLoading[bucket] = false;
      }
    },
    async enrichWorkflowOrderPage(bucket: 'open' | 'inflight' | 'packed', orders: WorkflowOrder[], facilityTypes: any[]) {
      const orderIds = [...new Set(orders.map((order) => order.orderId).filter(Boolean))];
      if (!orderIds.length) return;
      try {
        const enrichment = await this.fetchOrderRowEnrichment(orderIds, facilityTypes);
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
      'workflowOrderEnrichment',
      'navCountRequestGeneration'
    ]
  },
});
