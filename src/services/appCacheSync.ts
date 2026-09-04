/**
 * Main-thread entry point for the Order Manager background cache sync.
 *
 * Both boot paths (a restored session in App.vue and a fresh login in store/user)
 * start the same worker with the same config, so the wiring lives here once.
 *
 * Worker creation goes through the shared `WorkerFactory` rather than a bare
 * `new Worker(...)`, keeping module-worker spawning centralized across the suite —
 * the same pattern as company's `pollingService` and inventory-count.
 */

import { commonUtil, cookieHelper } from "@common";
import { startCacheBootstrap, type SyncHarness } from "@common/cache";
import { WorkerFactory } from "@common/core/workerFactory";
import { useAuth } from "@common/composables/useAuth";
import { getOrderManagerDb } from "@/cache/appCacheDb";
import { ORDER_MANAGER_CACHE_CATALOG } from "@/config/appSyncConfig";
// `?worker&url` lets Vite bundle the worker as its own chunk and hand back its URL,
// so the factory resolves the same asset in dev and in a production build.
import appSyncWorkerUrl from "../workers/appSync.worker.ts?worker&url";

/** The session token the sync worker should start with, or "" when there is none. */
export function getCacheSyncToken(): string {
  return cookieHelper().get("api_key")
    || cookieHelper().get("token")
    || (useAuth() as any).token?.value
    || "";
}

/**
 * Start the background cache sync and repopulate the in-memory seed store once the
 * first pass lands. Never rejects — a sync failure must not break boot or login.
 */
export function startAppCacheSync(token: string, onSynced?: () => void): Promise<void> {
  // Resolved here on the main thread and handed to the worker, which has no cookies to read it from.
  const omsInstance = commonUtil.getOMSInstanceName();

  return startCacheBootstrap({
    workerFactory: () => WorkerFactory.createWorker<SyncHarness>(new URL(appSyncWorkerUrl, import.meta.url)).worker,
    token,
    maargUrl: commonUtil.getMaargURL(),
    omsInstance,
    db: getOrderManagerDb(omsInstance),
    domains: ORDER_MANAGER_CACHE_CATALOG.map((domain) => domain.name),
  }).then(() => {
    onSynced?.();
  });
}
