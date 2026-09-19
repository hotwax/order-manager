type SourceRecord = Record<string, any>;

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function entryDateMatches(record: SourceRecord, today?: string) {
  if (!today || !record.entryDate) return true;
  return String(record.entryDate).slice(0, 10) === today;
}

export type FacilityCoverageItemInput = {
  orderItemSeqId: string;
  productId: string;
  name?: string;
  quantity?: number;
};

export type FacilityItemAvailability = {
  orderItemSeqId: string;
  productId: string;
  name: string;
  required: number;
  /** null when the facility has no ProductFacility record for the product. */
  available: number | null;
  atp: number | null;
  qoh: number | null;
  /** null when minimumStock is absent; availability still computes it as zero. */
  safetyStock: number | null;
  hasRecord: boolean;
  covered: boolean;
  shortBy: number;
};

export type FacilityCoverageRow = {
  facilityId: string;
  facilityName: string;
  allowBrokering: string;
  /** From the stored facility record: null is unlimited, zero is no capacity. */
  orderLimit: number | null;
  consumedToday: number;
  remainingCapacity: number | null;
  inStore: boolean;
  items: FacilityItemAvailability[];
  coveredCount: number;
  totalCount: number;
  minSurplus: number;
  searchText: string;
};

type BuildFacilityCoverageRowsOptions = {
  today?: string;
  facilities: SourceRecord[];
  items: FacilityCoverageItemInput[];
  productFacilities: SourceRecord[];
  inventoryItems?: SourceRecord[];
  facilityOrderCounts?: SourceRecord[];
  productStoreFacilities?: SourceRecord[];
  facilityName?: (facilityId: string) => string;
};

/**
 * A facility is physical unless it hangs off the virtual facility type. On the OMS instances we
 * work with, no facility carries VIRTUAL_FACILITY as its own type, so parentTypeId is what
 * actually separates the two.
 */
export function isPhysicalFacility(facility: SourceRecord) {
  return facility?.parentTypeId !== 'VIRTUAL_FACILITY' && facility?.facilityTypeId !== 'VIRTUAL_FACILITY';
}

function sumByKey(records: SourceRecord[], keyOf: (record: SourceRecord) => string | null, field: string) {
  return records.reduce((totals, record) => {
    const key = keyOf(record);
    const value = toNumber(record[field]);
    if (!key || value === null) return totals;
    totals.set(key, (totals.get(key) ?? 0) + value);
    return totals;
  }, new Map<string, number>());
}

function productFacilityKey(record: SourceRecord) {
  return record.productId && record.facilityId ? `${record.productId}|${record.facilityId}` : null;
}

/**
 * One row per facility, carrying how many of the selected order items that facility can cover.
 *
 * The row set is every facility passed in, stocked or not, so an operator never loses sight of a
 * facility they are allowed to release to. A facility with no ProductFacility record for a product
 * reports `hasRecord: false` and a null availability rather than a zero, because "we hold no
 * inventory record here" and "we counted zero units here" are different facts.
 */
