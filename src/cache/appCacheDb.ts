/**
 * Order Manager Dexie Database Instance & Cached Entities.
 *
 * The cache is scoped per OMS instance, so switching instances lands on a different
 * IndexedDB database instead of reading the previous tenant's rows.
 *
 * The instance is a parameter, not read from commonUtil here: the sync worker loads this
 * module and has no cookies, and importing commonUtil pins the common barrel into the
 * worker chunk, which Vite must emit as a single iife.
 */

import { BaseCacheDB, COMMON_CACHE_SCHEMA } from "@common/cache";

export class OrderManagerCacheDB extends BaseCacheDB {
  constructor(dbName: string) {
    super(dbName, COMMON_CACHE_SCHEMA);
  }
}

/** e.g. `demo-oms-OrderManagerCacheDB`. Throws rather than fall back to a database shared across instances. */
export function orderManagerDbName(omsInstance: string): string {
  if(!omsInstance) {
    throw new Error("[cache] Cannot open the Order Manager cache: no OMS instance.");
  }

  return `${omsInstance}-OrderManagerCacheDB`;
}

let activeDb: OrderManagerCacheDB | null = null;

/**
 * The cache database for an OMS instance, created on first use and reused after that.
 * Switching OMS closes the previous connection, so handles still held by a `liveQuery`
 * stop serving the old tenant's rows.
 */
export function getOrderManagerDb(omsInstance: string): OrderManagerCacheDB {
  const dbName = orderManagerDbName(omsInstance);

  if(activeDb?.name === dbName) {
    return activeDb;
  }

  activeDb?.close();
  activeDb = new OrderManagerCacheDB(dbName);

  return activeDb;
}
