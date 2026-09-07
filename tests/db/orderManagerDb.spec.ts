import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrderManagerDb, orderManagerDbName } from '@/db/orderManagerDb';

describe('orderManagerDbName', () => {
  it('scopes the database to the OMS instance', () => {
    expect(orderManagerDbName('demo-oms')).toBe('demo-oms-OrderManagerDB');
  });

  it('refuses to name a database when the OMS is unknown, rather than sharing one across instances', () => {
    expect(() => orderManagerDbName('')).toThrow(/no OMS instance/);
  });
});

describe('getOrderManagerDb', () => {
  beforeEach(() => {
    // Land on a known instance so each test starts from the same active handle.
    getOrderManagerDb('seed-oms');
  });

  it('reuses one instance per OMS', () => {
    expect(getOrderManagerDb('alpha')).toBe(getOrderManagerDb('alpha'));
  });

  it('opens a separate database when the OMS changes, so a switch cannot read the previous tenant', () => {
    const alpha = getOrderManagerDb('alpha');
    const beta = getOrderManagerDb('beta');

    expect(beta).not.toBe(alpha);
    expect(alpha.name).toBe('alpha-OrderManagerDB');
    expect(beta.name).toBe('beta-OrderManagerDB');
  });

  it('closes the previous connection on a switch so stale handles stop serving rows', () => {
    const alpha = getOrderManagerDb('alpha');
    const close = vi.spyOn(alpha, 'close');

    getOrderManagerDb('beta');

    expect(close).toHaveBeenCalled();
  });

  it('throws instead of opening an unscoped database when the OMS is missing', () => {
    expect(() => getOrderManagerDb('')).toThrow(/no OMS instance/);
  });
});
