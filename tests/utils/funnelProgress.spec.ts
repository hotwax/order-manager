import { describe, expect, it } from 'vitest';
import { facilityProgressAccessibleName } from '@/utils/funnelProgress';

const translations: Record<string, string> = {
  'Order Volume': 'Volumen de pedidos',
  'Fulfillment Velocity': 'Velocidad de cumplimiento',
  'Rejections': 'Rechazos',
  'active orders': 'pedidos activos',
};

const translate = (key: string) => translations[key] || key;

describe('Funnel facility progress accessible names', () => {
  it('names volume and normal velocity bars from the translated metric', () => {
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'volume', false, translate))
      .toBe('2301 E. 51st St.: Volumen de pedidos');
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'velocity', false, translate))
      .toBe('2301 E. 51st St.: Velocidad de cumplimiento');
  });

  it('names velocity fallback and rejection-context bars from the value they display', () => {
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'velocity', true, translate))
      .toBe('2301 E. 51st St.: pedidos activos');
    expect(facilityProgressAccessibleName('2301 E. 51st St.', 'rejections', false, translate))
      .toBe('2301 E. 51st St.: pedidos activos (Rechazos)');
  });
});
