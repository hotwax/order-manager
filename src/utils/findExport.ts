import Papa from 'papaparse';
import type { WorkflowOrder } from '@/types/customerService';
import type { OrderRowEnrichment } from '@/types/orderRow';
import type { Order } from '@/types/order';
import type { ReturnSummary } from '@/types/returns';
import type { CustomerSearchRow } from '@/utils/customer';

type CsvRow = Record<string, string | undefined>;
const orderItemColumns = ['Order item sequence ID', 'SKU', 'Quantity'];

/** Repeat order details for each item returned in the search, or export the order summary alone. */
export function buildSelectedOrdersCsv(orders: readonly Order[], selectedIds: readonly string[]): string {
  return buildSelectedRowsCsv(orders, selectedIds, (order) => order.id, (order) => {
    const summary = {
      'Order ID': order.id,
      'Order name': order.orderName || order.id,
      'Customer': order.customerName || order.customerId,
      'Status': order.status,
      'Sales channel': order.channel,
      'Order date': order.orderDate,
      'Carrier': order.carrierPartyId || '',
      'Shipping method': order.deliveryMethod,
      'Estimated delivery': order.estimatedDeliveryDate || order.promisedDatetime || order.shipBeforeDate || order.shipByDate || ''
    };
    const items = order.matchingItems?.length ? order.matchingItems : [undefined];

    return items.map((item) => ({
      ...summary,
      'Order item sequence ID': item?.orderItemSeqId,
      'SKU': item?.sku,
      'Quantity': item?.quantity
    }));
  }, orderItemColumns);
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

/** Process each selected result once in list order, even if a paged result overlaps. */
function buildSelectedRowsCsv<T>(
  results: readonly T[],
  selectedIds: readonly string[],
  idOf: (result: T) => string,
  toRows: (result: T) => CsvRow | CsvRow[],
  optionalColumns: readonly string[] = []
): string {
  const remaining = new Set(selectedIds);
  const rows = results.filter((result) => remaining.delete(idOf(result))).flatMap(toRows);

  if (!rows.length || remaining.size) throw new Error('Selected results are no longer available');

  const hasOptionalData = rows.some((row) => optionalColumns.some((column) => row[column]));
  const columns = Object.keys(rows[0]).filter((column) => hasOptionalData || !optionalColumns.includes(column));
  return Papa.unparse(rows, { columns, escapeFormulae: /^[\s]*[=+\-@\t\r]/ });
}
