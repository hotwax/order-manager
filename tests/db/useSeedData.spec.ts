import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { BaseDB, COMMON_DB_SCHEMA, dbClient } from '@common/db';
import * as seed from '@/db/useSeedData';
import { useSeedData } from '@/db/useSeedData';

const flush = (ms = 250) => new Promise((r) => setTimeout(r, ms));
let n = 0;
let db: BaseDB;

async function seedDb() {
  db = new BaseDB(`useSeedDataTest-${n++}`, COMMON_DB_SCHEMA);
  await db.open();
  const c = dbClient(db);
  await c.bulkPut('statuses', [
    { statusId: 'ORDER_APPROVED', statusTypeId: 'ORDER_STATUS', description: 'Approved', statusAge: 5, syncedAt: 1 },
    { statusId: 'ORDER_CREATED', statusTypeId: 'ORDER_STATUS', description: 'Created', syncedAt: 1 },
  ]);
  await c.bulkPut('enums', [
    { enumId: 'WEB_CHANNEL', enumTypeId: 'ORDER_SALES_CHANNEL', description: 'Web', syncedAt: 1 },
    { enumId: 'WE_PICK', enumTypeId: 'WePurposeChild', description: 'Picking', syncedAt: 1 },
  ]);
  await c.bulkPut('enumTypes', [{ enumTypeId: 'WePurposeChild', parentTypeId: 'WorkEffortPurposeType', syncedAt: 1 }]);
  await c.bulkPut('facilities', [{ facilityId: 'F1', facilityName: 'Main Warehouse', facilityTypeId: 'WAREHOUSE', syncedAt: 1 }]);
  await c.bulkPut('geos', [
    { geoId: 'USA', geoName: 'United States', geoCodeAlpha2: 'US', geoTypeEnumId: 'GEOT_COUNTRY', syncedAt: 1 },
    { geoId: 'USA_CA', geoName: 'California', geoCode: 'CA', geoTypeEnumId: 'GEOT_STATE', syncedAt: 1 },
  ]);
  await c.bulkPut('geoAssocs', [{ geoAssocKey: 'USA|USA_CA', geoId: 'USA', toGeoId: 'USA_CA', syncedAt: 1 }]);
  await c.bulkPut('roleTypes', [{ roleTypeId: 'CARRIER', description: 'Carrier', syncedAt: 1 }]);
  await c.bulkPut('statusFlowTransitions', [
    { transitionKey: 'ORDER_CREATED|ORDER_APPROVED', statusId: 'ORDER_CREATED', toStatusId: 'ORDER_APPROVED', transitionSequence: 1, syncedAt: 1 },
  ]);
  // Mark every domain synced so ensureLoaded resolves immediately in the common cases.
  for (const domain of ['status', 'enum', 'enumType', 'facility', 'geo', 'geoAssoc', 'roleType', 'statusFlowTransition']) {
    await c.put('syncMeta', { key: `loginSync:${domain}`, synced: true, timestamp: 1 });
  }
  return c;
}

