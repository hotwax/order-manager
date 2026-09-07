/**
 * Order Manager Dexie Database Instance & Stored Entities.
 *
 * The database is scoped per OMS instance, so switching instances lands on a different
 * IndexedDB database instead of reading the previous tenant's rows.
 *
 * This module must never statically import `commonUtil` or the `@common` barrel. The sync
 * worker imports it for `getOrderManagerDb`, and an ES import is unconditional — the barrel
 * would be bundled into the worker chunk (dragging in @ionic/vue, luxon, papaparse and a
 * Pinia store) even though the worker never touches it, and Vite must emit that chunk as a
 * single iife. Hence the two entry points below:
 *
 *   getOrderManagerDb(omsInstance)  the instance is a parameter — worker-safe
 *   omDb()                          resolves the instance via a resolver the app registers
 *                                   at boot — main thread only
 */

import { BaseDB, COMMON_DB_SCHEMA, type DbClient, dbClient } from "@common/db";

export class OrderManagerDB extends BaseDB {
  constructor(dbName: string) {
    super(dbName, COMMON_DB_SCHEMA);
  }
}

/** e.g. `demo-oms-OrderManagerDB`. Throws rather than fall back to a database shared across instances. */
export function orderManagerDbName(omsInstance: string): string {
  if(!omsInstance) {
    throw new Error("[db] Cannot open the Order Manager database: no OMS instance.");
  }

  return `${omsInstance}-OrderManagerDB`;
}

let activeDb: OrderManagerDB | null = null;

/**
 * The local database for an OMS instance, created on first use and reused after that.
 * Switching OMS closes the previous connection, so handles still held by a `liveQuery`
 * stop serving the old tenant's rows.
 */
export function getOrderManagerDb(omsInstance: string): OrderManagerDB {
  const dbName = orderManagerDbName(omsInstance);

  if(activeDb?.name === dbName) {
    return activeDb;
  }

  activeDb?.close();
  activeDb = new OrderManagerDB(dbName);

  return activeDb;
}

let resolveOmsInstance: (() => string) | null = null;

/**
 * Register how the app finds the signed-in OMS instance. Called once from `main.ts` with
 * `commonUtil.getOMSInstanceName`, which keeps that import out of this module and therefore
 * out of the worker chunk. The worker never calls this — it passes the instance in.
 */
export function setOmsInstanceResolver(resolve: () => string): void {
  resolveOmsInstance = resolve;
}

/**
 * The dbClient for the signed-in OMS. Resolved per call so reads follow an instance switch.
 *
 * Main thread only. Stores, services, utils and `useSeedData` read IndexedDB through this;
 * the worker uses `getOrderManagerDb(omsInstance)` directly.
 */
export function omDb(): DbClient {
  if(!resolveOmsInstance) {
    throw new Error("[db] No OMS instance resolver registered; call setOmsInstanceResolver at boot.");
  }

  return dbClient(getOrderManagerDb(resolveOmsInstance()));
}
