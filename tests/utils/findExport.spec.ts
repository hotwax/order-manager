import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { buildSelectedCustomersCsv, buildSelectedOrdersCsv, buildSelectedReturnsCsv, buildSelectedWorkflowOrdersCsv } from '@/utils/findExport';
import type { Order } from '@/types/order';
import type { WorkflowOrder } from '@/types/customerService';

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

  it('keeps selected orders without item data when another selected order has matching SKUs', () => {
    const csv = buildSelectedOrdersCsv([order('1'), order('2', { matchingSkus: ['SKU-A', 'SKU-B'] })], ['1', '2']);

    expect(records(csv)).toEqual([
      expect.objectContaining({ 'Order ID': '1', SKUs: '' }),
      expect.objectContaining({ 'Order ID': '2', SKUs: 'SKU-A, SKU-B' })
    ]);
  });

  it('omits the SKU column when no selected order has matching SKUs', () => {
    const csv = buildSelectedOrdersCsv([order('1'), order('2', { matchingSkus: ['SKU-A'] })], ['1']);

    expect(records(csv)[0]['Order ID']).toBe('1');
    expect(Papa.parse(csv, { header: true }).meta.fields).not.toContain('SKUs');
  });
});

describe('other selected result exports', () => {
  it('uses the return ID even when selected and unselected returns link to the same order', () => {
    const csv = buildSelectedReturnsCsv([
      { returnId: 'R1', orderId: 'O1', statusId: 'RETURN_COMPLETED' },
      { returnId: 'R2', orderId: 'O1', statusId: 'RETURN_RECEIVED' }
    ], ['R2']);

    expect(records(csv)).toEqual([expect.objectContaining({ 'Return ID': 'R2', 'Order ID': 'O1', 'Status ID': 'RETURN_RECEIVED' })]);
  });

  it('exports only the selected customer search fields, including phone numbers as protected text', () => {
    const selected = { partyId: 'C2', fullName: 'Ana García', emailAddress: 'ana@example.com', phoneNumber: '+1 555 0100', internal: 'hidden' };
    const csv = buildSelectedCustomersCsv([{ partyId: 'C1' }, selected], ['C2']);

    expect(records(csv)).toEqual([{ 'Party ID': 'C2', Name: 'Ana García', Email: 'ana@example.com', Phone: "'+1 555 0100" }]);
  });

  it('exports a workflow order once when multiple loaded rows share its order ID', () => {
    const makeOrder = (orderId: string, shipGroupSeqId: string) => ({
      orderId, shipGroupSeqId, customerName: ' ', customerPartyId: 'C1', statusId: 'ORDER_APPROVED'
    }) as WorkflowOrder;
    const csv = buildSelectedWorkflowOrdersCsv([
      makeOrder('O1', '01'), makeOrder('O2', '01'), makeOrder('O1', '02')
    ], ['O1'], () => undefined);

    expect(records(csv)).toEqual([expect.objectContaining({ 'Order ID': 'O1', Customer: 'C1' })]);
    expect(Papa.parse(csv, { header: true }).meta.fields).not.toContain('SKUs');
  });
});