describe('useSeedData module', () => {
  beforeEach(async () => { await seedDb(); seed.__setDbResolver(() => db); });
  afterEach(() => { seed.resetSeedData(); });

  it('a cold getter returns the raw id, then resolves on the next tick', async () => {
    expect(seed.facilityName('F1')).toBe('F1');
    await flush();
    expect(seed.facilityName('F1')).toBe('Main Warehouse');
  });

  it('ensureLoaded resolves only once the named tables are populated', async () => {
    await seed.ensureLoaded(['statuses', 'facilities']);
    expect(seed.statusDescription('ORDER_APPROVED')).toBe('Approved');
    expect(seed.facilityName('F1')).toBe('Main Warehouse');
  });

  it('ensureLoaded waits for the domain to sync, then sees the rows', async () => {
    const empty = new BaseDB(`useSeedDataCold-${n++}`, COMMON_DB_SCHEMA);
    await empty.open();
    seed.__setDbResolver(() => empty);

    let resolved = false;
    const pending = seed.ensureLoaded(['facilities']).then(() => { resolved = true; });

    await flush(80);
    expect(resolved).toBe(false);            // no rows, no marker -> still waiting

    await dbClient(empty).bulkPut('facilities', [{ facilityId: 'LATE', facilityName: 'Late Facility', syncedAt: 9 }]);
    await dbClient(empty).put('syncMeta', { key: 'loginSync:facility', synced: true, timestamp: 9 });

    await pending;
    expect(resolved).toBe(true);
    expect(seed.facilityName('LATE')).toBe('Late Facility');
  });

  it('ensureLoaded gives up after the timeout rather than hanging', async () => {
    const empty = new BaseDB(`useSeedDataStalled-${n++}`, COMMON_DB_SCHEMA);
    await empty.open();
    seed.__setDbResolver(() => empty);

    await seed.ensureLoaded(['facilities'], 120);   // never synced; must still resolve
    expect(seed.facilityName('F1')).toBe('F1');
  });

  it('describe falls through statuses, enums then lookup tables', async () => {
    await seed.ensureLoaded(['statuses', 'enums', 'roleTypes']);
    expect(seed.describe('ORDER_APPROVED')).toBe('Approved');
    expect(seed.describe('WEB_CHANNEL')).toBe('Web');
    expect(seed.describe('CARRIER')).toBe('Carrier');
  });

  it('returns the raw id on a genuine miss', async () => {
    await seed.ensureLoaded(['statuses', 'enums', 'facilities']);
    expect(seed.describe('NOT_A_THING')).toBe('NOT_A_THING');
    expect(seed.facilityName('NOPE')).toBe('NOPE');
    expect(seed.describe('')).toBe('');
  });

  it('resolves geos and builds the geoAssoc secondary index', async () => {
    await seed.ensureLoaded(['geos', 'geoAssocs']);
    expect(seed.geoName('USA')).toBe('United States');
    expect(seed.getGeoIdByCode('US')).toBe('USA');
    expect(seed.getCountries().map((g: any) => g.geoId)).toEqual(['USA']);
    expect(seed.getStates().map((g: any) => g.geoId)).toEqual(['USA_CA']);
    expect(seed.getStatesForCountry('USA').map((g: any) => g.geoId)).toEqual(['USA_CA']);
    expect(seed.getStatesForCountry('IND')).toEqual([]);
  });

  it('builds the status and enum type secondary indexes', async () => {
    await seed.ensureLoaded(['statuses', 'enums', 'enumTypes']);
    expect(seed.getStatusItemsByType('ORDER_STATUS')).toHaveLength(2);
    expect(seed.getEnumsByType('ORDER_SALES_CHANNEL')).toHaveLength(1);
    expect(seed.getEnumsByParentType('WorkEffortPurposeType').map((e: any) => e.enumId)).toEqual(['WE_PICK']);
  });

  it('resolves status flow transitions with descriptions', async () => {
    await seed.ensureLoaded(['statuses', 'statusFlowTransitions']);
    const transitions = seed.allowedTransitions('ORDER_CREATED');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].toStatusDescription).toBe('Approved');
  });

  it('replaces a slice when its table changes', async () => {
    await seed.ensureLoaded(['facilities']);
    await dbClient(db).put('facilities', { facilityId: 'F2', facilityName: 'Overflow', syncedAt: 2 });
    await flush();
    expect(seed.facilityName('F2')).toBe('Overflow');
  });

  it('collapses a burst of writes into one rebuild', async () => {
    await seed.ensureLoaded(['facilities']);
    const c = dbClient(db);
    await c.put('facilities', { facilityId: 'A', facilityName: 'A', syncedAt: 2 });
    await c.put('facilities', { facilityId: 'B', facilityName: 'B', syncedAt: 2 });
    await c.put('facilities', { facilityId: 'C', facilityName: 'C', syncedAt: 2 });
    await flush();
    expect(seed.facilityName('C')).toBe('C');
  });

  it('resetSeedData drops slices and stops reacting to writes', async () => {
    await seed.ensureLoaded(['facilities']);
    seed.resetSeedData();
    expect(seed.facilityName('F1')).toBe('F1');
  });

  it('a component computed self-corrects when the slice fills', async () => {
    const C = defineComponent({
      setup() {
        const s = useSeedData();
        return () => h('div', s.facilityName('F1'));
      },
    });
    const w = mount(C);
    expect(w.text()).toBe('F1');

    await flush();
    await nextTick();
    expect(w.text()).toBe('Main Warehouse');
    w.unmount();
  });
});
