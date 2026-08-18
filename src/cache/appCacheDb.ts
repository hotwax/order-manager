/**
 * Order Manager Dexie Database Instance & Cached Entities.
 */

import {
  BaseCacheDB,
  COMMON_CACHE_SCHEMA,
  carrierProjection,
  carrierShipmentMethodProjection,
  communicationEventTypeProjection,
  contactMechPurposeTypeProjection,
  defineCachedEntity,
  enumProjection,
  enumTypeProjection,
  facilityGroupProjection,
  facilityProjection,
  facilityTypeProjection,
  geoAssocProjection,
  geoProjection,
  groupFacilityProjection,
  orderAdjustmentTypeProjection,
  partyRelationshipTypeProjection,
  paymentMethodTypeProjection,
  productStoreFacilityGroupProjection,
  productStoreFacilityProjection,
  productStoreProjection,
  productStoreShipmentMethodProjection,
  returnItemTypeProjection,
  returnReasonProjection,
  returnTypeProjection,
  roleTypeProjection,
  shipmentMethodTypeProjection,
  shopifyShopLocationProjection,
  shopifyShopProjection,
  statusFlowTransitionProjection,
  statusProjection,
  type CachedEntity,
  type EntityProjection,
} from "@common/cache";

const ORDER_MANAGER_SCHEMA = {
  ...COMMON_CACHE_SCHEMA,
  productStoreEmailSettings: "emailSettingKey, productStoreId, emailTypeEnumId",
};

export class OrderManagerCacheDB extends BaseCacheDB {
  constructor() {
    super("OrderManagerCacheDB", ORDER_MANAGER_SCHEMA);
  }
}

export const orderManagerDb = new OrderManagerCacheDB();

// --- Standard OMS Entity Cache Handlers ---
export const productStoreCache = defineCachedEntity(orderManagerDb, "productStores", productStoreProjection);
export const statusCache = defineCachedEntity(orderManagerDb, "statuses", statusProjection);
export const enumCache = defineCachedEntity(orderManagerDb, "enums", enumProjection);
export const enumTypeCache = defineCachedEntity(orderManagerDb, "enumTypes", enumTypeProjection);
export const facilityCache = defineCachedEntity(orderManagerDb, "facilities", facilityProjection);
export const facilityTypeCache = defineCachedEntity(orderManagerDb, "facilityTypes", facilityTypeProjection);
export const facilityGroupCache = defineCachedEntity(orderManagerDb, "facilityGroups", facilityGroupProjection);
export const groupFacilityCache = defineCachedEntity(orderManagerDb, "groupFacilities", groupFacilityProjection);
export const geoCache = defineCachedEntity(orderManagerDb, "geos", geoProjection);
export const geoAssocCache = defineCachedEntity(orderManagerDb, "geoAssocs", geoAssocProjection);
export const carrierCache = defineCachedEntity(orderManagerDb, "carriers", carrierProjection);
export const shipmentMethodTypeCache = defineCachedEntity(orderManagerDb, "shipmentMethodTypes", shipmentMethodTypeProjection);
export const carrierShipmentMethodCache = defineCachedEntity(orderManagerDb, "carrierShipmentMethods", carrierShipmentMethodProjection);
export const paymentMethodTypeCache = defineCachedEntity(orderManagerDb, "paymentMethodTypes", paymentMethodTypeProjection);
export const returnReasonCache = defineCachedEntity(orderManagerDb, "returnReasons", returnReasonProjection);
export const returnTypeCache = defineCachedEntity(orderManagerDb, "returnTypes", returnTypeProjection);
export const returnItemTypeCache = defineCachedEntity(orderManagerDb, "returnItemTypes", returnItemTypeProjection);
export const roleTypeCache = defineCachedEntity(orderManagerDb, "roleTypes", roleTypeProjection);
export const orderAdjustmentTypeCache = defineCachedEntity(orderManagerDb, "orderAdjustmentTypes", orderAdjustmentTypeProjection);
export const contactMechPurposeTypeCache = defineCachedEntity(orderManagerDb, "contactMechPurposeTypes", contactMechPurposeTypeProjection);
export const communicationEventTypeCache = defineCachedEntity(orderManagerDb, "communicationEventTypes", communicationEventTypeProjection);
export const partyRelationshipTypeCache = defineCachedEntity(orderManagerDb, "partyRelationshipTypes", partyRelationshipTypeProjection);
export const statusFlowTransitionCache = defineCachedEntity(orderManagerDb, "statusFlowTransitions", statusFlowTransitionProjection);
export const productStoreFacilityCache = defineCachedEntity(orderManagerDb, "productStoreFacilities", productStoreFacilityProjection);
export const productStoreFacilityGroupCache = defineCachedEntity(orderManagerDb, "productStoreFacilityGroups", productStoreFacilityGroupProjection);
export const productStoreShipmentMethodCache = defineCachedEntity(orderManagerDb, "productStoreShipmentMethods", productStoreShipmentMethodProjection);
export const shopifyShopCache = defineCachedEntity(orderManagerDb, "shopifyShops", shopifyShopProjection);
export const shopifyShopLocationCache = defineCachedEntity(orderManagerDb, "shopifyShopLocations", shopifyShopLocationProjection);

// --- Order Manager Specific Projections & Entities ---
export const productStoreEmailSettingProjection: EntityProjection = {
  keyField: "emailSettingKey",
  fields: {
    emailSettingKey: "text",
    productStoreId: "text",
    emailTypeEnumId: "text",
    subject: "text",
    bodyScreenLocation: "text",
  },
  buildKey: (raw) => {
    if (!raw?.productStoreId || !raw?.emailTypeEnumId) return undefined;
    return `${raw.productStoreId}|${raw.emailTypeEnumId}`;
  },
};

export const productStoreEmailSettingCache = defineCachedEntity(orderManagerDb, "productStoreEmailSettings", productStoreEmailSettingProjection);
