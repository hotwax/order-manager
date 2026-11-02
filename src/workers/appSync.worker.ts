/**
 * Order Manager Web Worker Entry.
 */

// Deep imports, not the barrel: this is a worker entry, and the barrel pulls in `vue`.
// The pre-existing `from "@common/db"` here was the one place Order Manager violated that.
import { commonDomains } from "@common/db/domain/commonDomains";
import { exposeWorkerHarness } from "@common/db/sync/pollingWorkerHarness";
import { registerDomains } from "@common/db/sync/syncRegistry";
import { getOrderManagerDb, setOmsInstanceResolver } from "@/db/orderManagerDb";

registerDomains(Object.values(commonDomains));

exposeWorkerHarness((omsInstance) => {
  // The worker is its own JS realm: the framework product domain writes through the registered app
  // db's entity, which resolves the instance here.
  setOmsInstanceResolver(() => omsInstance);
  return getOrderManagerDb(omsInstance);
});
