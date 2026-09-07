/**
 * Pure lookup helpers over rows read from the local database.
 *
 * Every function here is stateless: it takes the rows it needs and returns a value. There is
 * no cache, no subscription and no lifecycle — reading and caching belong to `useDb` (per
 * component, via `useSeedTable`) or to `seedRows()` (promise-based, for stores and
 * services). That keeps this module trivially testable and impossible to leave stale.
 *
 * Every id-to-label helper falls back to the raw id, matching what the UI showed before this
 * layer existed.
 */

export type Row = Record<string, any>;

// ── Generic primitives ────────────────────────────────────────────────────────────────

/** First row whose `keyField` equals `id`. */
export function rowById(rows: Row[], keyField: string, id: string): Row | undefined {
  if(!id) {return undefined;}

  return rows.find((row) => row[keyField] === id);
}

/** First non-empty value among `fields`, else the raw id. */
export function labelFor(row: Row | undefined, id: string, fields = ["description", "enumName", "name"]): string {
  const value = fields.map((field) => row?.[field]).find(Boolean);

  return (value as string) || id;
}

/** Look up by key field and label in one step — the shape most getters below need. */
function describeBy(rows: Row[], keyField: string, id: string, fields?: string[]): string {
  return labelFor(rowById(rows, keyField, id), id, fields);
}

// ── Statuses ──────────────────────────────────────────────────────────────────────────

export const status = (statuses: Row[], statusId: string) => rowById(statuses, "statusId", statusId);
export const statusDescription = (statuses: Row[], statusId: string) => describeBy(statuses, "statusId", statusId);
export const statusAge = (statuses: Row[], statusId: string): number =>
  Number(status(statuses, statusId)?.statusAge ?? 0);

export const getStatusItemsByType = (statuses: Row[], statusTypeId: string): Row[] =>
  statuses.filter((row) => row.statusTypeId === statusTypeId);

// ── Enums ─────────────────────────────────────────────────────────────────────────────

export const enumDescription = (enums: Row[], enumId: string) => describeBy(enums, "enumId", enumId);

export const getEnumsByType = (enums: Row[], enumTypeId: string): Row[] =>
  enums.filter((row) => row.enumTypeId === enumTypeId);

/** Enums belonging to any child type of `parentTypeId`. */
export function getEnumsByParentType(enums: Row[], enumTypes: Row[], parentTypeId: string): Row[] {
  const childTypeIds = new Set(enumTypes.filter((type) => type.parentTypeId === parentTypeId).map((type) => type.enumTypeId),);

  return enums.filter((row) => childTypeIds.has(row.enumTypeId));
}

export const orderIdentificationTypeDescription = (enums: Row[], enumId: string) =>
  describeBy(enums, "enumId", enumId);

export const orderIdentificationTypeOptions = (enums: Row[]): Array<{ enumId: string; description: string }> =>
  getEnumsByType(enums, "ORDER_IDENTITY").map((row) => ({
    enumId: row.enumId,
    description: labelFor(row, row.enumId),
  }));

// ── Product stores ────────────────────────────────────────────────────────────────────

export const productStore = (productStores: Row[], productStoreId: string) =>
  rowById(productStores, "productStoreId", productStoreId);

export const productStoreName = (productStores: Row[], productStoreId: string) =>
  describeBy(productStores, "productStoreId", productStoreId, ["storeName", "companyName"]);

export const productStoreFacilities = (rows: Row[], productStoreId: string): Row[] =>
  rows.filter((row) => row.productStoreId === productStoreId);

// ── Facilities ────────────────────────────────────────────────────────────────────────

export const facility = (facilities: Row[], facilityId: string) => rowById(facilities, "facilityId", facilityId);

export const facilityName = (facilities: Row[], facilityId: string) =>
  describeBy(facilities, "facilityId", facilityId, ["facilityName", "facilityId"]);

export const facilityType = (facilityTypes: Row[], facilityTypeId: string) =>
  rowById(facilityTypes, "facilityTypeId", facilityTypeId);

// ── Carriers and shipment methods ─────────────────────────────────────────────────────

const carrierLabel = (carrier: Row) =>
  [carrier.firstName, carrier.lastName].filter(Boolean).join(" ") || carrier.groupName || carrier.partyId;

export const carrier = (carriers: Row[], partyId: string) => rowById(carriers, "partyId", partyId);

export function carrierName(carriers: Row[], partyId: string): string {
  const row = carrier(carriers, partyId);

  return row ? carrierLabel(row) : partyId;
}

export const shipmentMethod = (shipmentMethodTypes: Row[], id: string) =>
  rowById(shipmentMethodTypes, "shipmentMethodTypeId", id);

