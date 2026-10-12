import { api } from "@common";
import { toMillis } from "@/utils/format";

/** Routing changes are read newest first; an order with more than a page loses its oldest moves. */
const ROUTING_CHANGE_PAGE_SIZE = 200;
/** Unfillable rows can run into the thousands on one order, so only the latest ones are read. */
const UNFILLABLE_SAMPLE_SIZE = 50;
const MOVEMENT_PAGE_SIZE = 100;
const MOVEMENT_PAGE_LIMIT = 5;
const STOCK_PAGE_SIZE = 500;
/** A guard against an endpoint that ignores pageIndex; 20 pages is far beyond one order. */
const STOCK_PAGE_LIMIT = 20;

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
    .sort((a, b) => (toMillis(a.changeDatetime) ?? 0) - (toMillis(b.changeDatetime) ?? 0));
}

/**
 * When the store went live on HotWax inventory: its Shopify shop's newOrderSync.launchDate, the same
 * cut-over the OMS reads. A line fulfilled before it arrives complete and never issues, because its stock
 * left while the old system was authoritative. Null when the store maps to no shop or to several (two
 * shops mean two go-lives, and the OMS resolves none either), or the date is not set.
 *
 * The stored value is a wall clock in the server's zone; it is read in the app's zone, which is close
 * enough to tell an item fulfilled before launch from one fulfilled after.
 */
export async function fetchInventoryCutoff(productStoreId: string): Promise<number | null> {
  const shops = rowsOf(await api({ url: "oms/shopifyShops/shops", method: "GET", params: { productStoreId, pageSize: 2 } }));
  if(shops.length !== 1) {return null;}
  const response: any = await api({
    url: "admin/systemProperties",
    method: "GET",
    params: { systemResourceId: shops[0].shopId, systemPropertyId: "newOrderSync.launchDate", pageSize: 1 }
  });
  const properties = rowsOf(response).length ? rowsOf(response) : response?.data?.systemPropertyList || [];

  return toMillis(properties[0]?.systemPropertyValue) ?? null;
}

/** Available to promise and on hand for each product at each facility, summed over its inventory items. */
export async function fetchLocationStock(pairs: ProductFacilityPair[]): Promise<Record<string, LocationStock>> {
  if(!pairs.length) {return {};}
  const wanted = new Set(pairs.map((pair) => pairKey(pair.productId, pair.facilityId)));
  const productIds = [...new Set(pairs.map((pair) => pair.productId))];
  const facilityIds = [...new Set(pairs.map((pair) => pair.facilityId))];
  // A product can sit in many inventory items at one facility, so read every page before summing.
  const rows: any[] = [];
  for(let pageIndex = 0; pageIndex < STOCK_PAGE_LIMIT; pageIndex++) {
    const response: any = await api({
      url: "oms/inventoryLogs",
      method: "GET",
      params: {
        productId: productIds.join(","),
        productId_op: "in",
        facilityId: facilityIds.join(","),
        facilityId_op: "in",
        pageIndex,
        pageSize: STOCK_PAGE_SIZE
      }
    });
    const page = rowsOf(response);
    rows.push(...page);
    if(page.length < STOCK_PAGE_SIZE) {break;}
  }

  const stock: Record<string, LocationStock> = {};
  rows.forEach((row: any) => {
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
    const last = page[page.length - 1];
    const oldest = last ? toMillis(last.createdStamp) ?? toMillis(last.effectiveDate) ?? 0 : 0;
    if(page.length < MOVEMENT_PAGE_SIZE || (oldest && oldest < sinceMillis)) {return { rows, truncated: false };}
  }

  return { rows, truncated: true };
}
