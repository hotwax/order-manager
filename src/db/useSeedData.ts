/**
 * Seed data lookups, read straight from the local database.
 *
 * The only seed module the app imports. Every getter opens IndexedDB, reads what it needs,
 * applies whatever filtering or joining the answer requires, and returns a value.
 * Nothing is cached here and nothing is subscribed — the sync worker keeps the database
 * current, and each call reads the current state.
 *
 * Reads are asynchronous because IndexedDB has no synchronous API, so callers hold the
 * result in a ref (views) or await it inline (stores, services, utils). Plural variants
 * (`getStatusDescriptions(ids)`) exist for lists: they read the table once and return a map,
 * so rendering fifty rows costs one read rather than fifty.
 *
 * Every id-to-label getter falls back to the raw id, matching what the UI showed before.
 *
 * Not importable from the sync worker — it pulls in commonUtil, which would pin the @common
 * barrel into the worker chunk.
 */

import { commonUtil } from "@common";
import { omDb } from "@/db/orderManagerDb";

export type Row = Record<string, any>;

/**
 * Read a whole table, degrading to an empty list.
 *
 * A seed lookup that cannot resolve — no OMS instance yet, a failed open — must leave the UI
 * showing raw ids rather than break the screen that asked.
 */
async function rows(table: string): Promise<Row[]> {
  try {
    return await omDb().all(table);
  } catch (error) {
    console.warn(`[seed] Could not read ${table} from the local database:`, error);

    return [];
  }
}

/** Read one row by primary key, degrading to undefined. */
async function row(table: string, key: string): Promise<Row | undefined> {
  if(!key) {return undefined;}

  try {
    return await omDb().get(table, key);
  } catch (error) {
    console.warn(`[seed] Could not read ${table}/${key} from the local database:`, error);

    return undefined;
  }
}

const DEFAULT_LABEL_FIELDS = ["description", "enumName", "name"];

/** First non-empty value among `fields`, else the raw id. */
function labelOf(record: Row | undefined, id: string, fields = DEFAULT_LABEL_FIELDS): string {
  return (fields.map((field) => record?.[field]).find(Boolean) as string) || id;
}

/** One label by primary key. */
async function label(table: string, keyField: string, id: string, fields?: string[]): Promise<string> {
  if(!id) {return "";}

  const found = await row(table, id);

  return labelOf(found, id, fields);
}

/**
 * Labels for many ids in one table read. The workhorse behind every plural getter: a list
 * screen resolves all its labels with a single pass over the table.
 */
