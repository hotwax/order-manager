import { commonUtil } from '@common';

/**
 * Return statuses have no colors of their own in common's status map, so each borrows the color
 * of the order or payment status it reads like. The return list and the return page share this,
 * so a return is the same color wherever it appears.
 */
const RETURN_STATUS_COLOR_ALIASES: Record<string, string> = {
  RETURN_REQUESTED: 'ORDER_CREATED',
  RETURN_APPROVED: 'ORDER_APPROVED',
  RETURN_ACCEPTED: 'ORDER_APPROVED',
  RETURN_AUTHORIZED: 'PAYMENT_AUTHORIZED',
  RETURN_RECEIVED: 'SHIPMENT_SHIPPED',
  RETURN_COMPLETED: 'ORDER_COMPLETED',
  RETURN_REJECTED: 'ORDER_REJECTED',
  RETURN_CANCELLED: 'ORDER_CANCELLED'
};

/** Shopify's own return statuses, as the sync reports them. */
const SHOPIFY_RETURN_STATUS_COLOR_ALIASES: Record<string, string> = {
  OPEN: 'ORDER_CREATED',
  REQUESTED: 'ORDER_CREATED',
  APPROVED: 'ORDER_APPROVED',
  AUTHORIZED: 'PAYMENT_AUTHORIZED',
  COMPLETED: 'ORDER_COMPLETED',
  CLOSED: 'ORDER_COMPLETED',
  REJECTED: 'ORDER_REJECTED',
  CANCELED: 'ORDER_CANCELLED',
  CANCELLED: 'ORDER_CANCELLED'
};

export function returnStatusColor(statusId: string): string {
  return commonUtil.getStatusColor(RETURN_STATUS_COLOR_ALIASES[statusId] || statusId);
}

export function shopifyReturnStatusColor(statusId: string): string {
  return commonUtil.getStatusColor(SHOPIFY_RETURN_STATUS_COLOR_ALIASES[statusId] || RETURN_STATUS_COLOR_ALIASES[statusId] || statusId);
}
