import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BaseDB, dbClient } from '@common/db';

const SCHEMA = { widgets: 'widgetId, kind', gadgets: 'gadgetId' };

describe('dbClient', () => {
  let db: BaseDB;
  let client: ReturnType<typeof dbClient>;
  let n = 0;

  beforeEach(async () => {
    db = new BaseDB(`dbClientTest-${n++}`, SCHEMA);
    await db.open();
    client = dbClient(db);
    await client.entity('widgets').bulkPut([
      { widgetId: 'W1', kind: 'red', syncedAt: 1 },
      { widgetId: 'W2', kind: 'blue', syncedAt: 2 },
      { widgetId: 'W3', kind: 'red', syncedAt: 3 },
    ]);
  });

  it('reads one row by primary key', async () => {
    expect(await client.entity('widgets').get('W2')).toEqual({ widgetId: 'W2', kind: 'blue', syncedAt: 2 });
  });

  it('returns undefined for a missing key', async () => {
    expect(await client.entity('widgets').get('NOPE')).toBeUndefined();
  });

  it('reads many rows by key', async () => {
    const rows = await client.entity('widgets').getMany(['W1', 'W3']);
    expect(rows.map((r: any) => r.widgetId)).toEqual(['W1', 'W3']);
  });

  it('reads a whole table', async () => {
    expect(await client.entity('widgets').all()).toHaveLength(3);
  });

  it('filters by an indexed scope', async () => {
    const rows = await client.entity('widgets').query({ scope: { field: 'kind', value: 'red' } });
    expect(rows.map((r: any) => r.widgetId).sort()).toEqual(['W1', 'W3']);
  });

  it('applies an in-memory filter and a limit', async () => {
    const rows = await client.entity('widgets').query({
      filter: (r: any) => r.widgetId !== 'W2',
      limit: 1,
    });
    expect(rows).toHaveLength(1);
  });

  it('counts rows', async () => {
    expect(await client.entity('widgets').count()).toBe(3);
    expect(await client.entity('widgets').count({ scope: { field: 'kind', value: 'blue' } })).toBe(1);
  });

  it('returns the first match or undefined', async () => {
    const hit = await client.entity('widgets').first({ scope: { field: 'kind', value: 'blue' } });
    expect((hit as any)?.widgetId).toBe('W2');
    expect(await client.entity('widgets').first({ scope: { field: 'kind', value: 'green' } })).toBeUndefined();
  });

  it('puts, removes and clears', async () => {
    const gadgetEntity = client.entity('gadgets');
    await gadgetEntity.put({ gadgetId: 'G1' });
    expect(await gadgetEntity.count()).toBe(1);
    await gadgetEntity.remove('G1');
    expect(await gadgetEntity.count()).toBe(0);
    await gadgetEntity.bulkPut([{ gadgetId: 'G2' }, { gadgetId: 'G3' }]);
    await gadgetEntity.bulkRemove(['G2']);
    expect(await gadgetEntity.count()).toBe(1);
    await gadgetEntity.clear();
    expect(await gadgetEntity.count()).toBe(0);
  });

  it('lists table names including syncMeta', () => {
    expect(client.tableNames()).toEqual(expect.arrayContaining(['widgets', 'gadgets', 'syncMeta']));
  });

  it('live emits immediately and again after a write', async () => {
    const seen: number[] = [];
    const sub = client.entity('widgets').live().subscribe({ next: (rows: any[]) => seen.push(rows.length) });

    await new Promise((r) => setTimeout(r, 50));
    expect(seen.at(-1)).toBe(3);

    await client.entity('widgets').put({ widgetId: 'W4', kind: 'green', syncedAt: 4 });
    await new Promise((r) => setTimeout(r, 100));
    expect(seen.at(-1)).toBe(4);

    sub.unsubscribe();
  });

  describe('entity access pattern', () => {
    it('supports entity-bound reads, writes, counts and live queries', async () => {
      const widgetEntity = client.entity<{ widgetId: string; kind: string; syncedAt: number }>('widgets');
      expect(widgetEntity.table).toBe('widgets');

      // get / getMany / all
      expect(await widgetEntity.get('W2')).toEqual({ widgetId: 'W2', kind: 'blue', syncedAt: 2 });
      expect(await widgetEntity.getMany(['W1', 'W3'])).toHaveLength(2);
      expect(await widgetEntity.all()).toHaveLength(3);

      // query / first / count
      const redWidgets = await widgetEntity.query({ scope: { field: 'kind', value: 'red' } });
      expect(redWidgets).toHaveLength(2);
      const firstRed = await widgetEntity.first({ scope: { field: 'kind', value: 'red' } });
      expect(firstRed?.widgetId).toBe('W1');
      expect(await widgetEntity.count()).toBe(3);

      // put / remove / bulkPut / bulkRemove / clear
      const gadgetEntity = client.entity<{ gadgetId: string }>('gadgets');
      await gadgetEntity.put({ gadgetId: 'G1' });
      expect(await gadgetEntity.count()).toBe(1);
      await gadgetEntity.remove('G1');
      expect(await gadgetEntity.count()).toBe(0);

      await gadgetEntity.bulkPut([{ gadgetId: 'G2' }, { gadgetId: 'G3' }]);
      expect(await gadgetEntity.count()).toBe(2);
      await gadgetEntity.bulkRemove(['G2']);
      expect(await gadgetEntity.count()).toBe(1);
      await gadgetEntity.clear();
      expect(await gadgetEntity.count()).toBe(0);
    });

    it('supports reactive live queries via entity.live', async () => {
      const widgetEntity = client.entity('widgets');
      const seen: number[] = [];
      const sub = widgetEntity.live().subscribe({ next: (rows: any[]) => seen.push(rows.length) });

      await new Promise((r) => setTimeout(r, 50));
      expect(seen.at(-1)).toBe(3);

      await widgetEntity.put({ widgetId: 'W5', kind: 'yellow', syncedAt: 5 });
      await new Promise((r) => setTimeout(r, 100));
      expect(seen.at(-1)).toBe(4);

      sub.unsubscribe();
    });

    it('memoizes entity instances', () => {
      const e1 = client.entity('widgets');
      const e2 = client.entity('widgets');
      expect(e1).toBe(e2);
    });
  });
});
