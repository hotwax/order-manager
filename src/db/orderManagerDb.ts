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
 *   getOrderManagerDb(omsInstance)  the instance is a parameter — for the worker entry only,
 *                                   which hands it to the sync harness
 *   orderManagerDb.entity(table)    every read and write: resolves the instance via a resolver
 *                                   the app registers at boot (useLiveEntity for live reads)
 *
 * Deep imports, not the `@common/db` barrel, for the same reason.
 */

import { defineAppDb } from "@common/db/model/defineAppDb";
import { commonSchema } from "@common/db/schema/commonSchema";
import type { BaseDB } from "@common/db/storage/baseDb";

/**
 * Order Manager takes the framework's whole common module (seed reference data and the
 * `products` master) and declares no tables of its own. Deep imports, not the `@common/db` barrel:
 * the barrel re-exports modules that import `vue`, and the sync worker imports this file.
 */
export const orderManagerDb = defineAppDb({
  suffix: "OrderManagerDB",
  // v2: statusFlowTransitions gained transitionName and conditionExpression. Rows cached without
  //     them read every transition as user-driven, so they must not survive.
  // v3: the common seed tables gained fields (store time zones, enumName, facility fields, geo
  //     wellKnownText). New fields leave the store strings unchanged, so only a version change makes
  //     an existing database drop its old rows and re-sync them.
  // v4: products (the framework's product master), replacing the app-local `${oms}-CommonDB` Dexie store.
  version: 4,
  schema: commonSchema,
});

/** Kept as named functions so existing call sites are unchanged. */
export const orderManagerDbName = (omsInstance: string): string => orderManagerDb.name(omsInstance);
export const getOrderManagerDb = (omsInstance: string): BaseDB => orderManagerDb.get(omsInstance);
export const setOmsInstanceResolver = (resolve: () => string): void =>
  orderManagerDb.setOmsInstanceResolver(resolve);
