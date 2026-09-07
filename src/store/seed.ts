import { defineStore } from "pinia";
import { liveQuery } from "dexie";
import { api, commonUtil, logger } from "@common";
import { getOrderManagerDb } from "@/cache/appCacheDb";

/** The cache for the signed-in OMS. Resolved per call so reads follow an instance switch. */
const currentDb = () => getOrderManagerDb(commonUtil.getOMSInstanceName());

type LoadStatus = "idle" | "loading" | "loaded" | "error";

type SeedDatasetState<T = any> = {
  byId: Record<string, T>;
  ids: string[];
  status: LoadStatus;
  loadedAt: string;
  error: string;
};

const statusTypeIds = [
  "ORDER_STATUS",
  "ORDER_ITEM_STATUS",
  "SHIPMENT_STATUS",
  "ORDER_RETURN_STTS",
  "PAYMENT_PREF_STATUS",
  "COM_EVENT_STATUS",
  "PARTY_STATUS",
  "WORK_EFFORT_STATUS"
];

const enumTypeIds = [
  "ORDER_SALES_CHANNEL",
  "RETURN_CHANNEL",
  "ORDER_IDENTITY",
  "ORDER_RISK_LEVEL",
  "ORDER_RISK_RECOMMENDATION",
  "RISK_FACT_SENTIMENT",
  "PP_SORT_PARAM_TYPE",
  "PP_FILTER_PRM_TYPE",
  "WorkEffortType",
  // Reasons behind the order timeline's facility-change and cancellation entries.
  // OMS stores these as bare enum ids on OrderFacilityChange.changeReasonEnumId and
  // OrderStatus.changeReason, so without them the timeline shows "AUTO_CANCEL".
  "BROKERING_REASN_TYPE",
  "INT_ORD_CANCL_REASON",
  "ORDER_CANCEL_REASON",
  "ODR_ITM_CH_REASON"
];

const geoTypeEnumIds = ["GEOT_COUNTRY", "GEOT_STATE", "GEOT_PROVINCE"];

const carrierLabel = (carrier: any) => [carrier.firstName, carrier.lastName].filter(Boolean).join(" ") || carrier.groupName || carrier.partyId;
const dataset = <T = any>(): SeedDatasetState<T> => ({ byId: {}, ids: [], status: "idle", loadedAt: "", error: "" });
const responseList = (data: any) => Array.isArray(data) ? data : data?.entityValueList || data?.docs || data?.list || data?.items || [];
const compositeKey = (item: any, fields: string[]) => fields.map((field) => item?.[field]).filter(Boolean).join("::");
const firstValue = (item: any, fields: string[]) => fields.map((field) => item?.[field]).find(Boolean) || "";

function setDataset<T = any>(target: SeedDatasetState<T>, records: T[], keyFn: (record: T) => string) {
  const byId: Record<string, T> = {};
  const ids: string[] = [];

  records.forEach((record) => {
    const id = keyFn(record);
    if (!id) return;
    byId[id] = record;
    ids.push(id);
  });

  target.byId = byId;
  target.ids = ids;
  target.status = "loaded";
  target.loadedAt = new Date().toISOString();
  target.error = "";
}

function setDatasetError(target: SeedDatasetState, error: any) {
  target.status = "error";
  target.error = error?.message || "Failed to load seed data";
}

function itemDescription(item: any, id: string, fields = ["description", "enumName", "name"]) {
  return firstValue(item, fields) || id;
}

function findStatus(state: any, statusId: string) {
  return Object.values(state.statusesByType)
    .flatMap((statusDataset: any) => statusDataset.ids.map((id: string) => statusDataset.byId[id]))
    .find((status: any) => status?.statusId === statusId);
}

function findEnum(state: any, enumId: string) {
  return Object.values(state.enumsByType)
    .flatMap((enumDataset: any) => enumDataset.ids.map((id: string) => enumDataset.byId[id]))
    .find((enumeration: any) => enumeration?.enumId === enumId);
}

