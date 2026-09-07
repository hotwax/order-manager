/**
 * Seed lookups, backed entirely by the local database.
 *
 * One module owns the state, the subscriptions, the synchronous getters and the composable.
 * There is no separate index module and no boot hydration: a slice is created the first time
 * something asks for its table, so only tables a session actually touches are ever read.
 *
 * A plain module rather than a composable or a store, because store/order.ts,
 * utils/badAddressState.ts and services/order.ts need synchronous lookups outside any
 * component. Components use `useSeedData()`; everything else imports the plain functions.
 *
 * Dexie is the source of truth. These slices are derived and read-only, with exactly one
 * writer: the liveQuery subscription per table. Nothing here fetches from the network.
 *
 * Not importable from the sync worker — it pulls in commonUtil, which would pin the @common
 * barrel into the worker chunk.
 */

import { shallowRef, type ShallowRef } from "vue";
import type { Subscription } from "dexie";
import { commonUtil } from "@common";
import type { BaseDB } from "@common/db";
import { dbClient, hasSyncedThisLogin } from "@common/db";
import { getOrderManagerDb } from "@/db/orderManagerDb";
import { ORDER_MANAGER_SYNC_CATALOG } from "@/config/appSyncConfig";

type Row = Record<string, any>;

/** Trailing debounce. The enum domain writes in 500-row batches; without this each batch rebuilds. */
const REBUILD_DEBOUNCE_MS = 150;

/** How long ensureLoaded waits for a domain's first sync before giving up and reading anyway. */
const SYNC_WAIT_TIMEOUT_MS = 5000;

const slices = new Map<string, ShallowRef<Map<string, Row>>>();
const subscriptions = new Map<string, Subscription>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const loading = new Map<string, Promise<void>>();

/**
 * Bumped by resetSeedData. A load started before a reset must never apply its rows
 * afterwards — otherwise a logout/OMS-switch could stamp the previous tenant's data into a
 * freshly created slice.
 */
let generation = 0;

/** Overridable in tests so slices can be built against a fixture database. */
let resolveDb: () => BaseDB = () => getOrderManagerDb(commonUtil.getOMSInstanceName());
export function __setDbResolver(resolver: () => BaseDB) { resolveDb = resolver; }

/** table -> sync domain name, so ensureLoaded can wait for the right loginSync marker. */
const domainOfTable = new Map(ORDER_MANAGER_SYNC_CATALOG.map((entry) => [entry.table, entry.name]));

// ── Secondary indexes, rebuilt with their source slice ────────────────────────────────
let statusesByType = new Map<string, Row[]>();
let enumsByType = new Map<string, Row[]>();
let enumChildTypesByParent = new Map<string, string[]>();
let geoAssocsByCountry = new Map<string, string[]>();
let carrierShipmentMethodsByParty = new Map<string, Row[]>();
let transitionsByStatus = new Map<string, Row[]>();

// ── Slice plumbing ────────────────────────────────────────────────────────────────────

function keyFieldOf(db: BaseDB, table: string): string {
  return (db.table(table).schema.primKey.keyPath as string) || "id";
}

function groupBy(rows: Row[], keyField: string): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row[keyField];
    if (!key) continue;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

/** Rebuild whichever secondary indexes derive from this table. */
function rebuildSecondary(table: string, rows: Row[]) {
  if (table === "statuses") {
    statusesByType = groupBy(rows, "statusTypeId");
  } else if (table === "enums") {
    enumsByType = groupBy(rows, "enumTypeId");
  } else if (table === "enumTypes") {
    const byParent = new Map<string, string[]>();
    for (const type of rows) {
      if (!type.parentTypeId || !type.enumTypeId) continue;
      const bucket = byParent.get(type.parentTypeId);
      if (bucket) { if (!bucket.includes(type.enumTypeId)) bucket.push(type.enumTypeId); }
      else byParent.set(type.parentTypeId, [type.enumTypeId]);
    }
    enumChildTypesByParent = byParent;
  } else if (table === "geoAssocs") {
    const byCountry = new Map<string, string[]>();
    for (const assoc of rows) {
      if (!assoc.geoId || !assoc.toGeoId) continue;
      const bucket = byCountry.get(assoc.geoId);
      if (bucket) { if (!bucket.includes(assoc.toGeoId)) bucket.push(assoc.toGeoId); }
      else byCountry.set(assoc.geoId, [assoc.toGeoId]);
    }
    geoAssocsByCountry = byCountry;
  } else if (table === "carrierShipmentMethods") {
    carrierShipmentMethodsByParty = groupBy(rows, "partyId");
  } else if (table === "statusFlowTransitions") {
    transitionsByStatus = groupBy(rows, "statusId");
  }
}

