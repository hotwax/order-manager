import Papa from 'papaparse';
import type { WorkflowOrder } from '@/types/customerService';
import type { OrderRowEnrichment } from '@/types/orderRow';
import type { Order } from '@/types/order';
import type { ReturnSummary } from '@/types/returns';
import type { CustomerSearchRow } from '@/utils/customer';

/** Build one row per selected order from the loaded search results. */
export function buildSelectedOrdersCsv(orders: readonly Order[], selectedIds: readonly string[]): string {
  return buildSelectedRowsCsv(orders, selectedIds, (order) => order.id, (order) => ({
    'Order ID': order.id,
    'Order name': order.orderName || order.id,
    'Customer': order.customerName || order.customerId,
    'Status': order.status,
    'Sales channel': order.channel,
    'Order date': order.orderDate,
    'Carrier': order.carrierPartyId || '',
    'Shipping method': order.deliveryMethod,
    'Estimated delivery': order.estimatedDeliveryDate || order.promisedDatetime || order.shipBeforeDate || order.shipByDate || '',
    'SKUs': order.matchingSkus?.join(', ')
  }), 'SKUs');
}

export function buildSelectedWorkflowOrdersCsv(
  orders: readonly WorkflowOrder[],
  selectedIds: readonly string[],
  enrichmentFor: (orderId: string) => OrderRowEnrichment | undefined
): string {
  return buildSelectedRowsCsv(orders, selectedIds, (order) => order.orderId, (order) => {
    const enrichment = enrichmentFor(order.orderId);

    return {
      'Order ID': order.orderId,
      'Order name': order.orderName || enrichment?.orderName || order.orderId,
      'Customer': enrichment?.customerPartyName || order.customerName?.trim() || order.customerPartyId,
      'Status': order.statusId,
      'Sales channel': enrichment?.salesChannelDesc || order.salesChannelEnumId,
      'Order date': order.orderDate,
      'Carrier': order.carrierPartyId || enrichment?.carrierPartyId,
      'Shipping method': order.shippingMethodTypeId || enrichment?.shipmentMethodTypeId,
      'Estimated delivery': order.estimatedDeliveryDate || enrichment?.estimatedDeliveryDate || enrichment?.promisedDatetime || undefined
    };
  });
}

export function buildSelectedReturnsCsv(returns: readonly ReturnSummary[], selectedIds: readonly string[]): string {
  return buildSelectedRowsCsv(returns, selectedIds, (record) => record.returnId, (record) => ({
    'Return ID': record.returnId,
    'Entry date': record.entryDate,
    'Order ID': record.orderId,
    'Order name': record.orderName,
    'Customer': record.customerName || record.fromPartyId,
    'Return type ID': record.returnHeaderTypeId,
    'Return channel ID': record.returnChannelEnumId,
    'Destination facility ID': record.destinationFacilityId,
    'Status ID': record.statusId
  }));
}

export function buildSelectedCustomersCsv(customers: readonly CustomerSearchRow[], selectedIds: readonly string[]): string {
  return buildSelectedRowsCsv(customers, selectedIds, (customer) => customer.partyId, (customer) => ({
    'Party ID': customer.partyId,
    'Name': customer.fullName || customer.partyId,
    'Email': customer.emailAddress,
    'Phone': customer.phoneNumber
  }));
}

/** Keep list order and export each selected ID once, even if a paged result overlaps. */
function buildSelectedRowsCsv<T>(
  results: readonly T[],
  selectedIds: readonly string[],
  idOf: (result: T) => string,
  toRow: (result: T) => Record<string, string | undefined>,
  omitEmptyColumn?: string
): string {
  const remaining = new Set(selectedIds);
  const rows = results.filter((result) => remaining.delete(idOf(result))).map(toRow);

  if (!rows.length || remaining.size) throw new Error('Selected results are no longer available');

  const columns = Object.keys(rows[0]).filter((column) => column !== omitEmptyColumn || rows.some((row) => row[column]));
  return Papa.unparse(rows, { columns, escapeFormulae: /^[\s]*[=+\-@\t\r]/ });
}
