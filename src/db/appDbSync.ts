/**
 * Main-thread entry point for the Order Manager background database sync.
 *
 * Configures the generic setupAppDbSync helper with Order Manager's database and worker.
 */

import { setupAppDbSync } from "@common/db/sync/setupAppDbSync";
import { createSyncService } from "@common/db/sync/syncService";
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
} = setupAppDbSync({
  db: orderManagerDb,
  getWorkerUrl: () => new URL(appSyncWorkerUrl, import.meta.url),
  createSyncService,
});
