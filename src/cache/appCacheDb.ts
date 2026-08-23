/**
 * Order Manager Dexie Database Instance & Cached Entities.
 */

import { BaseCacheDB, COMMON_CACHE_SCHEMA } from "@common/cache";

export class OrderManagerCacheDB extends BaseCacheDB {
  constructor() {
    super("OrderManagerCacheDB", COMMON_CACHE_SCHEMA);
  }
}

export const orderManagerDb = new OrderManagerCacheDB();
