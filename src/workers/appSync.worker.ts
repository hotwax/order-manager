/**
 * Order Manager Web Worker Entry.
 */

// Deep imports, not the barrel: this is a worker entry, and the barrel pulls in `vue`.
// The pre-existing `from "@common/db"` here was the one place Order Manager violated that.
import { commonDomains } from "@common/db/domains/commonDomains";
import { exposeWorkerHarness } from "@common/db/sync/pollingWorkerHarness";
import { registerDomains } from "@common/db/sync/registerDomains";
import { getOrderManagerDb } from "@/db/orderManagerDb";

registerDomains(Object.values(commonDomains));

exposeWorkerHarness((omsInstance) => getOrderManagerDb(omsInstance));