export function buildFacilityCoverageRows(options: BuildFacilityCoverageRowsOptions): FacilityCoverageRow[] {
  const {
    today,
    facilities,
    items,
    productFacilities,
    inventoryItems = [],
    facilityOrderCounts = [],
    productStoreFacilities = []
  } = options;

  const facilityName = options.facilityName ?? ((facilityId: string) => facilityId);

  // Two lines of the same product have to come out of one facility, so the requirement is summed
  // per product rather than per order item.
  const requiredByProduct = items.reduce((totals, item) => {
    const quantity = toNumber(item.quantity) ?? 1;
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + quantity);
    return totals;
  }, new Map<string, number>());

  const productFacilityByKey = productFacilities.reduce((index, record) => {
    const key = productFacilityKey(record);
    if (key) index.set(key, record);
    return index;
  }, new Map<string, SourceRecord>());

  const qohByKey = sumByKey(inventoryItems, productFacilityKey, 'quantityOnHandTotal');
  const inventoryAtpByKey = sumByKey(inventoryItems, productFacilityKey, 'availableToPromiseTotal');

  const storeFacilityIds = new Set(productStoreFacilities.map((record) => record.facilityId).filter(Boolean));
  const storeScoped = storeFacilityIds.size > 0;

  const orderCountByFacility = facilityOrderCounts
    .filter((record) => entryDateMatches(record, today))
    .reduce((counts, record) => {
      const count = toNumber(record.lastOrderCount) ?? 0;
      if (record.facilityId) counts.set(record.facilityId, count);
      return counts;
    }, new Map<string, number>());

  return facilities
    .filter((facility) => facility.facilityId)
    .map((facility) => {
      const facilityId = facility.facilityId;
      const name = facility.facilityName || facilityName(facilityId);

      const rowItems: FacilityItemAvailability[] = items.map((item) => {
        const key = `${item.productId}|${facilityId}`;
        const productFacility = productFacilityByKey.get(key);
        const required = requiredByProduct.get(item.productId) ?? 1;

        if (!productFacility) {
          return {
            orderItemSeqId: item.orderItemSeqId,
            productId: item.productId,
            name: item.name || item.productId,
            required,
            available: null,
            atp: null,
            qoh: qohByKey.has(key) ? qohByKey.get(key)! : null,
            safetyStock: null,
            hasRecord: false,
            covered: false,
            shortBy: 0
          };
        }

        const safetyStock = toNumber(productFacility.minimumStock);
        const atp = toNumber(productFacility.lastInventoryCount)
          ?? toNumber(productFacility.availableToPromiseTotal)
          ?? inventoryAtpByKey.get(key)
          ?? 0;
        const computedAvailable = toNumber(productFacility.computedLastInventoryCount);
        const available = computedAvailable !== null ? computedAvailable : Math.max(atp - (safetyStock ?? 0), 0);
        const covered = available >= required;

        return {
          orderItemSeqId: item.orderItemSeqId,
          productId: item.productId,
          name: item.name || item.productId,
          required,
          available,
          atp,
          qoh: qohByKey.has(key) ? qohByKey.get(key)! : null,
          safetyStock,
          hasRecord: true,
          covered,
          shortBy: covered ? 0 : required - available
        };
      });

      // An absent allowBrokering means brokering is allowed, so only an explicit N holds a
      // facility back. Products without a record here cannot say otherwise.
      const brokeringValues = items
        .map((item) => productFacilityByKey.get(`${item.productId}|${facilityId}`))
        .filter(Boolean)
        .map((productFacility: any) => productFacility.allowBrokering || 'Y');
      const brokeringYCount = brokeringValues.filter((value) => value === 'Y').length;
      const allowBrokering = !brokeringValues.length || brokeringYCount === brokeringValues.length
        ? 'Y'
        : (brokeringYCount === 0 ? 'N' : 'Partial');

      const orderLimit = toNumber(facility.maximumOrderLimit);
      const consumedToday = orderCountByFacility.get(facilityId) ?? 0;
      const coveredCount = rowItems.filter((item) => item.covered).length;

      return {
        facilityId,
        facilityName: name,
        allowBrokering,
        orderLimit,
        consumedToday,
        remainingCapacity: orderLimit === null ? null : Math.max(orderLimit - consumedToday, 0),
        inStore: !storeScoped || storeFacilityIds.has(facilityId),
        items: rowItems,
        coveredCount,
        totalCount: rowItems.length,
        minSurplus: rowItems.reduce(
          (lowest, item) => Math.min(lowest, (item.available ?? 0) - item.required),
          Number.POSITIVE_INFINITY
        ),
        searchText: `${name} ${facilityId}`.toLowerCase()
      };
    });
}

/**
 * Best facility first. When the list is detailing one item, that item's stock decides the order —
 * ranking by overall coverage would bury the facility the operator is actually looking at.
 */
export function sortFacilityCoverageRows(rows: FacilityCoverageRow[], detailedItemIndex = -1) {
  return [...rows].sort((left, right) => {
    if (left.inStore !== right.inStore) return left.inStore ? -1 : 1;

    const leftItem = left.items[detailedItemIndex];
    const rightItem = right.items[detailedItemIndex];
    if (leftItem && rightItem) {
      if (leftItem.covered !== rightItem.covered) return leftItem.covered ? -1 : 1;
      const leftSurplus = (leftItem.available ?? 0) - leftItem.required;
      const rightSurplus = (rightItem.available ?? 0) - rightItem.required;
      if (leftSurplus !== rightSurplus) return rightSurplus - leftSurplus;
    } else {
      if (left.coveredCount !== right.coveredCount) return right.coveredCount - left.coveredCount;
      if (left.minSurplus !== right.minSurplus) return right.minSurplus - left.minSurplus;
    }

    return (left.facilityName || left.facilityId).localeCompare(right.facilityName || right.facilityId, undefined, { numeric: true });
  });
}

export function filterFacilityCoverageRows(rows: FacilityCoverageRow[], query: string) {
  const search = query.trim().toLowerCase();
  if (!search) return rows;
  return rows.filter((row) => row.searchText.includes(search));
}
