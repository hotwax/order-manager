import { defineStore } from "pinia";
import { getPartyNames } from "@/services/customer";
import { fetchOrderRowEnrichment } from "@/services/order";
import { getReturn, listReturns, toReturnSummary } from "@/services/returns";
import type { ReturnDetail, ReturnListQuery, ReturnSummary, ReturnsQueryState } from "@/types/returns";

const DEFAULT_PAGE_SIZE = 25;

function defaultQuery(): ReturnsQueryState {
  return {
    searchField: "RETURN_ID",
    searchTerm: "",
    statusId: "",
    returnHeaderTypeId: "",
    returnChannelEnumId: ""
  };
}

function normalizedExactId(value: string): string {
  return value.trim().replace(/^RMA\s*#?/i, "");
}

function matchesFilters(detail: ReturnDetail, query: ReturnsQueryState): boolean {
  return (!query.statusId || detail.statusId === query.statusId) &&
    (!query.returnHeaderTypeId || detail.returnHeaderTypeId === query.returnHeaderTypeId) &&
    (!query.returnChannelEnumId || detail.returnChannelEnumId === query.returnChannelEnumId);
}

async function loadReturnNameEnrichment(items: ReturnSummary[], additionalOrderIds: string[] = []) {
  const orderIds = [...new Set([
    ...items.map((item) => item.orderId),
    ...additionalOrderIds
  ].filter((orderId): orderId is string => Boolean(orderId)))];
  const partyIds = [...new Set(items.map((item) => item.fromPartyId).filter((partyId): partyId is string => Boolean(partyId)))];
  const [ordersById, parties] = await Promise.all([
    fetchOrderRowEnrichment(orderIds).catch(() => ({})),
    getPartyNames(partyIds).catch(() => [])
  ]);

  return {
    ordersById,
    partyNamesById: Object.fromEntries(parties.map((party) => [party.partyId, party.name]))
  };
}

function applyReturnSummaryEnrichment(
  item: ReturnSummary,
  names: Awaited<ReturnType<typeof loadReturnNameEnrichment>>
): ReturnSummary {
  return {
    ...item,
    orderName: (item.orderId && names.ordersById[item.orderId]?.orderName) || item.orderName,
    customerName: (item.fromPartyId && names.partyNamesById[item.fromPartyId]) || item.customerName
  };
}

async function enrichReturnSummaries(items: ReturnSummary[]): Promise<ReturnSummary[]> {
  const names = await loadReturnNameEnrichment(items);

  return items.map((item) => applyReturnSummaryEnrichment(item, names));
}

async function enrichReturnDetail(detail: ReturnDetail): Promise<ReturnDetail> {
  const itemOrderIds = detail.items.map((item) => item.orderId).filter((orderId): orderId is string => Boolean(orderId));
  const names = await loadReturnNameEnrichment([detail], itemOrderIds);
  const summary = applyReturnSummaryEnrichment(detail, names);

  return {
    ...detail,
    ...summary,
    items: detail.items.map((item) => ({
      ...item,
      orderName: (item.orderId && names.ordersById[item.orderId]?.orderName) || item.orderName
    }))
  };
}

export const useReturnsStore = defineStore("returns", {
  state: () => ({
    returns: [] as ReturnSummary[],
    total: 0,
    current: undefined as ReturnDetail | undefined,
    query: defaultQuery(),
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    loading: false,
    detailLoading: false,
    error: "",
    detailError: "",
    lastPageFull: false,
    requestSequence: 0
  }),
  getters: {
    // `total` cannot be trusted as the full match count: the OMS list service reports
    // `returnsCount` as the size of the page it just returned (list#CustomerReturns derives it
    // from `returns.size()`, because an entity-find with a limit never populates
    // returnListCount). Paging past the first page works fine, so a page that came back full
    // is also treated as "there may be more" - otherwise every return after the first page is
    // unreachable. Remove the lastPageFull arm once the service returns a real total.
    hasMore: (state) => state.returns.length < state.total || state.lastPageFull,
    isExactReturnSearch: (state) => state.query.searchField === "RETURN_ID" && Boolean(normalizedExactId(state.query.searchTerm))
  },
  actions: {
    async search() {
      const requestId = ++this.requestSequence;
      this.loading = true;
      this.error = "";
      this.pageIndex = 0;
      try {
        const term = normalizedExactId(this.query.searchTerm);
        if(this.query.searchField === "RETURN_ID" && term) {
          const detail = await getReturn(term);
          if(requestId !== this.requestSequence) {return;}
          const summaries = matchesFilters(detail, this.query) ? [toReturnSummary(detail)] : [];
          const enrichedSummaries = await enrichReturnSummaries(summaries);
          if(requestId !== this.requestSequence) {return;}
          this.returns = enrichedSummaries;
          this.total = this.returns.length;
          this.lastPageFull = false;

          return;
        }
        const result = await listReturns(this.buildListQuery(0));
        if(requestId !== this.requestSequence) {return;}
        const enrichedSummaries = await enrichReturnSummaries(result.items);
        if(requestId !== this.requestSequence) {return;}
        this.returns = enrichedSummaries;
        this.total = result.total;
        this.lastPageFull = result.items.length >= this.pageSize;
      } catch (error: any) {
        if(requestId !== this.requestSequence) {return;}
        this.returns = [];
        this.total = 0;
        this.lastPageFull = false;
        if(error?.response?.status === 404 && this.query.searchField === "RETURN_ID") {return;}
        this.error = error?.message || "Failed to find returns";
      } finally {
        if(requestId === this.requestSequence) {this.loading = false;}
      }
    },
    buildListQuery(pageIndex: number): ReturnListQuery {
      const term = this.query.searchTerm.trim();

      return {
        pageIndex,
        pageSize: this.pageSize,
        statusId: this.query.statusId || undefined,
        returnHeaderTypeId: this.query.returnHeaderTypeId || undefined,
        returnChannelEnumId: this.query.returnChannelEnumId || undefined,
        orderId: this.query.searchField === "ORDER_ID" && term ? term : undefined,
        fromPartyId: this.query.searchField === "CUSTOMER_ID" && term ? term : undefined
      };
    },
    async loadMore() {
      if(this.loading || !this.hasMore || this.isExactReturnSearch) {return;}
      const requestId = this.requestSequence;
      const nextPage = this.pageIndex + 1;
      this.loading = true;
      this.error = "";
      try {
        const result = await listReturns(this.buildListQuery(nextPage));
        if(requestId !== this.requestSequence) {return;}
        const enrichedItems = await enrichReturnSummaries(result.items);
        if(requestId !== this.requestSequence) {return;}
        const knownIds = new Set(this.returns.map((item) => item.returnId));
        this.returns = [...this.returns, ...enrichedItems.filter((item) => !knownIds.has(item.returnId))];
        this.total = result.total;
        this.lastPageFull = result.items.length >= this.pageSize;
        this.pageIndex = nextPage;
      } catch (error: any) {
        if(requestId !== this.requestSequence) {return;}
        this.lastPageFull = false;
        this.error = error?.message || "Failed to load more returns";
      } finally {
        if(requestId === this.requestSequence) {this.loading = false;}
      }
    },
    async loadReturn(returnId: string) {
      this.detailLoading = true;
      this.detailError = "";
      this.current = undefined;
      try {
        const detail = await getReturn(returnId);
        this.current = await enrichReturnDetail(detail);
      } catch (error: any) {
        this.detailError = error?.message || "Failed to load return";
      } finally {
        this.detailLoading = false;
      }
    },
    clearFilters() {
      this.query = defaultQuery();

      return this.search();
    }
  }
});
