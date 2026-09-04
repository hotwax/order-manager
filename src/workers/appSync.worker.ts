/**
 * Order Manager Web Worker Entry.
 */

import { exposeWorkerHarness, registerCommonSeedDomains } from "@common/cache";
import { getOrderManagerDb } from "@/cache/appCacheDb";

// Register all standard HotWax OMS reference domains
registerCommonSeedDomains((omsInstance) => getOrderManagerDb(omsInstance));

// Expose the harness across Comlink to the main thread
exposeWorkerHarness((omsInstance) => getOrderManagerDb(omsInstance));
