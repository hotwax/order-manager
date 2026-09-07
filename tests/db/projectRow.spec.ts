import { describe, expect, it } from 'vitest';
import { projectRow, projectRows } from '@common/db';
import type { EntityProjection } from '@common/db';

const projection: EntityProjection = {
  keyField: 'transitionKey',
  fields: {
    transitionKey: 'text',
    statusId: 'text',
    toStatusId: 'text',
    transitionSequence: 'count',
  },
  buildKey: (raw: any) =>
    raw?.statusId && raw?.toStatusId ? `${raw.statusId}|${raw.toStatusId}` : undefined,
};

describe('projectRow', () => {
  const raw = {
    statusId: 'ORDER_CREATED',
    toStatusId: 'ORDER_APPROVED',
    transitionSequence: '2',
    unprojectedNoise: { big: 'payload' },
  };

  it('does not store the raw server payload', () => {
    const row = projectRow(raw, projection, 1000) as any;
    expect(row.raw).toBeUndefined();
    expect(row.unprojectedNoise).toBeUndefined();
  });

  it('keeps syncedAt', () => {
    expect((projectRow(raw, projection, 1000) as any).syncedAt).toBe(1000);
  });

  it('keeps the synthetic composite key and coerced fields', () => {
    const row = projectRow(raw, projection, 1000) as any;
    expect(row.transitionKey).toBe('ORDER_CREATED|ORDER_APPROVED');
    expect(row.transitionSequence).toBe(2);
  });

  it('drops records with no usable key', () => {
    expect(projectRow({ toStatusId: 'X' }, projection, 1000)).toBeNull();
    expect(projectRows([raw, { toStatusId: 'X' }], projection, 1000)).toHaveLength(1);
  });
});
