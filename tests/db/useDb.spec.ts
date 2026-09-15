import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { BaseDB, dbClient, useDb } from '@common/db';

const SCHEMA = { widgets: 'widgetId, kind' };
let n = 0;

async function seeded() {
  const db = new BaseDB(`useDbTest-${n++}`, SCHEMA);
  await db.open();
  await dbClient(db).entity('widgets').bulkPut([
    { widgetId: 'W1', kind: 'red' },
    { widgetId: 'W2', kind: 'blue' },
  ]);
  return db;
}

const flush = () => new Promise((r) => setTimeout(r, 60));

describe('useDb', () => {
  let db: BaseDB;
  beforeEach(async () => { db = await seeded(); });

  it('exposes records, count and first', async () => {
    let api: any;
    const C = defineComponent({ setup() { api = useDb(db, 'widgets'); return () => h('div'); } });
    const w = mount(C);
    await flush();

    expect(api.records.value).toHaveLength(2);
    expect(api.count.value).toBe(2);
    expect(api.first.value.widgetId).toBe('W1');
    expect(api.hydrated.value).toBe(true);
    w.unmount();
  });

  it('first resolves a single record via an equals option', async () => {
    let api: any;
    const C = defineComponent({
      setup() { api = useDb(db, 'widgets', { equals: { widgetId: 'W2' } }); return () => h('div'); },
    });
    const w = mount(C);
    await flush();

    expect(api.first.value.kind).toBe('blue');
    w.unmount();
  });

  it('re-subscribes when reactive options change', async () => {
    const kind = ref('red');
    let api: any;
    const C = defineComponent({
      setup() {
        api = useDb(db, 'widgets', () => ({ scope: { field: 'kind', value: kind.value } }));
        return () => h('div');
      },
    });
    const w = mount(C);
    await flush();
    expect(api.first.value.widgetId).toBe('W1');

    kind.value = 'blue';
    await nextTick();
    await flush();
    expect(api.first.value.widgetId).toBe('W2');
    w.unmount();
  });

  it('reflects writes made after mount', async () => {
    let api: any;
    const C = defineComponent({ setup() { api = useDb(db, 'widgets'); return () => h('div'); } });
    const w = mount(C);
    await flush();

    await dbClient(db).entity('widgets').put({ widgetId: 'W3', kind: 'green' });
    await flush();
    expect(api.count.value).toBe(3);
    w.unmount();
  });

  it('unsubscribes on unmount', async () => {
    let api: any;
    const C = defineComponent({ setup() { api = useDb(db, 'widgets'); return () => h('div'); } });
    const w = mount(C);
    await flush();
    const before = api.count.value;

    w.unmount();
    await dbClient(db).entity('widgets').put({ widgetId: 'W9', kind: 'grey' });
    await flush();
    expect(api.count.value).toBe(before);
  });
});
