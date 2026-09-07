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
    await client.bulkPut('widgets', [
      { widgetId: 'W1', kind: 'red', syncedAt: 1 },
      { widgetId: 'W2', kind: 'blue', syncedAt: 2 },
      { widgetId: 'W3', kind: 'red', syncedAt: 3 },
    ]);
  });

  it('reads one row by primary key', async () => {
    expect(await client.get('widgets', 'W2')).toEqual({ widgetId: 'W2', kind: 'blue', syncedAt: 2 });
  });

  it('returns undefined for a missing key', async () => {
    expect(await client.get('widgets', 'NOPE')).toBeUndefined();
  });

  it('reads many rows by key', async () => {
    const rows = await client.getMany('widgets', ['W1', 'W3']);
    expect(rows.map((r: any) => r.widgetId)).toEqual(['W1', 'W3']);
  });

  it('reads a whole table', async () => {
    expect(await client.all('widgets')).toHaveLength(3);
  });

  it('filters by an indexed scope', async () => {
    const rows = await client.query('widgets', { scope: { field: 'kind', value: 'red' } });
    expect(rows.map((r: any) => r.widgetId).sort()).toEqual(['W1', 'W3']);
  });

  it('applies an in-memory filter and a limit', async () => {
    const rows = await client.query('widgets', {
      filter: (r: any) => r.widgetId !== 'W2',
      limit: 1,
    });
    expect(rows).toHaveLength(1);
  });

  it('counts rows', async () => {
    expect(await client.count('widgets')).toBe(3);
    expect(await client.count('widgets', { scope: { field: 'kind', value: 'blue' } })).toBe(1);
  });

  it('returns the first match or undefined', async () => {
    const hit = await client.first('widgets', { scope: { field: 'kind', value: 'blue' } });
    expect((hit as any)?.widgetId).toBe('W2');
    expect(await client.first('widgets', { scope: { field: 'kind', value: 'green' } })).toBeUndefined();
  });

  it('puts, removes and clears', async () => {
    await client.put('gadgets', { gadgetId: 'G1' });
    expect(await client.count('gadgets')).toBe(1);
    await client.remove('gadgets', 'G1');
    expect(await client.count('gadgets')).toBe(0);
    await client.bulkPut('gadgets', [{ gadgetId: 'G2' }, { gadgetId: 'G3' }]);
    await client.bulkRemove('gadgets', ['G2']);
    expect(await client.count('gadgets')).toBe(1);
    await client.clear('gadgets');
    expect(await client.count('gadgets')).toBe(0);
  });

  it('lists table names including syncMeta', () => {
    expect(client.tableNames()).toEqual(expect.arrayContaining(['widgets', 'gadgets', 'syncMeta']));
  });

  it('live emits immediately and again after a write', async () => {
    const seen: number[] = [];
    const sub = client.live('widgets').subscribe({ next: (rows: any[]) => seen.push(rows.length) });

    await new Promise((r) => setTimeout(r, 50));
    expect(seen.at(-1)).toBe(3);

    await client.put('widgets', { widgetId: 'W4', kind: 'green', syncedAt: 4 });
    await new Promise((r) => setTimeout(r, 100));
    expect(seen.at(-1)).toBe(4);

    sub.unsubscribe();
  });
});
