/**
 * Order Manager Web Worker Entry.
 */

import { exposeWorkerHarness, registerCommonSeedDomains } from "@common/db";
import { getOrderManagerDb } from "@/db/orderManagerDb";

// Register all standard HotWax OMS reference domains
registerCommonSeedDomains((omsInstance) => getOrderManagerDb(omsInstance));

// Expose the harness across Comlink to the main thread
exposeWorkerHarness((omsInstance) => getOrderManagerDb(omsInstance));
