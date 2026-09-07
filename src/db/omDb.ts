/**
 * Local-database accessors for the signed-in OMS instance.
 *
 * Separate from `orderManagerDb.ts` on purpose: that module is imported by the sync worker,
 * which must not pull in `commonUtil` — doing so pins the `@common` barrel into the worker
 * chunk, which Vite has to emit as a single iife. This file is main-thread only.
 */

import { commonUtil } from "@common";
import { type DbClient, dbClient, useDb } from "@common/db";
import { type OrderManagerDB, getOrderManagerDb } from "@/db/orderManagerDb";

/** The Dexie database for the signed-in OMS. Resolved per call so reads follow an instance switch. */
export function omDb(): OrderManagerDB {
  return getOrderManagerDb(commonUtil.getOMSInstanceName());
}

/** Promise-based operations for stores, services and utils. */
export function omDbClient(): DbClient {
  return dbClient(omDb());
}

/**
 * Rows for one local table, for stores, services and utils.
 *
 * Never throws. A seed lookup that cannot resolve — no OMS instance yet, a failed open —
 * must degrade to raw ids, not break the order fetch or customer dashboard that called it.
 */
export async function seedRows<T = Record<string, any>>(table: string): Promise<T[]> {
  try {
    return await omDbClient().all<T>(table);
  } catch (error) {
    console.warn(`[seed] Could not read ${table} from the local database:`, error);

    return [];
  }
}

/**
 * Reactive rows for one local table, scoped to the calling component.
 *
 * Holds no state of its own — `useDb` owns the subscription and unsubscribes on unmount.
 * Pair with the pure helpers in `seedLookups.ts`:
 *
 *   const { records: facilities } = useSeedTable('facilities');
 *   const label = computed(() => facilityName(facilities.value, props.facilityId));
 */
export function useSeedTable<T = Record<string, any>>(table: string) {
  return useDb<T>(omDb(), table);
}
