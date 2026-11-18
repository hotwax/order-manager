/**
 * Main-thread entry point for the Order Manager background database sync.
 *
 * Configures the generic setupAppDbSync helper with Order Manager's database and worker.
 */

import { setupAppDbSync } from "@common/db/sync/setupAppDbSync";
import { createSyncService } from "@common/db/sync/syncService";
import emitter from "@common/core/emitter";
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
  // A login in another tab or app moved the shared session to another OMS instance; sync has
  // stopped. App.vue (useOmsInstanceChangeAlert) asks the user to reload.
  onInstanceChanged: (change) => emitter.emit("omsInstanceChanged", change),
});