export const useSeedStore = defineStore("seed", {
  state: () => ({
    productStores: dataset(),
    productStoreSettingsByStoreId: {} as Record<string, SeedDatasetState>,
    productStoreFacilitiesByStoreId: {} as Record<string, SeedDatasetState>,
    productStoreFacilityGroupsByStoreId: {} as Record<string, SeedDatasetState>,
    productStoreShipmentMethodsByStoreId: {} as Record<string, SeedDatasetState>,
    productStoreEmailSettings: dataset(),

    statusesByType: {} as Record<string, SeedDatasetState>,
    enumsByType: {} as Record<string, SeedDatasetState>,
    enumChildTypesByParent: {} as Record<string, string[]>,
    statusFlowTransitions: dataset(),

    facilities: dataset(),
    facilityTypes: dataset(),
    facilityGroups: dataset(),
    facilityGroupMembers: dataset(),

    paymentMethodTypes: dataset(),
    contactMechPurposeTypes: dataset(),
    communicationEventTypes: dataset(),
    returnReasons: dataset(),
    returnTypes: dataset(),
    returnItemTypes: dataset(),
    roleTypes: dataset(),
    orderAdjustmentTypes: dataset(),
    geos: dataset(),

    carriers: dataset(),
    shipmentMethodTypes: dataset(),
    carrierShipmentMethods: dataset(),
    shopifyShops: dataset(),
    shopifyShopLocations: dataset(),
    partyRelationshipTypes: dataset(),
    geoAssocsByCountry: {} as Record<string, { ids: string[]; status: LoadStatus }>
  }),
  getters: {
    getStatusItemsByType: (state) => (typeId: string) => {
      const statusDataset = state.statusesByType[typeId];
      return statusDataset ? statusDataset.ids.map((id) => statusDataset.byId[id]) : [];
    },
    getEnumsByType: (state) => (typeId: string) => {
      const enumDataset = state.enumsByType[typeId];
      return enumDataset ? enumDataset.ids.map((id) => enumDataset.byId[id]) : [];
    },
    /** Returns all Enumeration records belonging to child types of the given parentTypeId. */
    getEnumsByParentType: (state) => (parentTypeId: string) => {
      const childTypeIds = state.enumChildTypesByParent[parentTypeId] ?? [];
      return childTypeIds.flatMap((childTypeId) => {
        const dataset = state.enumsByType[childTypeId];
        return dataset ? dataset.ids.map((id) => dataset.byId[id]) : [];
      });
    },
    productStore: (state) => (productStoreId: string) => state.productStores.byId[productStoreId],
    productStoreName: (state) => (productStoreId: string) => itemDescription(state.productStores.byId[productStoreId], productStoreId, ["storeName", "companyName"]),
    status: (state) => (statusId: string) => findStatus(state, statusId),
    statusAge: (state) => (statusId: string): number => Number(findStatus(state, statusId)?.statusAge ?? 0),
    statusDescription: (state) => (statusId: string) => itemDescription(findStatus(state, statusId), statusId),
    enumDescription: (state) => (enumId: string) => itemDescription(findEnum(state, enumId), enumId),
    describe: (state) => (id: string): string => {
      if (!id) return "";
      const status = findStatus(state, id);
      if (status) return itemDescription(status, id);
      const enumeration = findEnum(state, id);
      if (enumeration) return itemDescription(enumeration, id);
      const lookups: SeedDatasetState[] = [
        state.contactMechPurposeTypes, state.roleTypes, state.paymentMethodTypes,
        state.communicationEventTypes, state.returnReasons, state.returnTypes,
        state.returnItemTypes, state.orderAdjustmentTypes, state.shipmentMethodTypes,
        state.facilityTypes, state.partyRelationshipTypes
      ];
      for (const lookup of lookups) {
        if (lookup.byId[id]) return itemDescription(lookup.byId[id], id);
      }
      return id;
    },
    facility: (state) => (facilityId: string) => state.facilities.byId[facilityId],
    facilityName: (state) => (facilityId: string) => itemDescription(state.facilities.byId[facilityId], facilityId, ["facilityName", "facilityId"]),
    facilityType: (state) => (facilityTypeId: string) => state.facilityTypes.byId[facilityTypeId],
    shipmentMethod: (state) => (shipmentMethodTypeId: string) => state.shipmentMethodTypes.byId[shipmentMethodTypeId],
    shipmentMethodDescription: (state) => (shipmentMethodTypeId: string) => itemDescription(state.shipmentMethodTypes.byId[shipmentMethodTypeId], shipmentMethodTypeId, ["description", "shipmentMethodTypeId"]),
    carrier: (state) => (partyId: string) => state.carriers.byId[partyId],
    carrierName: (state) => (partyId: string) => state.carriers.byId[partyId] ? carrierLabel(state.carriers.byId[partyId]) : partyId,
    shippingMethodsByCarrier: (state) => (carrierPartyId: string) => {
      if (!carrierPartyId) return [];
      return Object.values(state.carrierShipmentMethods.byId).filter((m: any) => m.partyId === carrierPartyId);
    },
    paymentMethodDescription: (state) => (paymentMethodTypeId: string) => itemDescription(state.paymentMethodTypes.byId[paymentMethodTypeId], paymentMethodTypeId),
    contactPurposeDescription: (state) => (contactMechPurposeTypeId: string) => itemDescription(state.contactMechPurposeTypes.byId[contactMechPurposeTypeId], contactMechPurposeTypeId),
    communicationEventTypeDescription: (state) => (communicationEventTypeId: string) => itemDescription(state.communicationEventTypes.byId[communicationEventTypeId], communicationEventTypeId),
    returnReasonDescription: (state) => (returnReasonId: string) => itemDescription(state.returnReasons.byId[returnReasonId], returnReasonId),
    returnTypeDescription: (state) => (returnTypeId: string) => itemDescription(state.returnTypes.byId[returnTypeId], returnTypeId),
    returnItemTypeDescription: (state) => (returnItemTypeId: string) => itemDescription(state.returnItemTypes.byId[returnItemTypeId], returnItemTypeId),
    roleTypeDescription: (state) => (roleTypeId: string) => itemDescription(state.roleTypes.byId[roleTypeId], roleTypeId),
    orderAdjustmentTypeDescription: (state) => (orderAdjustmentTypeId: string) => itemDescription(state.orderAdjustmentTypes.byId[orderAdjustmentTypeId], orderAdjustmentTypeId),
    orderIdentificationTypeDescription: (state) => (orderIdentificationTypeId: string) => itemDescription(findEnum(state, orderIdentificationTypeId), orderIdentificationTypeId),
    orderIdentificationTypeOptions: (state) => {
      const typeDataset = state.enumsByType.ORDER_IDENTITY;
      if (!typeDataset) return [];
      return typeDataset.ids.map((enumId) => ({
        enumId,
        description: itemDescription(typeDataset.byId[enumId], enumId)
      }));
    },
    geoName: (state) => (geoId: string) => itemDescription(state.geos.byId[geoId], geoId, ["geoName"]),
    getGeoIdByCode: (state) => (code: string) => {
      if (!code) return '';
      const match = state.geos.ids
        .map((id) => state.geos.byId[id])
        .find((geo) => geo.geoCodeAlpha2 === code || geo.geoCode === code);
      return match?.geoId ?? '';
    },
    getCountries: (state) => state.geos.ids
      .map((id) => state.geos.byId[id])
      .filter((geo) => geo.geoTypeEnumId === "GEOT_COUNTRY")
      .sort((a, b) => (a.geoName || "").localeCompare(b.geoName || "")),
    getStates: (state) => state.geos.ids
      .map((id) => state.geos.byId[id])
      .filter((geo) => geo.geoTypeEnumId === "GEOT_STATE" || geo.geoTypeEnumId === "GEOT_PROVINCE")
      .sort((a, b) => (a.geoName || "").localeCompare(b.geoName || "")),
    getStatesForCountry: (state) => (countryGeoId: string) => {
      const assoc = state.geoAssocsByCountry[countryGeoId];
      if (!assoc?.ids.length) return [];
      return assoc.ids
        .map((id) => state.geos.byId[id])
        .filter(Boolean)
        .sort((a, b) => (a.geoName || "").localeCompare(b.geoName || ""));
    },
    geoAssocStatus: (state) => (countryGeoId: string): LoadStatus =>
      state.geoAssocsByCountry[countryGeoId]?.status || "idle",
    getCarrierOptions: (state) => state.carriers.ids.map((partyId) => ({ id: partyId, label: carrierLabel(state.carriers.byId[partyId]) })),
    getShipmentMethodOptions: (state) => state.shipmentMethodTypes.ids.map((shipmentMethodTypeId) => ({
      id: shipmentMethodTypeId,
      label: itemDescription(state.shipmentMethodTypes.byId[shipmentMethodTypeId], shipmentMethodTypeId, ["description", "shipmentMethodTypeId"])
    })),
    getProductStoreShipmentMethodOptions: (state) => (productStoreId: string) => {
      const storeDataset = state.productStoreShipmentMethodsByStoreId[productStoreId];
      if (!storeDataset) return [];

      return storeDataset.ids.map((id) => {
        const method = storeDataset.byId[id];
        const shipmentMethodTypeId = method.shipmentMethodTypeId || "";
        const shipmentMethod = state.shipmentMethodTypes.byId[shipmentMethodTypeId];

        return {
          id: shipmentMethodTypeId,
          label: method.description || itemDescription(shipmentMethod, shipmentMethodTypeId, ["description", "shipmentMethodTypeId"]),
          carrierPartyId: method.partyId || method.carrierPartyId
        };
      });
    },
    allowedTransitions: (state) => (statusId: string) => {
      return state.statusFlowTransitions.ids
        .map((id) => state.statusFlowTransitions.byId[id])
        .filter((transition: any) => transition.statusId === statusId)
        .map((transition: any) => {
          const toStatusDescription = itemDescription(findStatus(state, transition.toStatusId), transition.toStatusId);
          return {
            ...transition,
            toStatusDescription,
            toStatusColor: commonUtil.getStatusColor(toStatusDescription)
          };
        })
        .sort((left: any, right: any) => {
          const leftSequence = left.transitionSequence ?? Number.MAX_SAFE_INTEGER;
          const rightSequence = right.transitionSequence ?? Number.MAX_SAFE_INTEGER;
          if (leftSequence !== rightSequence) return leftSequence - rightSequence;
          return (left.toStatusId || "").localeCompare(right.toStatusId || "");
        });
    }
  },
  actions: {
    async initSeedCache() {
      await this.populateFromCache();
      this.subscribeToCacheUpdates();
    },
    async populateFromCache() {
      try {
        const orderManagerDb = currentDb();
        const [
          productStores,
          statuses,
          enums,
          enumTypes,
          facilities,
          facilityTypes,
          facilityGroups,
          groupFacilities,
          geos,
          carriers,
          shipmentMethodTypes,
          carrierShipmentMethods,
          paymentMethodTypes,
          returnReasons,
          returnTypes,
          returnItemTypes,
          roleTypes,
          orderAdjustmentTypes,
          contactMechPurposeTypes,
          communicationEventTypes,
          partyRelationshipTypes,
          statusFlowTransitions,
          shopifyShops,
          shopifyShopLocations,
          productStoreFacilities,
          productStoreFacilityGroups,
          productStoreShipmentMethods,
          productStoreEmailSettings,
          geoAssocs,
        ] = await Promise.all([
          orderManagerDb.table("productStores").toArray(),
          orderManagerDb.table("statuses").toArray(),
          orderManagerDb.table("enums").toArray(),
          orderManagerDb.table("enumTypes").toArray(),
          orderManagerDb.table("facilities").toArray(),
          orderManagerDb.table("facilityTypes").toArray(),
          orderManagerDb.table("facilityGroups").toArray(),
          orderManagerDb.table("groupFacilities").toArray(),
          orderManagerDb.table("geos").toArray(),
          orderManagerDb.table("carriers").toArray(),
          orderManagerDb.table("shipmentMethodTypes").toArray(),
          orderManagerDb.table("carrierShipmentMethods").toArray(),
          orderManagerDb.table("paymentMethodTypes").toArray(),
          orderManagerDb.table("returnReasons").toArray(),
          orderManagerDb.table("returnTypes").toArray(),
          orderManagerDb.table("returnItemTypes").toArray(),
          orderManagerDb.table("roleTypes").toArray(),
          orderManagerDb.table("orderAdjustmentTypes").toArray(),
          orderManagerDb.table("contactMechPurposeTypes").toArray(),
          orderManagerDb.table("communicationEventTypes").toArray(),
          orderManagerDb.table("partyRelationshipTypes").toArray(),
          orderManagerDb.table("statusFlowTransitions").toArray(),
          orderManagerDb.table("shopifyShops").toArray(),
          orderManagerDb.table("shopifyShopLocations").toArray(),
          orderManagerDb.table("productStoreFacilities").toArray(),
          orderManagerDb.table("productStoreFacilityGroups").toArray(),
          orderManagerDb.table("productStoreShipmentMethods").toArray(),
          orderManagerDb.table("productStoreEmailSettings").toArray(),
          orderManagerDb.table("geoAssocs").toArray(),
        ]);

        if (productStores.length) setDataset(this.productStores, productStores.map((r: any) => r.raw ?? r), (s: any) => s.productStoreId);
        if (facilities.length) setDataset(this.facilities, facilities.map((r: any) => r.raw ?? r), (f: any) => f.facilityId);
        if (facilityTypes.length) setDataset(this.facilityTypes, facilityTypes.map((r: any) => r.raw ?? r), (f: any) => f.facilityTypeId);
        if (facilityGroups.length) setDataset(this.facilityGroups, facilityGroups.map((r: any) => r.raw ?? r), (f: any) => f.facilityGroupId);
        if (groupFacilities.length) setDataset(this.facilityGroupMembers, groupFacilities.map((r: any) => r.raw ?? r), (g: any) => g.memberKey || `${g.facilityGroupId}|${g.facilityId}`);
        if (geos.length) setDataset(this.geos, geos.map((r: any) => r.raw ?? r), (g: any) => g.geoId);
        if (carriers.length) setDataset(this.carriers, carriers.map((r: any) => r.raw ?? r), (c: any) => c.partyId);
        if (shipmentMethodTypes.length) setDataset(this.shipmentMethodTypes, shipmentMethodTypes.map((r: any) => r.raw ?? r), (s: any) => s.shipmentMethodTypeId);
        if (carrierShipmentMethods.length) setDataset(this.carrierShipmentMethods, carrierShipmentMethods.map((r: any) => r.raw ?? r), (c: any) => c.carrierShipmentMethodKey || `${c.partyId}|${c.shipmentMethodTypeId}`);
        if (paymentMethodTypes.length) setDataset(this.paymentMethodTypes, paymentMethodTypes.map((r: any) => r.raw ?? r), (p: any) => p.paymentMethodTypeId);
        if (returnReasons.length) setDataset(this.returnReasons, returnReasons.map((r: any) => r.raw ?? r), (r: any) => r.returnReasonId);
        if (returnTypes.length) setDataset(this.returnTypes, returnTypes.map((r: any) => r.raw ?? r), (r: any) => r.returnTypeId);
        if (returnItemTypes.length) setDataset(this.returnItemTypes, returnItemTypes.map((r: any) => r.raw ?? r), (r: any) => r.returnItemTypeId);
        if (roleTypes.length) setDataset(this.roleTypes, roleTypes.map((r: any) => r.raw ?? r), (r: any) => r.roleTypeId);
        if (orderAdjustmentTypes.length) setDataset(this.orderAdjustmentTypes, orderAdjustmentTypes.map((r: any) => r.raw ?? r), (o: any) => o.orderAdjustmentTypeId);
        if (contactMechPurposeTypes.length) setDataset(this.contactMechPurposeTypes, contactMechPurposeTypes.map((r: any) => r.raw ?? r), (c: any) => c.contactMechPurposeTypeId);
        if (communicationEventTypes.length) setDataset(this.communicationEventTypes, communicationEventTypes.map((r: any) => r.raw ?? r), (c: any) => c.communicationEventTypeId);
        if (partyRelationshipTypes.length) setDataset(this.partyRelationshipTypes, partyRelationshipTypes.map((r: any) => r.raw ?? r), (p: any) => p.partyRelationshipTypeId);
        if (statusFlowTransitions.length) setDataset(this.statusFlowTransitions, statusFlowTransitions.map((r: any) => r.raw ?? r), (t: any) => t.transitionKey || `${t.statusId}|${t.toStatusId}`);
        if (shopifyShops.length) setDataset(this.shopifyShops, shopifyShops.map((r: any) => r.raw ?? r), (s: any) => s.shopId);
        if (shopifyShopLocations.length) setDataset(this.shopifyShopLocations, shopifyShopLocations.map((r: any) => r.raw ?? r), (s: any) => s.locationKey || `${s.shopId}|${s.shopifyLocationId}`);
        if (productStoreEmailSettings.length) setDataset(this.productStoreEmailSettings, productStoreEmailSettings.map((r: any) => r.raw ?? r), (e: any) => e.emailSettingKey || `${e.productStoreId}|${e.emailTypeEnumId || e.emailType}`);

        if (productStoreFacilities.length) {
          const rawStoreFacilities = productStoreFacilities.map((r: any) => r.raw ?? r);
          const grouped: Record<string, any[]> = {};
          rawStoreFacilities.forEach((item: any) => {
            const storeId = item.productStoreId || "UNKNOWN";
            if (!grouped[storeId]) grouped[storeId] = [];
            grouped[storeId].push(item);
          });
          Object.entries(grouped).forEach(([storeId, items]) => {
            const target = this.scopedDataset(this.productStoreFacilitiesByStoreId, storeId);
            setDataset(target, items, (f: any) => f.facilityId);
          });
        }

        if (productStoreFacilityGroups.length) {
          const rawStoreGroups = productStoreFacilityGroups.map((r: any) => r.raw ?? r);
          const grouped: Record<string, any[]> = {};
          rawStoreGroups.forEach((item: any) => {
            const storeId = item.productStoreId || "UNKNOWN";
            if (!grouped[storeId]) grouped[storeId] = [];
            grouped[storeId].push(item);
          });
          Object.entries(grouped).forEach(([storeId, items]) => {
            const target = this.scopedDataset(this.productStoreFacilityGroupsByStoreId, storeId);
            setDataset(target, items, (g: any) => g.facilityGroupId);
          });
        }

        if (productStoreShipmentMethods.length) {
          const rawStoreMethods = productStoreShipmentMethods.map((r: any) => r.raw ?? r);
          const grouped: Record<string, any[]> = {};
          rawStoreMethods.forEach((item: any) => {
            const storeId = item.productStoreId || "UNKNOWN";
            if (!grouped[storeId]) grouped[storeId] = [];
            grouped[storeId].push(item);
          });
          Object.entries(grouped).forEach(([storeId, items]) => {
            const target = this.scopedDataset(this.productStoreShipmentMethodsByStoreId, storeId);
            setDataset(target, items, (m: any) => m.storeShipmentMethodKey || `${m.productStoreId}|${m.shipmentMethodTypeId}`);
          });
        }

        if (geoAssocs.length) {
          const rawAssocs = geoAssocs.map((r: any) => r.raw ?? r);
          const byCountry: Record<string, string[]> = {};
          rawAssocs.forEach((a: any) => {
            const countryId = a.geoId;
            const stateId = a.toGeoId;
            if (countryId && stateId) {
              if (!byCountry[countryId]) byCountry[countryId] = [];
              if (!byCountry[countryId].includes(stateId)) {
                byCountry[countryId].push(stateId);
              }
            }
          });
          Object.entries(byCountry).forEach(([countryId, stateIds]) => {
            this.geoAssocsByCountry[countryId] = { ids: stateIds, status: "loaded" };
          });
        }

        if (enumTypes.length) {
          const rawTypes = enumTypes.map((r: any) => r.raw ?? r);
          const byParent: Record<string, string[]> = {};
          rawTypes.forEach((t: any) => {
            if (t.parentTypeId && t.enumTypeId) {
              if (!byParent[t.parentTypeId]) byParent[t.parentTypeId] = [];
              if (!byParent[t.parentTypeId].includes(t.enumTypeId)) {
                byParent[t.parentTypeId].push(t.enumTypeId);
              }
            }
          });
          this.enumChildTypesByParent = { ...this.enumChildTypesByParent, ...byParent };
        }

        if (statuses.length) {
          const rawStatuses = statuses.map((r: any) => r.raw ?? r);
          const grouped: Record<string, any[]> = {};
          rawStatuses.forEach((st: any) => {
            const type = st.statusTypeId || "UNKNOWN";
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(st);
          });
          Object.entries(grouped).forEach(([type, items]) => {
            const target = this.scopedDataset(this.statusesByType, type);
            setDataset(target, items, (s: any) => s.statusId);
          });
        }

        if (enums.length) {
          const rawEnums = enums.map((r: any) => r.raw ?? r);
          const grouped: Record<string, any[]> = {};
          rawEnums.forEach((en: any) => {
            const type = en.enumTypeId || "UNKNOWN";
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(en);
          });
          Object.entries(grouped).forEach(([type, items]) => {
            const target = this.scopedDataset(this.enumsByType, type);
            setDataset(target, items, (e: any) => e.enumId);
          });
        }
      } catch (error) {
        logger.warn("[seedStore] Error populating from cache:", error);
      }
    },
    subscribeToCacheUpdates() {
      if (typeof BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel("hotwax-cache-sync");
          channel.onmessage = () => {
            this.populateFromCache();
          };
        } catch {
          // Ignore
        }
      }
      try {
        liveQuery(() => currentDb().table("statuses").count()).subscribe({ next: () => this.populateFromCache() });
        liveQuery(() => currentDb().table("geos").count()).subscribe({ next: () => this.populateFromCache() });
        liveQuery(() => currentDb().table("facilities").count()).subscribe({ next: () => this.populateFromCache() });
      } catch {
        // Safe fallback in test environments without liveQuery BroadcastChannel
      }
    },
    setProductStores(productStores: any[]) {
      setDataset(this.productStores, productStores.filter((store) => store.productStoreId), (store) => store.productStoreId);
    },
    // Persisted state can capture a dataset mid-load (status "loading") if the tab was closed
    // or reloaded during a previous load. loadDataset skips anything already "loading", so that
    // dataset would never refetch and its labels would stay unresolved. Demote stale transient
    // statuses back to "idle" (or "loaded" if data is present) before (re)loading. Safe from
    // double-fetch: loadInitialSeedData is only called by postLogin (fresh login) and the
    // authenticated-boot hook (reload) — never concurrently, since boot only fires when stores
    // are already persisted and postLogin only on a fresh login where they are not.
    resetTransientLoadStates() {
      const isDataset = (value: any) => value && typeof value === "object" && "status" in value && "ids" in value;
      const normalize = (dataset: any) => {
        if (isDataset(dataset) && dataset.status !== "loaded") {
          dataset.status = dataset.ids?.length ? "loaded" : "idle";
        }
      };
      Object.values(this.$state).forEach((value: any) => {
        if (isDataset(value)) normalize(value);
        else if (value && typeof value === "object") Object.values(value).forEach(normalize);
      });
    },
    async loadInitialSeedData(productStoreIds: string[]) {
      this.resetTransientLoadStates();
      const scopedProductStoreIds = [...new Set(productStoreIds.filter(Boolean))];

      await Promise.allSettled([
        this.loadProductStores(),
        ...statusTypeIds.map((statusTypeId) => this.loadStatusType(statusTypeId)),
        ...enumTypeIds.map((enumTypeId) => this.loadEnumType(enumTypeId)),
        this.loadStatusFlowTransitions(),
        this.loadFacilities(),
        this.loadFacilityTypes(),
        this.loadFacilityGroups(),
        this.loadFacilityGroupMembers(),
        this.loadPaymentMethodTypes(),
        this.loadContactMechPurposeTypes(),
        this.loadCommunicationEventTypes(),
        this.loadReturnReasons(),
        this.loadReturnTypes(),
        this.loadReturnItemTypes(),
        this.loadRoleTypes(),
        this.loadCarriers(),
        this.loadShipmentMethodTypes(),
        this.loadOrderAdjustmentTypes(),
        this.loadGeos(),
        this.loadProductStoreEmailSettings(),
        this.loadShopifyShops(),
        this.loadShopifyShopLocations(),
        ...scopedProductStoreIds.map((productStoreId) => this.loadProductStoreSeedData(productStoreId)),
        this.loadEnumsByParentType('WorkEffortPurposeType')
      ]);
    },
    async loadProductStoreSeedData(productStoreId: string) {
      if (!productStoreId) return;

      await Promise.allSettled([
        this.loadProductStoreSettings(productStoreId),
        this.loadProductStoreFacilities(productStoreId),
        this.loadProductStoreFacilityGroups(productStoreId),
        this.loadProductStoreShipmentMethods(productStoreId)
      ]);
    },
    async loadDataset(target: SeedDatasetState, request: any, keyFn: (record: any) => string) {
      if (target.status === "loaded" || target.status === "loading") return;

      target.status = "loading";
      target.error = "";

      try {
        const resp = await api(request);
        setDataset(target, responseList(resp.data), keyFn);
      } catch (error: any) {
        logger.error("Failed to load seed data", error);
        setDatasetError(target, error);
      }
    },
    async loadProductStores() {
      await this.loadDataset(this.productStores, {
        url: "admin/productStores",
        method: "GET",
        baseURL: commonUtil.getMaargURL()
      }, (store) => store.productStoreId);
    },
    async loadProductStoreSettings(productStoreId: string) {
      const target = this.scopedDataset(this.productStoreSettingsByStoreId, productStoreId);
      await this.loadDataset(target, {
        url: `admin/productStores/${productStoreId}/settings`,
        method: "GET",
        baseURL: commonUtil.getMaargURL()
      }, (setting) => compositeKey(setting, ["productStoreId", "settingTypeEnumId"]));
    },
    async loadProductStoreFacilities(productStoreId: string) {
      const target = this.scopedDataset(this.productStoreFacilitiesByStoreId, productStoreId);
      await this.loadDataset(target, {
        url: `admin/productStores/${productStoreId}/facilities`,
        method: "GET",
        baseURL: commonUtil.getMaargURL()
      }, (facility) => compositeKey(facility, ["productStoreId", "facilityId"]));
    },
    async loadProductStoreFacilityGroups(productStoreId: string) {
      const target = this.scopedDataset(this.productStoreFacilityGroupsByStoreId, productStoreId);
      await this.loadDataset(target, {
        url: `admin/productStores/${productStoreId}/facilityGroups`,
        method: "GET",
        baseURL: commonUtil.getMaargURL()
      }, (group) => compositeKey(group, ["productStoreId", "facilityGroupId"]));
    },
    async loadProductStoreShipmentMethods(productStoreId: string) {
      const target = this.scopedDataset(this.productStoreShipmentMethodsByStoreId, productStoreId);
      await this.loadDataset(target, {
        url: `oms/productStores/${productStoreId}/shipmentMethods`,
        method: "GET",
        params: { pageSize: 250 }
      }, (method) => compositeKey(method, ["productStoreId", "shipmentMethodTypeId", "partyId", "carrierPartyId"]));
    },
    async loadStatusType(statusTypeId: string) {
      const target = this.scopedDataset(this.statusesByType, statusTypeId);
      await this.loadDataset(target, {
        url: "admin/status",
        method: "GET",
        params: { statusTypeId, pageSize: 500 }
      }, (status) => status.statusId);
    },
    async loadEnumType(enumTypeId: string) {
      const target = this.scopedDataset(this.enumsByType, enumTypeId);
      await this.loadDataset(target, {
        url: "admin/enums",
        method: "GET",
        params: { enumTypeId, pageSize: 500, orderByField: "sequenceNum" }
      }, (enumeration) => enumeration.enumId);
    },
    async createOrderIdentificationType(payload: { enumId: string; description: string }) {
      await api({
        url: "admin/enums",
        method: "POST",
        data: { ...payload, enumTypeId: "ORDER_IDENTITY" }
      });
      const target = this.scopedDataset(this.enumsByType, "ORDER_IDENTITY");
      target.status = "idle";
      await this.loadEnumType("ORDER_IDENTITY");
    },
    async loadEnumsByParentType(parentTypeId: string) {
      const resp = await api({ url: 'admin/enumTypes', method: 'GET', params: { parentTypeId, pageSize: 200 } });
      const childTypes: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.enumTypeList ?? resp.data?.docs ?? []);
      const childTypeIds = childTypes.map((t: any) => t.enumTypeId).filter(Boolean);
      this.enumChildTypesByParent[parentTypeId] = childTypeIds;
      await Promise.all(childTypeIds.map((typeId: string) => this.loadEnumType(typeId)));
    },
    async loadStatusFlowTransitions() {
      await this.loadDataset(this.statusFlowTransitions, {
        url: "admin/statusFlows/transitions",
        method: "GET",
        params: { pageSize: 1000 }
      }, (transition) => compositeKey(transition, ["statusFlowId", "statusId", "toStatusId", "transitionName"]));
    },
    async loadFacilities() {
      await this.loadDataset(this.facilities, { url: "oms/facilities", method: "GET", params: { pageSize: 1000 } }, (facility) => facility.facilityId);
    },
    async loadFacilityTypes() {
      await this.loadDataset(this.facilityTypes, { url: "oms/facilityTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.facilityTypeId);
    },
    async loadFacilityGroups() {
      await this.loadDataset(this.facilityGroups, { url: "oms/facilityGroups", method: "GET", params: { pageSize: 1000 } }, (group) => group.facilityGroupId);
    },
    async loadFacilityGroupMembers() {
      await this.loadDataset(this.facilityGroupMembers, { url: "oms/groupFacilities", method: "GET", params: { pageSize: 1000 } }, (member) => compositeKey(member, ["facilityGroupId", "facilityId", "fromDate"]));
    },
    async loadPaymentMethodTypes() {
      await this.loadDataset(this.paymentMethodTypes, { url: "oms/paymentMethodTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.paymentMethodTypeId);
    },
    async loadContactMechPurposeTypes() {
      await this.loadDataset(this.contactMechPurposeTypes, { url: "oms/contactMechPurposeTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.contactMechPurposeTypeId);
    },
    async loadCommunicationEventTypes() {
      await this.loadDataset(this.communicationEventTypes, { url: "oms/communicationEventTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.communicationEventTypeId);
    },
    async loadReturnReasons() {
      await this.loadDataset(this.returnReasons, { url: "oms/returnReasons", method: "GET", params: { pageSize: 500 } }, (reason) => reason.returnReasonId);
    },
    async loadReturnTypes() {
      await this.loadDataset(this.returnTypes, { url: "oms/returnTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.returnTypeId);
    },
    async loadReturnItemTypes() {
      await this.loadDataset(this.returnItemTypes, { url: "oms/returnItemTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.returnItemTypeId);
    },
    async loadRoleTypes() {
      await this.loadDataset(this.roleTypes, { url: "oms/roleTypes", method: "GET", params: { pageSize: 500 } }, (type) => type.roleTypeId);
    },
    async loadCarriers() {
      await this.loadDataset(this.carriers, {
        url: "oms/shippingGateways/carrierParties",
        method: "GET",
        params: {
          roleTypeId: "CARRIER",
          fieldsToSelect: ["partyId", "partyTypeId", "roleTypeId", "firstName", "lastName", "groupName"],
          distinct: "Y",
          pageSize: 250,
          orderByField: "groupName"
        }
      }, (carrier) => carrier.partyId);
    },
    async loadShipmentMethodTypes() {
      await this.loadDataset(this.shipmentMethodTypes, {
        url: "oms/shippingGateways/shipmentMethodTypes",
        method: "GET",
        params: { pageSize: 250, orderByField: "description" }
      }, (method) => method.shipmentMethodTypeId);
    },
    async loadOrderAdjustmentTypes() {
      // Endpoint is (mis)placed under shippingGateways; see docs/MoquiChanges.md.
      await this.loadDataset(this.orderAdjustmentTypes, {
        url: "oms/shippingGateways/orderAdjustmentTypes",
        method: "GET",
        params: { pageSize: 500 }
      }, (type) => type.orderAdjustmentTypeId);
    },
    async loadGeos() {
      // Countries + states + provinces for address enrichment; see docs/GeoData.md.
      // If admin/geos ignores the geoTypeEnumId filter it returns all ~1388 rows (still fine).
      await this.loadDataset(this.geos, {
        url: "admin/geos",
        method: "GET",
        baseURL: commonUtil.getMaargURL(),
        params: { geoTypeEnumId: geoTypeEnumIds.join(","), geoTypeEnumId_op: "in", pageSize: 2000 }
      }, (geo) => geo.geoId);
    },
    async loadProductStoreEmailSettings() {
      await this.loadDataset(this.productStoreEmailSettings, {
        url: "oms/productStoreEmailSettings",
        method: "GET",
        params: { pageSize: 1000 }
      }, (setting) => compositeKey(setting, ["productStoreId", "emailType"]));
    },
    async loadShopifyShops() {
      await this.loadDataset(this.shopifyShops, { url: "oms/shopifyShops/shops", method: "GET", params: { pageSize: 1000 } }, (shop) => shop.shopId);
    },
    async loadShopifyShopLocations() {
      await this.loadDataset(this.shopifyShopLocations, { url: "oms/shopifyShops/locations", method: "GET", params: { pageSize: 1000 } }, (location) => compositeKey(location, ["shopId", "facilityId"]));
    },
    async loadGeoAssocs(countryGeoId: string) {
      if (!countryGeoId) return;
      const existing = this.geoAssocsByCountry[countryGeoId];
      if (existing?.status === "loaded" && existing.ids.length > 0) return;

      try {
        const cached = await currentDb().table("geoAssocs").where("geoId").equals(countryGeoId).toArray();
        if (cached && cached.length > 0) {
          this.geoAssocsByCountry[countryGeoId] = {
            ids: cached.map((r: any) => r.toGeoId || r.raw?.toGeoId).filter(Boolean),
            status: "loaded"
          };
          return;
        }
      } catch (err) {
        console.warn("Failed to query cached geoAssocs:", err);
      }

      if (!this.geoAssocsByCountry[countryGeoId]) {
        this.geoAssocsByCountry[countryGeoId] = { ids: [], status: "idle" };
      }
      this.geoAssocsByCountry[countryGeoId].status = "loading";

      try {
        const resp = await api({
          url: "admin/geos/assocs",
          method: "GET",
          baseURL: commonUtil.getMaargURL(),
          params: { geoId: countryGeoId, geoAssocTypeEnumId: "GAT_REGIONS", pageSize: 500 }
        });
        const rows: any[] = responseList(resp.data);
        this.geoAssocsByCountry[countryGeoId].ids = rows.map((r) => r.toGeoId).filter(Boolean);
        this.geoAssocsByCountry[countryGeoId].status = "loaded";
      } catch {
        this.geoAssocsByCountry[countryGeoId].status = "error";
      }
    },
    async loadPartyRelationshipTypes() {
      await this.loadDataset(this.partyRelationshipTypes, {
        url: "oms/partyRelationshipTypes",
        method: "GET",
        params: { pageSize: 500 }
      }, (type) => {
        // Normalize partyRelationshipName → description so describe() resolves it.
        if (type.partyRelationshipName && !type.description) type.description = type.partyRelationshipName;
        return type.partyRelationshipTypeId;
      });
    },
    scopedDataset(collection: Record<string, SeedDatasetState>, id: string) {
      if (!collection[id]) collection[id] = dataset();
      return collection[id];
    },
    resetSeedData() {
      this.$reset();
    }
  }
});
