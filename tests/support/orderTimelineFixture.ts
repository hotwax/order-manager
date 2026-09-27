import fixture from '../fixtures/orderTimeline/rails-uat.json';
import { buildOrderEvents, type OrderEvent } from '@/utils/orderEvents';
import type { TimelineContext } from '@/utils/orderTimeline';

/**
 * Real order histories captured from rails-uat on 2026-09-26: the raw rows the order store loads,
 * with customer data dropped and user logins replaced by placeholders.
 */
export const RAILS_UAT = fixture as any;

const DESCRIPTIONS: Record<string, string> = {
  WEB_SALES_CHANNEL: 'Web Channel',
  POS_SALES_CHANNEL: 'POS Channel',
  SHOPIFY_CANCELLATION: 'Shopify Cancellation',
  NOT_IN_STOCK: 'Not in Stock',
  NO_VARIANCE_LOG: 'No variance',
  REJ_RSN_DAMAGED: 'Damaged',
  BROKERED: 'Brokered',
  RELEASED: 'Released',
  ALLOCATED: 'Shopify Allocations',
  ORDER_APPROVED: 'Approved',
  ORDER_CANCELLED: 'Cancelled',
  ORDER_COMPLETED: 'Completed',
  ITEM_APPROVED: 'Approved',
  ITEM_CANCELLED: 'Cancelled',
  ITEM_COMPLETED: 'Completed',
};

/** Interpolates like the en-US locale, where every key is its own English text. */
export const englishTranslate = (key: string, params?: Record<string, unknown>) =>
  key.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ''));

const facilities = RAILS_UAT.facilities as Record<string, { name: string; virtual: boolean }>;
export const fixtureIsVirtual = (facilityId: string) => facilities[facilityId]?.virtual ?? !facilityId;

export function fixtureEvents(orderId: string): OrderEvent[] {
  const entry = RAILS_UAT.orders[orderId];
  return buildOrderEvents({
    order: entry.order,
    facilityChanges: entry.facilityChanges,
    facilityChangesLoaded: true,
    unfillable: entry.unfillable,
    fulfillment: entry.fulfillment,
    returnHeadersById: entry.returnHeadersById,
    exchangeChildren: entry.exchangeChildren,
    isVirtualFacility: fixtureIsVirtual,
  });
}

export function fixtureContext(orderId: string): TimelineContext {
  const order = RAILS_UAT.orders[orderId].order;
  const shipGroupOfItem: Record<string, string> = {};
  (order.shipGroups || []).forEach((shipGroup: any) => (shipGroup.items || []).forEach((item: any) => { shipGroupOfItem[item.orderItemSeqId] = shipGroup.shipGroupSeqId; }));
  return {
    translate: englishTranslate,
    facilityName: (facilityId) => facilities[facilityId]?.name || facilityId,
    statusDescription: (statusId) => DESCRIPTIONS[statusId] || statusId,
    describe: (value) => DESCRIPTIONS[value] || value,
    enumDescription: (enumId) => DESCRIPTIONS[enumId] || enumId,
    isVirtualFacility: fixtureIsVirtual,
    itemTotal: Object.keys(shipGroupOfItem).length,
    shipGroupOfItem,
    posShipGroupIds: new Set((order.shipGroups || []).filter((sg: any) => sg.shipmentMethodTypeId === 'POS_COMPLETED').map((sg: any) => sg.shipGroupSeqId)),
    originFacilityId: order.originFacilityId && order.originFacilityId !== '_NA_' ? order.originFacilityId : undefined,
    orderLabel: (id) => RAILS_UAT.orders[id]?.order.orderName || id,
  };
}