function applyRows(table: string, keyField: string, rows: Row[], gen: number) {
  // Dropped by resetSeedData while this load was in flight — discard the result.
  const slice = slices.get(table);
  if (!slice || gen !== generation) return;

  const next = new Map<string, Row>();
  for (const row of rows) {
    const key = row[keyField];
    if (key) next.set(String(key), row);
  }
  // Replacing the ref's value is what makes dependent computeds re-run.
  slice.value = next;
  rebuildSecondary(table, rows);
}

/** Read the table once, then keep it fresh. Idempotent per table. */
function loadAndSubscribe(table: string): Promise<void> {
  const inFlight = loading.get(table);
  if (inFlight) return inFlight;

  const gen = generation;

  const promise = (async () => {
    const db = resolveDb();
    const client = dbClient(db);
    const keyField = keyFieldOf(db, table);

    try {
      applyRows(table, keyField, await client.all(table), gen);
    } catch (error) {
      console.warn(`[seed] Initial read failed for ${table}:`, error);
    }

    if (gen !== generation || subscriptions.has(table)) return;

    try {
      const subscription = client.live(table).subscribe({
        next: (rows: Row[]) => {
          const pending = timers.get(table);
          if (pending) clearTimeout(pending);
          timers.set(table, setTimeout(() => {
            timers.delete(table);
            applyRows(table, keyField, rows, gen);
          }, REBUILD_DEBOUNCE_MS));
        },
        error: (error: any) => console.error(`[seed] liveQuery error on ${table}:`, error),
      });

      // A reset may have landed while we were subscribing.
      if (gen !== generation) subscription.unsubscribe();
      else subscriptions.set(table, subscription);
    } catch (error) {
      console.warn(`[seed] Failed to subscribe to ${table}:`, error);
    }
  })();

  loading.set(table, promise);
  return promise;
}

/**
 * The rows for a table. Creating the slice on first access is what makes loading lazy.
 * Reading `.value` is also what registers the reactive dependency for a computed.
 */
function sliceOf(table: string): Map<string, Row> {
  let slice = slices.get(table);
  if (!slice) {
    slice = shallowRef(new Map<string, Row>());
    slices.set(table, slice);
    void loadAndSubscribe(table);
  }
  return slice.value;
}

const rowsOf = (table: string): Row[] => [...sliceOf(table).values()];
const rowOf = (table: string, id: string): Row | undefined => (id ? sliceOf(table).get(id) : undefined);

// ── Public lifecycle ──────────────────────────────────────────────────────────────────

/**
 * Resolve once the table's domain has synced at least once this login, or once the bound
 * elapses. Bounded on purpose: a failed or stalled domain must never hang a caller.
 */
async function waitForDomainSync(table: string, timeoutMs = SYNC_WAIT_TIMEOUT_MS): Promise<void> {
  const domain = domainOfTable.get(table);
  if (!domain) return;

  const db = resolveDb();
  if (await hasSyncedThisLogin(db, domain)) return;

  await new Promise<void>((resolve) => {
    let done = false;
    let subscription: Subscription | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { subscription?.unsubscribe(); } catch { /* already closed */ }
      resolve();
    };

    const timer = setTimeout(() => {
      console.warn(`[seed] Timed out waiting for the ${domain} domain to sync.`);
      finish();
    }, timeoutMs);

    subscription = dbClient(db)
      .live("syncMeta", { equals: { key: `loginSync:${domain}` } })
      .subscribe({ next: (rows: Row[]) => { if (rows.length) finish(); }, error: finish });
  });
}

/**
 * Await the named tables before reading a value that will be STAMPED INTO DATA rather than
 * re-read by a computed. A stamped raw id never self-corrects; a computed does.
 *
 * This waits for the data to EXIST, not merely for a read to finish. On a fresh login the
 * table is empty, so awaiting the read alone would resolve instantly and stamp a raw id
 * permanently.
 */
export async function ensureLoaded(tables: string[], timeoutMs = SYNC_WAIT_TIMEOUT_MS): Promise<void> {
  await Promise.all(tables.map(async (table) => {
    if (!slices.has(table)) slices.set(table, shallowRef(new Map<string, Row>()));
    await waitForDomainSync(table, timeoutMs);
    await loadAndSubscribe(table);
  }));
}

/** Drop every slice and subscription. Call on logout and before an OMS switch. */
export function resetSeedData(): void {
  generation += 1;

  for (const subscription of subscriptions.values()) {
    try { subscription.unsubscribe(); } catch { /* already closed */ }
  }
  subscriptions.clear();

  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();

  loading.clear();
  slices.clear();

  statusesByType = new Map();
  enumsByType = new Map();
  enumChildTypesByParent = new Map();
  geoAssocsByCountry = new Map();
  carrierShipmentMethodsByParty = new Map();
  transitionsByStatus = new Map();
}

