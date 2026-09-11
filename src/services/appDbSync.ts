/**
 * Main-thread entry point for the Order Manager background database sync.
 *
 * Configures the generic createAppDbSync helper with Order Manager's database and worker.
 */

import { createAppDbSync, createSyncService } from "@common/db";
import { orderManagerDb } from "@/db/orderManagerDb";
import appSyncWorkerUrl from "../workers/appSync.worker.ts?worker&url";

export const {
  syncService,
  startAppDbSync,
  stopAppDbSync,
  refreshAfterMutation,
  resyncDomain,
  resyncReferenceData,
  bootstrapState,
} = createAppDbSync({
  db: orderManagerDb,
  getWorkerUrl: () => new URL(appSyncWorkerUrl, import.meta.url),
  createSyncService,
});
