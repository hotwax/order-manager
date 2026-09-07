/**
 * The dbClient for the signed-in OMS instance.
 *
 * Sugar over `dbClient(getOrderManagerDb(...))`, not a layer of its own: stores, services
 * and utils read IndexedDB directly through this. It cannot live in `orderManagerDb.ts`
 * because the sync worker imports that module and must not pull in `commonUtil` — doing so
 * pins the `@common` barrel into the worker chunk, which Vite emits as a single iife.
 */

import { commonUtil } from "@common";
import { type DbClient, dbClient } from "@common/db";
import { getOrderManagerDb } from "@/db/orderManagerDb";

/** Resolved per call so reads follow an OMS instance switch. */
export function omDb(): DbClient {
  return dbClient(getOrderManagerDb(commonUtil.getOMSInstanceName()));
}
