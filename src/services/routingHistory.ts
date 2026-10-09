import { api } from "@common";

/** Routing changes are read newest first; an order with more than a page loses its oldest moves. */
const ROUTING_CHANGE_PAGE_SIZE = 200;
/** Unfillable rows can run into the thousands on one order, so only the latest ones are read. */
const UNFILLABLE_SAMPLE_SIZE = 50;
const MOVEMENT_PAGE_SIZE = 100;
const MOVEMENT_PAGE_LIMIT = 5;

export type ProductFacilityPair = { productId: string; facilityId: string };
export type LocationStock = { atp: number; qoh: number };

export const pairKey = (productId: string, facilityId: string) => `${productId}|${facilityId}`;

function numericValue(value: unknown) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsOf(response: any): any[] {
  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Every routing change on an order, oldest first: the moves the timeline already reads, plus the
 * latest unfillable attempts, which the timeline only counts.
 */
export async function fetchRoutingChanges(orderId: string): Promise<any[]> {
  const [moves, unfillable] = await Promise.all([
    api({
      url: `oms/orders/${orderId}/facilityChange`,
      method: "GET",
      params: {
        changeReasonEnumId: "UNFILLABLE",
        changeReasonEnumId_op: "in",
        changeReasonEnumId_not: "Y",
        orderByField: "-changeDatetime",
        pageSize: ROUTING_CHANGE_PAGE_SIZE
      }
    }),
    api({
      url: `oms/orders/${orderId}/facilityChange`,
      method: "GET",
      params: { changeReasonEnumId: "UNFILLABLE", orderByField: "-changeDatetime", pageSize: UNFILLABLE_SAMPLE_SIZE }
    })
  ]);

  return [...rowsOf(moves), ...rowsOf(unfillable)]
    .sort((a, b) => numericValue(a.changeDatetime) - numericValue(b.changeDatetime));
}

/** Available to promise and on hand for each product at each facility, summed over its inventory items. */
export async function fetchLocationStock(pairs: ProductFacilityPair[]): Promise<Record<string, LocationStock>> {
  if(!pairs.length) {return {};}
  const wanted = new Set(pairs.map((pair) => pairKey(pair.productId, pair.facilityId)));
  const productIds = [...new Set(pairs.map((pair) => pair.productId))];
  const facilityIds = [...new Set(pairs.map((pair) => pair.facilityId))];
  const response: any = await api({
    url: "oms/inventoryLogs",
    method: "GET",
    params: {
      productId: productIds.join(","),
      productId_op: "in",
      facilityId: facilityIds.join(","),
      facilityId_op: "in",
      pageSize: 500
    }
  });

  const stock: Record<string, LocationStock> = {};
  rowsOf(response).forEach((row: any) => {
    const key = pairKey(row.productId, row.facilityId);
    if(!wanted.has(key)) {return;}
    const entry = stock[key] || (stock[key] = { atp: 0, qoh: 0 });
    entry.atp += numericValue(row.availableToPromiseTotal);
    entry.qoh += numericValue(row.quantityOnHandTotal);
  });

  return stock;
}

/**
 * A product's stock movements at one facility, newest first, back to (and including) the last
 * movement before `sinceMillis`, so the stock at that moment can be read from it. Rows are ordered
 * by when they were recorded: external inventory resets carry no effective date.
 */
export async function fetchStockMovements(productId: string, facilityId: string, sinceMillis: number): Promise<{ rows: any[]; truncated: boolean }> {
  const rows: any[] = [];
  for(let pageIndex = 0; pageIndex < MOVEMENT_PAGE_LIMIT; pageIndex++) {
    const response: any = await api({
      url: `oms/products/${encodeURIComponent(productId)}/facilities/${encodeURIComponent(facilityId)}/inventoryDetail`,
      method: "GET",
      params: { orderByField: "-createdStamp", pageIndex, pageSize: MOVEMENT_PAGE_SIZE }
    });
    const page = rowsOf(response);
    rows.push(...page);
    const oldest = page.length ? numericValue(page[page.length - 1].createdStamp || page[page.length - 1].effectiveDate) : 0;
    if(page.length < MOVEMENT_PAGE_SIZE || (oldest && oldest < sinceMillis)) {return { rows, truncated: false };}
  }

  return { rows, truncated: true };
}
