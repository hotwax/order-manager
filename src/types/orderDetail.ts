import type { ItemStatusBadge } from '@/utils/itemStatusBadges';

/** Whether a counter-sale line's inventory came off the books; `tone` is the Ionic colour name. */
export interface ItemIssuance {
  kind: 'none' | 'partial' | 'issued';
  tone: 'warning' | 'success';
  qohBefore: number;
  qohAfter: number;
}

export interface EnrichedOrderItem {
  orderItemSeqId: string;
  externalId: string;
  productId: string;
  name: string;
  sku: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  statusId: string;
  /** The status description and colour; `statuses` is the single badge the row renders. */
  status: string;
  statusColor: string;
  statuses: ItemStatusBadge[];
  shipGroupSeqId: string;
  facilityId: string;
  facilityName: string;
  attributes: any[];
  attributeCount: number;
  adjustments: Array<{ comment: string; amount: number }>;
  /** Only on counter-sale lines, once the issuance rows have loaded. */
  issuance?: ItemIssuance;
}

/** Order items rolled up by external id, so a product split across ship groups reads as one row. */
export interface EnrichedItemGroup {
  externalId: string;
  productId: string;
  name: string;
  sku: string;
  totalQty: number;
  totalPrice: number;
  statuses: ItemStatusBadge[];
  locationLabel: string;
  adjustments: Array<{ label: string; amount: number; isIncluded: boolean }>;
  items: EnrichedOrderItem[];
}

export interface EnrichedShippingAddress {
  contactMechId: string;
  /** The raw postal address, to prefill the edit form. */
  postalAddress: any;
  lines: string[];
  view: { name: string; street: string; locality: string };
  coordinates: { lat: number; lon: number } | null;
  postalCode: string;
}

export interface EnrichedShipGroup {
  id: string;
  facilityId: string;
  facilityName: string;
  isVirtual: boolean;
  isPosCompleted: boolean;
  isBrokered: boolean;
  /** Every item has stopped (cancelled or completed); the group takes no further input. */
  isSettled: boolean;
  progress: number;
  statusLabel: string;
  itemSummary: string;
  /** Fulfillment timeline dates, with the brokered date resolved (see enrichShipGroup). */
  lifecycle: Record<string, any>;
  shippingAddress: EnrichedShippingAddress | null;
  carrierPartyId?: string;
  shipmentMethodTypeId?: string;
  shippingMethodLabel: string;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
  shipAfterDate?: string;
  shipByDate?: string;
  giftMessage?: string;
  shippingInstructions?: string;
  contactMechId?: string;
  items: EnrichedOrderItem[];
}

export interface EnrichedPayment {
  id: string;
  paymentMethodTypeId: string;
  paymentMethodTypeDesc: string;
  amount: number;
  statusId: string;
  statusDesc: string;
  createdDate?: string;
  /** Shopify carry-over lineage: on exchange orders, the original order's refunded OPP manualRefNum. */
  parentRefNum: string;
}

export interface EnrichedOrderPayments {
  list: EnrichedPayment[];
  receivedTotal: number;
  netAmount: number;
  netColor?: 'danger' | 'warning';
  sections: Array<{ statusId: string; label: string; payments: EnrichedPayment[]; total: number }>;
}

export interface EnrichedOrderRisk {
  hasRiskSignal: boolean;
  recommendation: string;
  level: string;
  facts: any[];
  counts: { negative: number; positive: number; neutral: number };
}

/**
 * A header timeline entry. Links are resolved by the view, which knows the current route
 * and the user's permissions.
 */
export interface EnrichedOrderTimelineEvent {
  id: string;
  label: string;
  icon: string;
  value?: number;
  timeDiff?: string;
  metaData?: string;
  link?: { kind: 'exchangeSource' | 'exchangeChild' | 'return'; id: string };
}

export interface EnrichedOrder {
  id: string;
  orderName: string;
  externalId?: string;
  status: string;
  statusId: string;
  channel: string;
  salesChannelEnumId?: string;
  productStoreId?: string;
  productStoreName: string;
  originFacilityId: string;
  originFacilityName: string;
  currency: string;
  localeString?: string;
  riskLevelEnumId?: string;
  customer: {
    partyId: string;
    name: string;
    email: string;
    phone: string;
    billingAddress?: { lines: string[] };
  };
  identifications: Array<{
    orderIdentificationTypeId: string;
    typeLabel: string;
    idValue: string;
    fromDate?: string;
  }>;
  payments: EnrichedOrderPayments;
  risk: EnrichedOrderRisk;
  attributes: Array<{ id: string; name: string; value: string; description: string }>;
  shipGroups: EnrichedShipGroup[];
  groupedItems: EnrichedItemGroup[];
  totals: {
    subtotal: number;
    total: number;
    adjustmentRows: Array<{ label: string; detail: string; amount: number; isIncluded: boolean }>;
  };
  timeline: EnrichedOrderTimelineEvent[];
}
