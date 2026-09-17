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
 *
 * Deep imports, not the `@common/db` barrel, for the same reason.
 */

import { defineAppDb } from "@common/db/defineAppDb";
import { commonSchema } from "@common/db/domains/commonSchema";
import type { BaseDB } from "@common/db/baseDb";
import type { DbClient } from "@common/db/dbClient";

/**
 * Order Manager reads only HotWax seed reference data, so it takes the whole common schema and
 * declares no tables of its own. Deep imports, not the `@common/db` barrel: the barrel re-exports
 * modules that import `vue`, and the sync worker imports this file.
 */
export const orderManagerDb = defineAppDb({
  suffix: "OrderManagerDB",
  version: 1,
  schema: commonSchema,
});

/** Kept as named functions so existing call sites are unchanged. */
export const orderManagerDbName = (omsInstance: string): string => orderManagerDb.name(omsInstance);
export const getOrderManagerDb = (omsInstance: string): BaseDB => orderManagerDb.get(omsInstance);
export const setOmsInstanceResolver = (resolve: () => string): void =>
  orderManagerDb.setOmsInstanceResolver(resolve);
export const omDb = (): DbClient => orderManagerDb.client();
