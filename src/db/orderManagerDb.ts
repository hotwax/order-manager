/**
 * Order Manager Dexie Database Instance & Stored Entities.
 *
 * The database is scoped per OMS instance, so switching instances lands on a different
 * IndexedDB database instead of reading the previous tenant's rows.
 *
 * The instance is a parameter, not read from commonUtil here: the sync worker loads this
 * module and has no cookies, and importing commonUtil pins the common barrel into the
 * worker chunk, which Vite must emit as a single iife.
 */

import { BaseDB, COMMON_DB_SCHEMA } from "@common/db";

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