// ── Shared helpers ────────────────────────────────────────────────────────────────────

const firstValue = (item: Row | undefined, fields: string[]) =>
  fields.map((field) => item?.[field]).find(Boolean) || "";

function itemDescription(item: Row | undefined, id: string, fields = ["description", "enumName", "name"]) {
  return firstValue(item, fields) || id;
}

const carrierLabel = (carrier: Row) =>
  [carrier.firstName, carrier.lastName].filter(Boolean).join(" ") || carrier.groupName || carrier.partyId;

// ── Statuses and enums ────────────────────────────────────────────────────────────────

export const status = (statusId: string) => rowOf("statuses", statusId);
export const statusDescription = (statusId: string) => itemDescription(rowOf("statuses", statusId), statusId);
export const statusAge = (statusId: string): number => Number(rowOf("statuses", statusId)?.statusAge ?? 0);
export const enumDescription = (enumId: string) => itemDescription(rowOf("enums", enumId), enumId);

export const getStatusItemsByType = (typeId: string): Row[] => {
  sliceOf("statuses");                       // ensure the slice exists and is tracked
  return statusesByType.get(typeId) ?? [];
};
export const getEnumsByType = (typeId: string): Row[] => {
  sliceOf("enums");
  return enumsByType.get(typeId) ?? [];
};
export const getEnumsByParentType = (parentTypeId: string): Row[] => {
  sliceOf("enumTypes");
  return (enumChildTypesByParent.get(parentTypeId) ?? []).flatMap((childTypeId) => getEnumsByType(childTypeId));
};

/** Lookup tables describe() falls through, after statuses and enums. */
const DESCRIBE_FALLBACK_TABLES = [
  "contactMechPurposeTypes", "roleTypes", "paymentMethodTypes", "communicationEventTypes",
  "returnReasons", "returnTypes", "returnItemTypes", "orderAdjustmentTypes",
  "shipmentMethodTypes", "facilityTypes", "partyRelationshipTypes",
];

export function describe(id: string): string {
  if (!id) return "";
  const statusRow = rowOf("statuses", id);
  if (statusRow) return itemDescription(statusRow, id);
  const enumRow = rowOf("enums", id);
  if (enumRow) return itemDescription(enumRow, id);
  for (const table of DESCRIBE_FALLBACK_TABLES) {
    const row = rowOf(table, id);
    if (row) return itemDescription(row, id);
  }
  return id;
}

// ── Product stores and facilities ─────────────────────────────────────────────────────

export const productStores = (): Row[] => rowsOf("productStores");
export const productStore = (productStoreId: string) => rowOf("productStores", productStoreId);
export const productStoreName = (productStoreId: string) =>
  itemDescription(rowOf("productStores", productStoreId), productStoreId, ["storeName", "companyName"]);

export const facilities = (): Row[] => rowsOf("facilities");
export const facility = (facilityId: string) => rowOf("facilities", facilityId);
export const facilityName = (facilityId: string) =>
  itemDescription(rowOf("facilities", facilityId), facilityId, ["facilityName", "facilityId"]);
export const facilityType = (facilityTypeId: string) => rowOf("facilityTypes", facilityTypeId);

export const productStoreFacilities = (productStoreId: string): Row[] =>
  rowsOf("productStoreFacilities").filter((row) => row.productStoreId === productStoreId);

// ── Carriers and shipment methods ─────────────────────────────────────────────────────

export const carriers = (): Row[] => rowsOf("carriers");
export const carrier = (partyId: string) => rowOf("carriers", partyId);
export const carrierName = (partyId: string) => {
  const row = rowOf("carriers", partyId);
  return row ? carrierLabel(row) : partyId;
};

export const shipmentMethodTypes = (): Row[] => rowsOf("shipmentMethodTypes");
export const shipmentMethod = (id: string) => rowOf("shipmentMethodTypes", id);
export const shipmentMethodDescription = (id: string) =>
  itemDescription(rowOf("shipmentMethodTypes", id), id, ["description", "shipmentMethodTypeId"]);
export const getShipmentMethodOptions = (): Array<{ id: string; label: string }> =>
  rowsOf("shipmentMethodTypes").map((row) => ({
    id: row.shipmentMethodTypeId,
    label: itemDescription(row, row.shipmentMethodTypeId, ["description", "shipmentMethodTypeId"]),
  }));

