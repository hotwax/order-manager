import { describe, expect, it } from 'vitest';
import { DIMENSION_LABELS, facilityProgressAccessibleName } from '@/utils/funnelProgress';
import enUS from '@/locales/en-US.json';

const translations: Record<string, string> = {
  'Order volume': 'Volumen de pedidos',
  'Fulfillment velocity': 'Velocidad de cumplimiento',
  'Rejections': 'Rechazos',
  'Active orders': 'Pedidos activos',
  'Active orders (rejections)': 'Pedidos activos (rechazos)',
};

const translate = (key: string, params: Record<string, unknown> = {}) =>
  (translations[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name]));

describe('Funnel dimension labels', () => {
  it('name message keys that exist, since the list header links to them by name', () => {
    expect(Object.values(DIMENSION_LABELS).filter((key) => !(key in enUS))).toEqual([]);
  });
});

describe('Funnel facility progress accessible names', () => {
  it('names volume and normal velocity bars from the translated metric', () => {
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'volume', false, translate))
      .toBe('2301 E. 51st St.: Volumen de pedidos');
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'velocity', false, translate))
      .toBe('2301 E. 51st St.: Velocidad de cumplimiento');
  });

  it('names velocity fallback and rejection-context bars from the value they display', () => {
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'velocity', true, translate))
      .toBe('2301 E. 51st St.: Pedidos activos');
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'rejections', false, translate))
      .toBe('2301 E. 51st St.: Pedidos activos (rechazos)');
  });
});
