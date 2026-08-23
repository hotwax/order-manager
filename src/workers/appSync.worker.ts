/**
 * Order Manager Web Worker Entry.
 */

import { exposeWorkerHarness, registerCommonSeedDomains } from "@common/cache";
import { orderManagerDb } from "@/cache/appCacheDb";

// Register all standard HotWax OMS reference domains
registerCommonSeedDomains(() => orderManagerDb);

// Expose the harness across Comlink to the main thread
exposeWorkerHarness(() => orderManagerDb);