export const shippingMethodsByCarrier = (carrierPartyId: string): Row[] => {
  sliceOf("carrierShipmentMethods");
  return carrierPartyId ? carrierShipmentMethodsByParty.get(carrierPartyId) ?? [] : [];
};

// ── Simple lookup descriptions ────────────────────────────────────────────────────────

export const paymentMethodDescription = (id: string) => itemDescription(rowOf("paymentMethodTypes", id), id);
export const returnReasonDescription = (id: string) => itemDescription(rowOf("returnReasons", id), id);
export const orderAdjustmentTypeDescription = (id: string) => itemDescription(rowOf("orderAdjustmentTypes", id), id);
export const partyRelationshipTypes = (): Row[] => rowsOf("partyRelationshipTypes");
export const roleTypes = (): Row[] => rowsOf("roleTypes");

// ── Order identification ──────────────────────────────────────────────────────────────

export const orderIdentificationTypeDescription = (id: string) => itemDescription(rowOf("enums", id), id);
export const orderIdentificationTypeOptions = (): Array<{ enumId: string; description: string }> =>
  getEnumsByType("ORDER_IDENTITY").map((row) => ({
    enumId: row.enumId,
    description: itemDescription(row, row.enumId),
  }));

// ── Shopify ───────────────────────────────────────────────────────────────────────────

export const shopifyShops = (): Row[] => rowsOf("shopifyShops");
export const shopifyShopLocations = (): Row[] => rowsOf("shopifyShopLocations");

// ── Geography ─────────────────────────────────────────────────────────────────────────

const byGeoName = (left: Row, right: Row) => (left.geoName || "").localeCompare(right.geoName || "");

export const geoName = (geoId: string) => itemDescription(rowOf("geos", geoId), geoId, ["geoName"]);

export const getGeoIdByCode = (code: string): string => {
  if (!code) return "";
  const match = rowsOf("geos").find((geo) => geo.geoCodeAlpha2 === code || geo.geoCode === code);
  return match?.geoId ?? "";
};

export const getCountries = (): Row[] =>
  rowsOf("geos").filter((geo) => geo.geoTypeEnumId === "GEOT_COUNTRY").sort(byGeoName);

export const getStates = (): Row[] =>
  rowsOf("geos")
    .filter((geo) => geo.geoTypeEnumId === "GEOT_STATE" || geo.geoTypeEnumId === "GEOT_PROVINCE")
    .sort(byGeoName);

export const getStatesForCountry = (countryGeoId: string): Row[] => {
  sliceOf("geoAssocs");
  return (geoAssocsByCountry.get(countryGeoId) ?? [])
    .map((geoId) => rowOf("geos", geoId))
    .filter(Boolean)
    .sort(byGeoName) as Row[];
};

// ── Status flow ───────────────────────────────────────────────────────────────────────

export const allowedTransitions = (statusId: string) => {
  sliceOf("statusFlowTransitions");
  return (transitionsByStatus.get(statusId) ?? [])
    .map((transition) => {
      const toStatusDescription = itemDescription(rowOf("statuses", transition.toStatusId), transition.toStatusId);
      return {
        ...transition,
        toStatusDescription,
        toStatusColor: commonUtil.getStatusColor(toStatusDescription),
      };
    })
    .sort((left, right) => {
      const leftSequence = left.transitionSequence ?? Number.MAX_SAFE_INTEGER;
      const rightSequence = right.transitionSequence ?? Number.MAX_SAFE_INTEGER;
      if (leftSequence !== rightSequence) return leftSequence - rightSequence;
      return (left.toStatusId || "").localeCompare(right.toStatusId || "");
    });
};

// ── Component entry point ─────────────────────────────────────────────────────────────

/**
 * The same getters, for components. Reading any of them inside a computed or a render
 * function registers a dependency on the underlying slice ref, so the computed re-runs when
 * that slice fills or changes. Non-component callers import the plain functions above.
 */
export function useSeedData() {
  return {
    describe, status, statusDescription, statusAge, enumDescription,
    getStatusItemsByType, getEnumsByType, getEnumsByParentType,

    productStores, productStore, productStoreName,
    facilities, facility, facilityName, facilityType, productStoreFacilities,

    carriers, carrier, carrierName,
    shipmentMethodTypes, shipmentMethod, shipmentMethodDescription,
    getShipmentMethodOptions, shippingMethodsByCarrier,

    paymentMethodDescription, returnReasonDescription, orderAdjustmentTypeDescription,
    partyRelationshipTypes, roleTypes,

    orderIdentificationTypeDescription, orderIdentificationTypeOptions,
    shopifyShops, shopifyShopLocations,

    geoName, getGeoIdByCode, getCountries, getStates, getStatesForCountry,
    allowedTransitions,

    ensureLoaded,
  };
}
