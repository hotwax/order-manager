import Papa from 'papaparse';
import type { Order } from '@/types/order';

/** Build one row per selected order from the same loaded summaries shown in Find orders. */
export function buildSelectedOrdersCsv(orders: readonly Order[], selectedIds: readonly string[]): string {
  const selected = new Set(selectedIds);
  const rows = orders.filter((order) => selected.has(order.id));
  if (!selected.size || rows.length !== selected.size) throw new Error('Selected orders are no longer available');

  return Papa.unparse(rows.map((order) => ({
    'Order ID': order.id,
    'Order name': order.orderName || order.id,
    'Customer': order.customerName || order.customerId,
    'Status': order.status,
    'Sales channel': order.channel,
    'Order date': order.orderDate,
    'Carrier': order.carrierPartyId || '',
    'Shipping method': order.deliveryMethod,
    'Estimated delivery': order.estimatedDeliveryDate || order.promisedDatetime || order.shipBeforeDate || order.shipByDate || ''
  })), { escapeFormulae: /^[\s]*[=+\-@\t\r]/ });
}
