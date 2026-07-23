import { searchOrders } from '@/services/order';
import { fetchBrokeringFacilityIds } from '@/utils/brokeringFacilities';

// Brokering is the one queue badge the Funnel's existing fetches cannot reproduce:
// its dashboard virtual-location counts are per-facility, but the /brokering page
// counts DISTINCT orders across the whole awaiting-brokering facility set (an order
// spanning two parking facilities is one row on the page, two in the per-facility
// sums). So we count it the same way the page does — one grouped solr query. Every
// other badge is published as a byproduct of the Funnel's own dashboard fetches
// (open/inflight/packed from the brokered workload; unfillable + the hold-task
// purposes from the customer-service store).

const BROKERING_STATUSES = ['ORDER_CREATED', 'ORDER_APPROVED'];

export async function fetchBrokeringCount(productStoreId?: string): Promise<number> {
  // Solr `total` reflects only the query filters (status/facility/store), not the
  // allocation enrichment, so a single-row page yields the /brokering page's exact
  // distinct-order count.
  const result = await searchOrders({
    status: BROKERING_STATUSES,
    facilityIds: await fetchBrokeringFacilityIds(),
    productStoreId,
    pageSize: 1,
    pageIndex: 0
  });
  return result.total ?? 0;
}

/** Nav-badge key → count fetcher for badges not covered by a Funnel dashboard
 * fetch. Only brokering needs a dedicated query. */
export const queueCountFetchers: Record<string, (productStoreId?: string) => Promise<number>> = {
  brokering: fetchBrokeringCount
};