export const shipmentMethodDescription = (shipmentMethodTypes: Row[], id: string) =>
  describeBy(shipmentMethodTypes, "shipmentMethodTypeId", id, ["description", "shipmentMethodTypeId"]);

export const getShipmentMethodOptions = (shipmentMethodTypes: Row[]): Array<{ id: string; label: string }> =>
  shipmentMethodTypes.map((row) => ({
    id: row.shipmentMethodTypeId,
    label: labelFor(row, row.shipmentMethodTypeId, ["description", "shipmentMethodTypeId"]),
  }));

export const shippingMethodsByCarrier = (carrierShipmentMethods: Row[], carrierPartyId: string): Row[] =>
  carrierPartyId ? carrierShipmentMethods.filter((row) => row.partyId === carrierPartyId) : [];

// ── Simple type lookups ───────────────────────────────────────────────────────────────

export const paymentMethodDescription = (rows: Row[], id: string) =>
  describeBy(rows, "paymentMethodTypeId", id);

export const returnReasonDescription = (rows: Row[], id: string) => describeBy(rows, "returnReasonId", id);
export const returnTypeDescription = (rows: Row[], id: string) => describeBy(rows, "returnTypeId", id);
export const returnItemTypeDescription = (rows: Row[], id: string) => describeBy(rows, "returnItemTypeId", id);
export const roleTypeDescription = (rows: Row[], id: string) => describeBy(rows, "roleTypeId", id);
export const orderAdjustmentTypeDescription = (rows: Row[], id: string) =>
  describeBy(rows, "orderAdjustmentTypeId", id);
export const contactPurposeDescription = (rows: Row[], id: string) =>
  describeBy(rows, "contactMechPurposeTypeId", id);
export const communicationEventTypeDescription = (rows: Row[], id: string) =>
  describeBy(rows, "communicationEventTypeId", id);
export const partyRelationshipDescription = (rows: Row[], id: string) =>
  describeBy(rows, "partyRelationshipTypeId", id, ["description", "partyRelationshipName"]);

// ── Shopify ───────────────────────────────────────────────────────────────────────────

export const shopifyShop = (shops: Row[], shopId: string) => rowById(shops, "shopId", shopId);

// ── Geography ─────────────────────────────────────────────────────────────────────────

const byGeoName = (left: Row, right: Row) => (left.geoName || "").localeCompare(right.geoName || "");

export const geoName = (geos: Row[], geoId: string) => describeBy(geos, "geoId", geoId, ["geoName"]);

export function getGeoIdByCode(geos: Row[], code: string): string {
  if(!code) {return "";}

  return geos.find((geo) => geo.geoCodeAlpha2 === code || geo.geoCode === code)?.geoId ?? "";
}

export const getCountries = (geos: Row[]): Row[] =>
  geos.filter((geo) => geo.geoTypeEnumId === "GEOT_COUNTRY").sort(byGeoName);

export const getStates = (geos: Row[]): Row[] =>
  geos
    .filter((geo) => geo.geoTypeEnumId === "GEOT_STATE" || geo.geoTypeEnumId === "GEOT_PROVINCE")
    .sort(byGeoName);

export function getStatesForCountry(geos: Row[], geoAssocs: Row[], countryGeoId: string): Row[] {
  if(!countryGeoId) {return [];}

  const stateIds = new Set(geoAssocs.filter((assoc) => assoc.geoId === countryGeoId).map((assoc) => assoc.toGeoId),);

  return geos.filter((geo) => stateIds.has(geo.geoId)).sort(byGeoName);
}

// ── Status flow ───────────────────────────────────────────────────────────────────────

/**
 * Transitions out of `statusId`, each decorated with the destination's label and colour.
 * `statusColor` is injected rather than imported so this module stays free of `@common`.
 */
export function allowedTransitions(
  transitions: Row[],
  statuses: Row[],
  statusId: string,
  statusColor: (description: string) => string,
) {
  return transitions
    .filter((transition) => transition.statusId === statusId)
    .map((transition) => {
      const toStatusDescription = statusDescription(statuses, transition.toStatusId);

      return { ...transition, toStatusDescription, toStatusColor: statusColor(toStatusDescription) };
    })
    .sort((left, right) => {
      const leftSequence = left.transitionSequence ?? Number.MAX_SAFE_INTEGER;
      const rightSequence = right.transitionSequence ?? Number.MAX_SAFE_INTEGER;
      if(leftSequence !== rightSequence) {return leftSequence - rightSequence;}

      return (left.toStatusId || "").localeCompare(right.toStatusId || "");
    });
}
