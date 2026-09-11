import { describe, expect, it } from 'vitest';
import { defineEntity, projectRow, projectRows } from '@common/db';

const entity = defineEntity({
  primaryKey: 'statusFlowId,statusId,toStatusId',
  fields: {
    statusId: 'text',
    toStatusId: 'text',
    statusFlowId: 'text',
    transitionSequence: 'count',
  },
  indexes: ['statusId', 'toStatusId', 'statusFlowId'],
});

describe('projectRow', () => {
  const raw = {
    statusFlowId: 'DEFAULT',
    statusId: 'ORDER_CREATED',
    toStatusId: 'ORDER_APPROVED',
    transitionSequence: '2',
    unprojectedNoise: { big: 'payload' },
  };

  it('stores raw server payload in row.raw and strips unprojectedNoise from root', () => {
    const row = projectRow(raw, entity, 1000) as any;

    expect(row.raw).toEqual(raw);
    expect(row.unprojectedNoise).toBeUndefined();
  });

  it('keeps syncedAt', () => {
    expect((projectRow(raw, entity, 1000) as any).syncedAt).toBe(1000);
  });

  it('stores the key members as real fields, with no synthetic key column', () => {
    const row = projectRow(raw, entity, 1000) as any;

    expect(row.statusFlowId).toBe('DEFAULT');
    expect(row.statusId).toBe('ORDER_CREATED');
    expect(row.toStatusId).toBe('ORDER_APPROVED');
    expect(row.transitionKey).toBeUndefined();
    expect(row.transitionSequence).toBe(2);
  });

  it('drops records missing any key member', () => {
    expect(projectRow({ toStatusId: 'X' }, entity, 1000)).toBeNull();
    expect(projectRows([raw, { toStatusId: 'X' }], entity, 1000)).toHaveLength(1);
  });
});
