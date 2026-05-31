import Dexie, { type Table } from "dexie";

export interface ProductIdentification {
  type: string;
  value: string;
}

export interface CachedProduct {
  productId: string;
  productName: string;
  sku: string;
  parentProductName: string;
  internalName: string;
  mainImageUrl: string;
  goodIdentifications: ProductIdentification[];
  updatedAt: number;
}

/**
 * Multi-tenant product database. One Dexie DB per OMS instance (`${oms}-CommonDB`), so the
 * product caches for multiple OMS coexist and logout never drops product data — mirrors the
 * inventory-count app (which names the DB by OMS for exactly this reason). On logout we only
 * clear the in-memory mirror in the productCache store; the Dexie data stays for next login.
 */
export class CommonDB extends Dexie {
  products!: Table<CachedProduct, string>;

  constructor(omsInstance: string) {
    super(`${omsInstance}-CommonDB`);
    this.version(1).stores({
      products: "productId, updatedAt"
    });
  }
}

let db: CommonDB | null = null;
let currentOms = "";

/** Get the Dexie DB for an OMS instance, (re)creating it only when the OMS changes. */
export function getProductDb(omsInstance: string): CommonDB {
  if (!db || currentOms !== omsInstance) {
    db = new CommonDB(omsInstance);
    currentOms = omsInstance;
  }
  return db;
}