async function labels(
  table: string,
  keyField: string,
  ids: readonly string[],
  fields?: string[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if(!wanted.length) {return {};}

  const all = await rows(table);
  const byKey = new Map(all.map((record) => [record[keyField], record]));

  return Object.fromEntries(wanted.map((id) => [id, labelOf(byKey.get(id), id, fields)]));
}

// ── Statuses ──────────────────────────────────────────────────────────────────────────

export const getStatus = (statusId: string) => row("statuses", statusId);

export const getStatusDescription = (statusId: string) => label("statuses", "statusId", statusId);

export const getStatusDescriptions = (statusIds: readonly string[]) =>
  labels("statuses", "statusId", statusIds);

export async function getStatusAge(statusId: string): Promise<number> {
  return Number((await getStatus(statusId))?.statusAge ?? 0);
}

/** Ages for many statuses in one table read — used when scoring a page of orders. */
export async function getStatusAges(statusIds: readonly string[]): Promise<Record<string, number>> {
  const wanted = [...new Set(statusIds.filter(Boolean))];
  if(!wanted.length) {return {};}

  const all = await rows("statuses");
  const byKey = new Map(all.map((record) => [record.statusId, record]));

  return Object.fromEntries(wanted.map((id) => [id, Number(byKey.get(id)?.statusAge ?? 0)]));
}

export async function getStatusItemsByType(statusTypeId: string): Promise<Row[]> {
  return (await rows("statuses")).filter((record) => record.statusTypeId === statusTypeId);
}

// ── Enums ─────────────────────────────────────────────────────────────────────────────

export const getEnumDescription = (enumId: string) => label("enums", "enumId", enumId);

export const getEnumDescriptions = (enumIds: readonly string[]) => labels("enums", "enumId", enumIds);

export async function getEnumsByType(enumTypeId: string): Promise<Row[]> {
  return (await rows("enums")).filter((record) => record.enumTypeId === enumTypeId);
}

/** Enums belonging to any child type of `parentTypeId` — joins enumTypes to enums. */
export async function getEnumsByParentType(parentTypeId: string): Promise<Row[]> {
  const [enums, enumTypes] = await Promise.all([rows("enums"), rows("enumTypes")]);
  const childTypeIds = new Set(enumTypes.filter((type) => type.parentTypeId === parentTypeId).map((type) => type.enumTypeId),);

  return enums.filter((record) => childTypeIds.has(record.enumTypeId));
}

export const getOrderIdentificationTypeDescription = (enumId: string) => getEnumDescription(enumId);

export async function getOrderIdentificationTypeOptions(): Promise<Array<{ enumId: string; description: string }>> {
  return (await getEnumsByType("ORDER_IDENTITY")).map((record) => ({
    enumId: record.enumId,
    description: labelOf(record, record.enumId),
  }));
}

// ── Product stores ────────────────────────────────────────────────────────────────────

export const getProductStore = (productStoreId: string) => row("productStores", productStoreId);

export const getProductStoreName = (productStoreId: string) =>
  label("productStores", "productStoreId", productStoreId, ["storeName", "companyName"]);

export const getProductStoreNames = (productStoreIds: readonly string[]) =>
  labels("productStores", "productStoreId", productStoreIds, ["storeName", "companyName"]);

export async function getProductStoreFacilities(productStoreId: string): Promise<Row[]> {
  if(!productStoreId) {return [];}

  return (await rows("productStoreFacilities")).filter((record) => record.productStoreId === productStoreId);
}

// ── Facilities ────────────────────────────────────────────────────────────────────────

export const getFacilities = () => rows("facilities");

export const getFacility = (facilityId: string) => row("facilities", facilityId);

export const getFacilityName = (facilityId: string) =>
  label("facilities", "facilityId", facilityId, ["facilityName", "facilityId"]);

export const getFacilityNames = (facilityIds: readonly string[]) =>
  labels("facilities", "facilityId", facilityIds, ["facilityName", "facilityId"]);

export const getFacilityType = (facilityTypeId: string) => row("facilityTypes", facilityTypeId);

/** Parent type of a facility type — the virtual-facility check in the order services. */
export async function getFacilityParentTypeId(facilityTypeId: string): Promise<string> {
  return (await getFacilityType(facilityTypeId))?.parentTypeId ?? "";
}

/** facilityTypeId -> parentTypeId for many types in one read. */
export async function getFacilityParentTypeIds(facilityTypeIds: readonly string[],): Promise<Record<string, string>> {
  const wanted = [...new Set(facilityTypeIds.filter(Boolean))];
  if(!wanted.length) {return {};}

  const all = await rows("facilityTypes");
  const byKey = new Map(all.map((record) => [record.facilityTypeId, record]));

  return Object.fromEntries(wanted.map((id) => [id, byKey.get(id)?.parentTypeId ?? ""]));
}

// ── Carriers and shipment methods ─────────────────────────────────────────────────────

const carrierLabel = (carrier: Row) =>
  [carrier.firstName, carrier.lastName].filter(Boolean).join(" ") || carrier.groupName || carrier.partyId;

export const getCarriers = () => rows("carriers");

export const getCarrier = (partyId: string) => row("carriers", partyId);

export async function getCarrierName(partyId: string): Promise<string> {
  const found = await getCarrier(partyId);

  return found ? carrierLabel(found) : partyId;
}

export const getShipmentMethodTypes = () => rows("shipmentMethodTypes");

export const getShipmentMethod = (shipmentMethodTypeId: string) =>
  row("shipmentMethodTypes", shipmentMethodTypeId);

const SHIPMENT_METHOD_LABEL_FIELDS = ["description", "shipmentMethodTypeId"];

export const getShipmentMethodDescription = (shipmentMethodTypeId: string) =>
  label("shipmentMethodTypes", "shipmentMethodTypeId", shipmentMethodTypeId, SHIPMENT_METHOD_LABEL_FIELDS);

export const getShipmentMethodDescriptions = (shipmentMethodTypeIds: readonly string[]) =>
  labels("shipmentMethodTypes", "shipmentMethodTypeId", shipmentMethodTypeIds, SHIPMENT_METHOD_LABEL_FIELDS);

export async function getShipmentMethodOptions(): Promise<Array<{ id: string; label: string }>> {
  return (await getShipmentMethodTypes()).map((record) => ({
    id: record.shipmentMethodTypeId,
    label: labelOf(record, record.shipmentMethodTypeId, SHIPMENT_METHOD_LABEL_FIELDS),
  }));
}

export async function getShippingMethodsByCarrier(carrierPartyId: string): Promise<Row[]> {
  if(!carrierPartyId) {return [];}

  return (await rows("carrierShipmentMethods")).filter((record) => record.partyId === carrierPartyId);
}

// ── Simple type lookups ───────────────────────────────────────────────────────────────

export const getPaymentMethodDescription = (id: string) => label("paymentMethodTypes", "paymentMethodTypeId", id);
export const getPaymentMethodDescriptions = (ids: readonly string[]) =>
  labels("paymentMethodTypes", "paymentMethodTypeId", ids);

export const getReturnReasonDescription = (id: string) => label("returnReasons", "returnReasonId", id);
export const getReturnReasonDescriptions = (ids: readonly string[]) =>
  labels("returnReasons", "returnReasonId", ids);

export const getReturnTypeDescription = (id: string) => label("returnTypes", "returnTypeId", id);
export const getReturnTypeDescriptions = (ids: readonly string[]) =>
  labels("returnTypes", "returnTypeId", ids);

export const getReturnItemTypeDescription = (id: string) => label("returnItemTypes", "returnItemTypeId", id);
export const getReturnItemTypeDescriptions = (ids: readonly string[]) =>
  labels("returnItemTypes", "returnItemTypeId", ids);
export const getRoleTypeDescription = (id: string) => label("roleTypes", "roleTypeId", id);

export const getOrderAdjustmentTypeDescription = (id: string) =>
  label("orderAdjustmentTypes", "orderAdjustmentTypeId", id);
export const getOrderAdjustmentTypeDescriptions = (ids: readonly string[]) =>
  labels("orderAdjustmentTypes", "orderAdjustmentTypeId", ids);

export const getContactPurposeDescription = (id: string) =>
  label("contactMechPurposeTypes", "contactMechPurposeTypeId", id);
export const getContactPurposeDescriptions = (ids: readonly string[]) =>
  labels("contactMechPurposeTypes", "contactMechPurposeTypeId", ids);

export const getCommunicationEventTypeDescription = (id: string) =>
  label("communicationEventTypes", "communicationEventTypeId", id);
export const getCommunicationEventTypeDescriptions = (ids: readonly string[]) =>
  labels("communicationEventTypes", "communicationEventTypeId", ids);

const RELATIONSHIP_LABEL_FIELDS = ["description", "partyRelationshipName"];

export const getPartyRelationshipDescription = (id: string) =>
  label("partyRelationshipTypes", "partyRelationshipTypeId", id, RELATIONSHIP_LABEL_FIELDS);
export const getPartyRelationshipDescriptions = (ids: readonly string[]) =>
  labels("partyRelationshipTypes", "partyRelationshipTypeId", ids, RELATIONSHIP_LABEL_FIELDS);

export const getPartyRelationshipTypes = () => rows("partyRelationshipTypes");
export const getRoleTypes = () => rows("roleTypes");

// ── Shopify ───────────────────────────────────────────────────────────────────────────

export const getShopifyShops = () => rows("shopifyShops");
export const getShopifyShop = (shopId: string) => row("shopifyShops", shopId);
export const getShopifyShopLocations = () => rows("shopifyShopLocations");

// ── Geography ─────────────────────────────────────────────────────────────────────────

const byGeoName = (left: Row, right: Row) => (left.geoName || "").localeCompare(right.geoName || "");

export const getGeos = () => rows("geos");

export const getGeoName = (geoId: string) => label("geos", "geoId", geoId, ["geoName"]);

export const getGeoNames = (geoIds: readonly string[]) => labels("geos", "geoId", geoIds, ["geoName"]);

export async function getGeoIdByCode(code: string): Promise<string> {
  if(!code) {return "";}

  const all = await rows("geos");

  return all.find((geo) => geo.geoCodeAlpha2 === code || geo.geoCode === code)?.geoId ?? "";
}

/** code -> geoId for many codes in one read. */
export async function getGeoIdsByCode(codes: readonly string[]): Promise<Record<string, string>> {
  const wanted = [...new Set(codes.filter(Boolean))];
  if(!wanted.length) {return {};}

  const all = await rows("geos");

  return Object.fromEntries(wanted.map((code) => [
    code,
    all.find((geo) => geo.geoCodeAlpha2 === code || geo.geoCode === code)?.geoId ?? "",
  ]),);
}

export async function getCountries(): Promise<Row[]> {
  return (await rows("geos")).filter((geo) => geo.geoTypeEnumId === "GEOT_COUNTRY").sort(byGeoName);
}

export async function getStates(): Promise<Row[]> {
  return (await rows("geos"))
    .filter((geo) => geo.geoTypeEnumId === "GEOT_STATE" || geo.geoTypeEnumId === "GEOT_PROVINCE")
    .sort(byGeoName);
}

/** States of one country — joins geoAssocs to geos. */
export async function getStatesForCountry(countryGeoId: string): Promise<Row[]> {
  if(!countryGeoId) {return [];}

  const [geos, geoAssocs] = await Promise.all([rows("geos"), rows("geoAssocs")]);
  const stateIds = new Set(geoAssocs.filter((assoc) => assoc.geoId === countryGeoId).map((assoc) => assoc.toGeoId),);

  return geos.filter((geo) => stateIds.has(geo.geoId)).sort(byGeoName);
}

// ── Status flow ───────────────────────────────────────────────────────────────────────

export interface AllowedTransition extends Row {
  toStatusDescription: string;
  toStatusColor: string;
}

/**
 * Transitions out of `statusId`, each carrying the destination's label and colour.
 * Joins statusFlowTransitions to statuses so callers need neither table.
 */
export async function getAllowedTransitions(statusId: string): Promise<AllowedTransition[]> {
  if(!statusId) {return [];}

  const [transitions, statuses] = await Promise.all([rows("statusFlowTransitions"), rows("statuses")]);
  const statusByKey = new Map(statuses.map((record) => [record.statusId, record]));

  return transitions
    .filter((transition) => transition.statusId === statusId)
    .map((transition) => {
      const toStatusDescription = labelOf(statusByKey.get(transition.toStatusId), transition.toStatusId);

      return {
        ...transition,
        toStatusDescription,
        toStatusColor: commonUtil.getStatusColor(toStatusDescription),
      };
    })
    .sort((left, right) => {
      const leftSequence = left.transitionSequence ?? Number.MAX_SAFE_INTEGER;
      const rightSequence = right.transitionSequence ?? Number.MAX_SAFE_INTEGER;
      if(leftSequence !== rightSequence) {return leftSequence - rightSequence;}

      return (left.toStatusId || "").localeCompare(right.toStatusId || "");
    });
}
