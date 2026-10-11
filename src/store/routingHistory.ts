import { logger } from "@common";
import { defineStore } from "pinia";
import {
  type LocationStock, fetchInventoryCutoff, fetchLocationStock, fetchRoutingChanges, fetchStockMovements,
  pairKey
} from "@/services/routingHistory";
import {
  type ItemRoutingHistory, type MovementPage, type RoutingItem,
  buildRoutingHistory, isStockLocation, movementRequests
} from "@/utils/routingHistory";

type LoadStatus = "loading" | "loaded" | "error";

interface RoutingHistoryState {
  changesByOrderId: Record<string, any[]>;
  statusByOrderId: Record<string, LoadStatus>;
  /** Stock movements per product and facility, keyed by pairKey. */
  movementsByPair: Record<string, MovementPage>;
  /** Current available to promise and on hand per product and facility, keyed by pairKey. */
  stockByPair: Record<string, LocationStock>;
  /** When each product store went live on HotWax inventory (see fetchInventoryCutoff); null when unknown. */
  cutoffByProductStore: Record<string, number | null>;
}

export interface LoadRoutingOptions {
  /** Read again even when already loaded. */
  force?: boolean;
  /** When the order came in, where an item that was never routed is read from. */
  importedAt?: number;
  /** The order's product store, whose go-live explains items with no inventory impact. */
  productStoreId?: string;
}

const inFlight = new Map<string, Promise<void>>();
/** Orders whose items moved since their routing was read; the next load reads it again. */
const stale = new Set<string>();

export const useRoutingHistoryStore = defineStore("routingHistory", {
  state: (): RoutingHistoryState => ({
    changesByOrderId: {},
    statusByOrderId: {},
    movementsByPair: {},
    stockByPair: {},
    cutoffByProductStore: {},
  }),
  getters: {
    historyFor: (state) => (orderId: string, items: RoutingItem[]): ItemRoutingHistory[] => buildRoutingHistory({
      orderId,
      items,
      changes: state.changesByOrderId[orderId] || [],
      movements: state.movementsByPair,
      stock: state.stockByPair,
    }),
    statusFor: (state) => (orderId: string): LoadStatus | undefined => state.statusByOrderId[orderId],
    cutoffFor: (state) => (productStoreId?: string): number | null => (productStoreId && state.cutoffByProductStore[productStoreId]) || null,
  },
  actions: {
    /** Current stock at each item's location, for the warnings on the item and ship group views. */
    async fetchItemLocationStock(items: RoutingItem[]) {
      const pairs = items
        .filter((item) => item.productId && isStockLocation(item.facilityId))
        .map((item) => ({ productId: item.productId, facilityId: item.facilityId }));
      if(!pairs.length) {return;}
      try {
        Object.assign(this.stockByPair, await fetchLocationStock(pairs));
      } catch (err) {
        // The warnings are a hint; without stock the page reads as it did before.
        logger.error("Failed to fetch item location stock", err);
      }
    },

    /** The order's items moved (an action here, or routing on the server): read its routing again next time. */
    markStale(orderId: string) {
      stale.add(orderId);
    },

    /** Routing changes, the stock movements behind them, and current stock, for the Routing segment. */
    loadRoutingHistory(orderId: string, items: RoutingItem[], options: LoadRoutingOptions = {}): Promise<void> {
      const { force = false, importedAt, productStoreId } = options;
      if(!force && !stale.has(orderId) && this.statusByOrderId[orderId] === "loaded") {return Promise.resolve();}
      const running = inFlight.get(orderId);
      // A forced load wants changes newer than the running load has read, so it runs again after it.
      if(running) {return force ? running.then(() => this.loadRoutingHistory(orderId, items, options)) : running;}

      // A reload keeps the routing already shown on screen until the new one is in.
      const reloading = this.statusByOrderId[orderId] === "loaded";
      stale.delete(orderId);
      const load = (async () => {
        if(!reloading) {this.statusByOrderId[orderId] = "loading";}
        try {
          const changes = await fetchRoutingChanges(orderId);
          this.changesByOrderId[orderId] = changes;
          const requests = movementRequests(items, changes, importedAt);
          if(productStoreId && !(productStoreId in this.cutoffByProductStore)) {
            // Only explains empty timelines, so a failure leaves them unexplained rather than failing the load.
            this.cutoffByProductStore[productStoreId] = await fetchInventoryCutoff(productStoreId).catch((err) => {
              logger.error("Failed to read the store's inventory go-live", err);

              return null;
            });
          }
          const pages = await Promise.allSettled(requests.map((request) =>
            fetchStockMovements(request.productId, request.facilityId, request.sinceMillis)));
          pages.forEach((page, index) => {
            const request = requests[index];
            if(page.status === "fulfilled") {
              this.movementsByPair[pairKey(request.productId, request.facilityId)] = page.value;
            } else {
              logger.error("Failed to fetch stock movements", request, page.reason);
            }
          });
          const stock = await fetchLocationStock(requests.map(({ productId, facilityId }) => ({ productId, facilityId })));
          Object.assign(this.stockByPair, stock);
          this.statusByOrderId[orderId] = "loaded";
        } catch (err) {
          logger.error("Failed to load routing history", err);
          if(reloading) {
            // Keep what is on screen, and read it again on the next visit.
            stale.add(orderId);
          } else {
            this.statusByOrderId[orderId] = "error";
          }
        } finally {
          inFlight.delete(orderId);
        }
      })();
      inFlight.set(orderId, load);

      return load;
    },
  },
  persist: false,
});
