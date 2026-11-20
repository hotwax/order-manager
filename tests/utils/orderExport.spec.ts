import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { buildSelectedOrdersCsv } from '@/utils/orderExport';
import type { Order } from '@/types/order';

const order = (id: string, overrides: Partial<Order> = {}) => ({
  id, orderName: `#${id}`, customerName: 'Ada', customerId: 'C1', status: 'Approved',
  channel: 'Web', orderDate: '2026-11-20T10:00:00Z', deliveryMethod: 'Ground',
  carrierPartyId: 'UPS', estimatedDeliveryDate: '', ...overrides
}) as Order;

function records(csv: string) {
  return Papa.parse<Record<string, string>>(csv, { header: true }).data;
}

describe('selected order CSV', () => {
  it('exports only selected loaded orders, including selections on later loaded pages', () => {
    const csv = buildSelectedOrdersCsv([order('1'), order('2'), order('3')], ['1', '3']);
    expect(records(csv).map((row) => row['Order ID'])).toEqual(['1', '3']);
  });

  it('preserves CSV punctuation and protects spreadsheet formulas', () => {
    const csv = buildSelectedOrdersCsv([order('1', { customerName: '=HYPERLINK("https://example.com", "a,b")\nNext', channel: '  +SUM(1,2)' })], ['1']);
    const [row] = records(csv);
    expect(row.Customer).toBe("'=HYPERLINK(\"https://example.com\", \"a,b\")\nNext");
    expect(row['Sales channel']).toBe("'  +SUM(1,2)");
    expect(row['Order date']).toBe('2026-11-20T10:00:00Z');
  });

  it('refuses to silently export a partial selection', () => {
    expect(() => buildSelectedOrdersCsv([order('1')], ['1', 'missing'])).toThrow();
  });
});
