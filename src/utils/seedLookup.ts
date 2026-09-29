/**
 * Synchronous seed lookups over reference rows already read from the local database.
 *
 * Seed data is read per call from IndexedDB (`useSeedData`), which is async. The order page is
 * the one place that can't wait on a read: its view model is built inside a store getter
 * (`enrichedOrderByOrderId`) and re-derives on every change. So the order detail store reads the
 * tables it needs once per order load (`readSeedLookupRows`) and builds this lookup over them.
 * A pure module, no Vue or Pinia, so stores, utils and components can all take it.
 *
 * Label fallbacks match `useSeedData`: a missing row answers with the raw id.
 */

type Row = Record<string, any>;

/** Every table the lookup reads, by its local database table name. */
export const SEED_LOOKUP_TABLES = [
  "facilities",
  "facilityTypes",
  "statuses",
  "enums",
  "geos",
  "shipmentMethodTypes",
  "carrierShipmentMethods",
  "paymentMethodTypes",
  "productStores",
  "orderAdjustmentTypes",
  "statusFlowTransitions",
  "shopifyShops",
  "contactMechPurposeTypes",
  "roleTypes",
  "communicationEventTypes",
  "returnReasons",
  "returnTypes",
  "returnItemTypes",
  "partyRelationshipTypes",
] as const;

export type SeedLookupTable = typeof SEED_LOOKUP_TABLES[number];
export type SeedLookupRows = Partial<Record<SeedLookupTable, Row[]>>;

const KEY_FIELDS: Record<SeedLookupTable, string> = {
  facilities: "facilityId",
  facilityTypes: "facilityTypeId",
  statuses: "statusId",
  enums: "enumId",
  geos: "geoId",
  shipmentMethodTypes: "shipmentMethodTypeId",
  carrierShipmentMethods: "shipmentMethodTypeId",
  paymentMethodTypes: "paymentMethodTypeId",
  productStores: "productStoreId",
  orderAdjustmentTypes: "orderAdjustmentTypeId",
  statusFlowTransitions: "statusId",
  shopifyShops: "shopId",
  contactMechPurposeTypes: "contactMechPurposeTypeId",
  roleTypes: "roleTypeId",
  communicationEventTypes: "communicationEventTypeId",
  returnReasons: "returnReasonId",
  returnTypes: "returnTypeId",
  returnItemTypes: "returnItemTypeId",
  partyRelationshipTypes: "partyRelationshipTypeId",
};

/** Tables `describe()` falls back through after statuses and enums, in this order. */
const DESCRIBE_TABLES: SeedLookupTable[] = [
  "contactMechPurposeTypes", "roleTypes", "paymentMethodTypes", "communicationEventTypes",
  "returnReasons", "returnTypes", "returnItemTypes", "orderAdjustmentTypes",
  "shipmentMethodTypes", "facilityTypes", "partyRelationshipTypes",
];

const DEFAULT_LABEL_FIELDS = ["description", "enumName", "name"];

function labelOf(record: Row | undefined, id: string, fields = DEFAULT_LABEL_FIELDS): string {
  return (fields.map((field) => record?.[field]).find(Boolean) as string) || id;
}

const byGeoName = (left: Row, right: Row) => (left.geoName || "").localeCompare(right.geoName || "");

/**
 * @param rows   the tables as read; a missing table reads as empty
 * @param ready  whether the read has finished (successfully or not), so callers that must not
 *               guess — such as the timeline deciding whether a facility is parking — can wait
 */
export function buildSeedLookup(rows: SeedLookupRows = {}, ready = false) {
  const indexes = {} as Record<SeedLookupTable, Map<string, Row>>;
  const index = (table: SeedLookupTable) => {
    if (!indexes[table]) indexes[table] = new Map((rows[table] || []).map((record) => [record[KEY_FIELDS[table]], record]));
    return indexes[table];
  };
  const get = (table: SeedLookupTable, id: string) => (id ? index(table).get(id) : undefined);

  const facility = (facilityId: string) => get("facilities", facilityId);
  const facilityType = (facilityTypeId: string) => get("facilityTypes", facilityTypeId);
  const statusDescription = (statusId: string) => labelOf(get("statuses", statusId), statusId);
  const enumDescription = (enumId: string) => labelOf(get("enums", enumId), enumId);

  const geos = rows.geos || [];

  return {
    ready,
    facility,
    facilityType,
    facilityName: (facilityId: string) => labelOf(facility(facilityId), facilityId, ["facilityName", "facilityId"]),
    statusDescription,
    enumDescription,
    /** A status, enum or type id, described by whichever table knows it. */
    describe(id: string): string {
      if (!id) return "";
      const known = get("statuses", id) || get("enums", id)
        || DESCRIBE_TABLES.map((table) => get(table, id)).find(Boolean);
      return labelOf(known, id);
    },
    geoName: (geoId: string) => labelOf(get("geos", geoId), geoId, ["geoName"]),
    countries: geos.filter((geo) => geo.geoTypeEnumId === "GEOT_COUNTRY").sort(byGeoName),
    states: geos.filter((geo) => geo.geoTypeEnumId === "GEOT_STATE" || geo.geoTypeEnumId === "GEOT_PROVINCE").sort(byGeoName),
    shipmentMethodDescription: (shipmentMethodTypeId: string) =>
      labelOf(get("shipmentMethodTypes", shipmentMethodTypeId), shipmentMethodTypeId, ["description", "shipmentMethodTypeId"]),
    shippingMethodsByCarrier: (carrierPartyId: string) =>
      carrierPartyId ? (rows.carrierShipmentMethods || []).filter((method) => method.partyId === carrierPartyId) : [],
    paymentMethodDescription: (paymentMethodTypeId: string) => labelOf(get("paymentMethodTypes", paymentMethodTypeId), paymentMethodTypeId),
    productStoreName: (productStoreId: string) => labelOf(get("productStores", productStoreId), productStoreId, ["storeName", "companyName"]),
    orderAdjustmentTypeDescription: (orderAdjustmentTypeId: string) =>
      labelOf(get("orderAdjustmentTypes", orderAdjustmentTypeId), orderAdjustmentTypeId),
    orderIdentificationTypeDescription: enumDescription,
    shopifyShops: rows.shopifyShops || [],
    /** The status flow's transitions out of `statusId`, in their authored sequence. */
    allowedTransitions: (statusId: string) => (rows.statusFlowTransitions || [])
      .filter((transition) => transition.statusId === statusId)
      .map((transition) => ({ ...transition, toStatusDescription: statusDescription(transition.toStatusId) }))
      .sort((left, right) => {
        const leftSequence = left.transitionSequence ?? Number.MAX_SAFE_INTEGER;
        const rightSequence = right.transitionSequence ?? Number.MAX_SAFE_INTEGER;
        if (leftSequence !== rightSequence) return leftSequence - rightSequence;
        return (left.toStatusId || "").localeCompare(right.toStatusId || "");
      }),
  };
}

export type SeedLookup = ReturnType<typeof buildSeedLookup>;

/** Read every lookup table, each degrading to empty so one bad table never blanks the page. */
export async function readSeedLookupRows(readTable: (table: string) => Promise<Row[]>): Promise<SeedLookupRows> {
  const tables = await Promise.all(SEED_LOOKUP_TABLES.map((table) => readTable(table).catch(() => [] as Row[])));
  return Object.fromEntries(SEED_LOOKUP_TABLES.map((table, position) => [table, tables[position]]));
}
