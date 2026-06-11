type SourceRecord = Record<string, any>;

export type FacilityInventoryRow = {
  facilityId: string;
  facilityName: string;
  allowBrokering: string;
  omsFulfillment: string;
  atp: number;
  qoh: number | null;
  safetyStock: number;
  available: number;
  orderLimit: number | null;
  consumedToday: number;
  remainingCapacity: number | null;
  searchText: string;
};

type NormalizeFacilityRowsOptions = {
  today?: string;
  facilityName?: (facilityId: string) => string;
  productFacilities: SourceRecord[];
  productStoreFacilities?: SourceRecord[];
  facilityGroups?: SourceRecord[];
  facilityGroupMembers?: SourceRecord[];
  inventoryItems?: SourceRecord[];
  facilityOrderCounts?: SourceRecord[];
};

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumByFacility(records: SourceRecord[], field: string): Map<string, number> {
  return records.reduce((totals, record) => {
    const facilityId = record.facilityId;
    const value = toNumber(record[field]);
    if (!facilityId || value === null) return totals;
    totals.set(facilityId, (totals.get(facilityId) ?? 0) + value);
    return totals;
  }, new Map<string, number>());
}

function indexByFacility(records: SourceRecord[] = []) {
  return records.reduce((index, record) => {
    if (record.facilityId) index.set(record.facilityId, record);
    return index;
  }, new Map<string, SourceRecord>());
}

function isFulfillmentGroup(group: SourceRecord) {
  return group.facilityGroupTypeId === 'FULFILLMENT' || group.facilityGroupId === 'OMS_FULFILLMENT';
}

function entryDateMatches(record: SourceRecord, today?: string) {
  if (!today || !record.entryDate) return true;
  return String(record.entryDate).slice(0, 10) === today;
}

export function normalizeFacilityRows(options: NormalizeFacilityRowsOptions): FacilityInventoryRow[] {
  const {
    today,
    productFacilities,
    productStoreFacilities = [],
    facilityGroups = [],
    facilityGroupMembers = [],
    inventoryItems = [],
    facilityOrderCounts = []
  } = options;

  const facilityName = options.facilityName ?? ((facilityId: string) => facilityId);
  const productStoreFacilityById = indexByFacility(productStoreFacilities);
  const storeScoped = productStoreFacilityById.size > 0;
  const qohByFacility = sumByFacility(inventoryItems, 'quantityOnHandTotal');
  const inventoryAtpByFacility = sumByFacility(inventoryItems, 'availableToPromiseTotal');
  const fulfillmentGroupIds = new Set(facilityGroups.filter(isFulfillmentGroup).map((group) => group.facilityGroupId));
  const fulfillmentFacilityIds = new Set(
    facilityGroupMembers
      .filter((member) => fulfillmentGroupIds.has(member.facilityGroupId))
      .map((member) => member.facilityId)
  );
  const orderCountByFacility = facilityOrderCounts
    .filter((record) => entryDateMatches(record, today))
    .reduce((counts, record) => {
      const count = toNumber(record.lastOrderCount) ?? 0;
      if (record.facilityId) counts.set(record.facilityId, count);
      return counts;
    }, new Map<string, number>());

  return productFacilities
    .filter((productFacility) => productFacility.facilityId && (!storeScoped || productStoreFacilityById.has(productFacility.facilityId)))
    .map((productFacility) => {
      const facilityId = productFacility.facilityId;
      const storeFacility = productStoreFacilityById.get(facilityId) ?? {};
      const name = storeFacility.facilityName || productFacility.facilityName || facilityName(facilityId);
      const safetyStock = toNumber(productFacility.minimumStock) ?? 0;
      const atp = toNumber(productFacility.lastInventoryCount)
        ?? toNumber(productFacility.availableToPromiseTotal)
        ?? inventoryAtpByFacility.get(facilityId)
        ?? 0;
      const computedAvailable = toNumber(productFacility.computedLastInventoryCount);
      const available = computedAvailable !== null ? computedAvailable : Math.max(atp - safetyStock, 0);
      const qoh = qohByFacility.has(facilityId) ? qohByFacility.get(facilityId)! : null;
      const orderLimit = toNumber(storeFacility.maximumOrderLimit) ?? toNumber(productFacility.maximumOrderLimit);
      const consumedToday = orderCountByFacility.get(facilityId) ?? 0;

      return {
        facilityId,
        facilityName: name,
        allowBrokering: productFacility.allowBrokering || 'Y',
        omsFulfillment: fulfillmentFacilityIds.has(facilityId) ? 'Y' : 'N',
        atp,
        qoh,
        safetyStock,
        available,
        orderLimit,
        consumedToday,
        remainingCapacity: orderLimit === null ? null : Math.max(orderLimit - consumedToday, 0),
        searchText: `${name} ${facilityId}`.toLowerCase()
      };
    });
}

export function filterFacilityRows(rows: FacilityInventoryRow[], query: string) {
  const search = query.trim().toLowerCase();
  if (!search) return rows;
  return rows.filter((row) => {
    const rowText = (row.searchText || `${row.facilityName} ${row.facilityId}`).toLowerCase();
    return rowText.includes(search);
  });
}

export function sortFacilityRows(rows: FacilityInventoryRow[]) {
  return [...rows].sort((left, right) => {
    const leftAvailable = left.available > 0 ? 0 : 1;
    const rightAvailable = right.available > 0 ? 0 : 1;
    if (leftAvailable !== rightAvailable) return leftAvailable - rightAvailable;
    if (left.available !== right.available) return right.available - left.available;
    return (left.facilityName || left.facilityId).localeCompare(right.facilityName || right.facilityId, undefined, { numeric: true });
  });
}
